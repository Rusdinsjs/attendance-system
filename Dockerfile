# Development Dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy all source files
COPY . .

# Generate go.sum and download dependencies
RUN go mod tidy

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server

# Final stage - use same image for simplicity in dev
FROM golang:1.21-alpine

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/server /app/server

# Expose port
EXPOSE 8080

# Run the binary
CMD ["/app/server"]
