// WebSocket Hub and Handler for realtime updates
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

// Event types
const (
	EventUserUpdated       = "user:updated"
	EventAttendanceCheckIn = "attendance:checkin"
	EventAttendanceCheckOut = "attendance:checkout"
	EventSettingsUpdated   = "settings:updated"
	EventFaceVerified      = "face:verified"
)

// AttendanceEvent payload
type AttendanceEvent struct {
	Type       string    `json:"type"`
	UserID     uuid.UUID `json:"user_id"`
	UserName   string    `json:"user_name"`
	EmployeeID string    `json:"employee_id"`
	Time       time.Time `json:"time"`
	IsLate     bool      `json:"is_late"`
}

// WebSocketMessage represents a message to broadcast
type WebSocketMessage struct {
	Event   string      `json:"event"`
	Payload interface{} `json:"payload"`
}

// Client represents a connected WebSocket client
type Client struct {
	hub      *WebSocketHub
	conn     *websocket.Conn
	send     chan []byte
	userID   string  // Optional: authenticated user ID
	clientType string // "admin", "kiosk", "mobile"
}

// WebSocketHub maintains active clients and broadcasts messages
type WebSocketHub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// Global hub instance
var WSHub *WebSocketHub

// NewWebSocketHub creates a new Hub
func NewWebSocketHub() *WebSocketHub {
	return &WebSocketHub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop
func (h *WebSocketHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected. Total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected. Total: %d", len(h.clients))

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

// Broadcast sends a message to all connected clients
func (h *WebSocketHub) Broadcast(event string, payload interface{}) {
	msg := WebSocketMessage{
		Event:   event,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("WebSocket marshal error: %v", err)
		return
	}
	h.broadcast <- data
}

// BroadcastAttendanceUpdate simplifies broadcasting attendance events
// Matches the method signature called in attendance.go
func (h *WebSocketHub) BroadcastAttendanceUpdate(event AttendanceEvent) {
	// Wrap in standard message format using legacy/expected type "attendance_update"
	// Dashboard expects "attendance_update"
	msg := map[string]interface{}{
		"type":    "attendance_update", // Dashboard listener expects this
		"payload": event,
	}
	
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("WebSocket marshal error: %v", err)
		return
	}
	h.broadcast <- data
}

// BroadcastToType sends a message only to clients of a specific type
func (h *WebSocketHub) BroadcastToType(clientType string, event string, payload interface{}) {
	msg := WebSocketMessage{
		Event:   event,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("WebSocket marshal error: %v", err)
		return
	}
	
	h.mu.RLock()
	for client := range h.clients {
		if client.clientType == clientType {
			select {
			case client.send <- data:
			default:
			}
		}
	}
	h.mu.RUnlock()
}
// GetConnectedCount returns number of connected clients
func (h *WebSocketHub) GetConnectedCount() int {
    h.mu.RLock()
    defer h.mu.RUnlock()
    return len(h.clients)
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

// HandleWebSocket handles WebSocket connections
// Renamed from WebSocketHandler to match main.go usage: wsHub.HandleWebSocket
func (h *WebSocketHub) HandleWebSocket(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		clientType := c.Query("type") // "admin", "kiosk", "mobile"
		if clientType == "" {
			clientType = "unknown"
		}

		client := &Client{
			hub:        h,
			conn:       conn,
			send:       make(chan []byte, 256),
			clientType: clientType,
		}

		h.register <- client

		// Start goroutines for reading and writing
		go client.writePump()
		go client.readPump()
}

// readPump reads messages from the WebSocket connection
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		// For now, we only broadcast from server, ignore client messages
	}
}

// writePump writes messages to the WebSocket connection
func (c *Client) writePump() {
	defer c.conn.Close()

	for message := range c.send {
		err := c.conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Printf("WebSocket write error: %v", err)
			return
		}
	}
}

// InitWebSocket initializes the global WebSocket hub
func InitWebSocket() *WebSocketHub {
	WSHub = NewWebSocketHub()
	go WSHub.Run()
	return WSHub
}
