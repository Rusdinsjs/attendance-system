package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development
		return true
	},
}

// WebSocketHub manages all WebSocket connections
type WebSocketHub struct {
	clients    map[*WebSocketClient]bool
	broadcast  chan []byte
	register   chan *WebSocketClient
	unregister chan *WebSocketClient
	mu         sync.RWMutex
}

// WebSocketClient represents a single WebSocket connection
type WebSocketClient struct {
	hub    *WebSocketHub
	conn   *websocket.Conn
	send   chan []byte
	userID uuid.UUID
	role   string
}

// AttendanceEvent represents a real-time attendance update
type AttendanceEvent struct {
	Type       string    `json:"type"` // "check_in" or "check_out"
	UserID     uuid.UUID `json:"user_id"`
	UserName   string    `json:"user_name"`
	EmployeeID string    `json:"employee_id"`
	Time       time.Time `json:"time"`
	IsLate     bool      `json:"is_late,omitempty"`
}

// WebSocketMessage represents a message sent through WebSocket
type WebSocketMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

// NewWebSocketHub creates a new WebSocket hub
func NewWebSocketHub() *WebSocketHub {
	return &WebSocketHub{
		clients:    make(map[*WebSocketClient]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *WebSocketClient),
		unregister: make(chan *WebSocketClient),
	}
}

// Run starts the WebSocket hub
func (h *WebSocketHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected. Total clients: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected. Total clients: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastAttendanceUpdate broadcasts an attendance event to all connected clients
func (h *WebSocketHub) BroadcastAttendanceUpdate(event AttendanceEvent) {
	message := WebSocketMessage{
		Event: "attendance_update",
		Data:  event,
	}
	
	data, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal attendance event: %v", err)
		return
	}
	
	h.broadcast <- data
}

// BroadcastMessage broadcasts a generic message to all connected clients
func (h *WebSocketHub) BroadcastMessage(event string, data interface{}) {
	message := WebSocketMessage{
		Event: event,
		Data:  data,
	}
	
	msgData, err := json.Marshal(message)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}
	
	h.broadcast <- msgData
}

// GetConnectedCount returns the number of connected clients
func (h *WebSocketHub) GetConnectedCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// HandleWebSocket handles WebSocket connection upgrade
// GET /ws/dashboard
func (h *WebSocketHub) HandleWebSocket(c *gin.Context) {
	// Upgrade HTTP to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Get user info from context (if authenticated)
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

	var uid uuid.UUID
	var roleStr string
	if userID != nil {
		uid = userID.(uuid.UUID)
	}
	if role != nil {
		roleStr = role.(string)
	}

	client := &WebSocketClient{
		hub:    h,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: uid,
		role:   roleStr,
	}

	h.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// writePump sends messages from hub to client
func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to current websocket message
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads messages from client
func (c *WebSocketClient) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}
