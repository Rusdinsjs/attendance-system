# Attendance System Backend

Enterprise-grade attendance system backend built with Go, Gin, PostgreSQL, and Redis.

## Features

- 🔐 **JWT Authentication** - Secure access/refresh token flow
- 📍 **Geofence Validation** - Server-side location verification using Haversine formula
- 👤 **Face Embeddings Storage** - Store up to 5 face vectors per user for ML-based matching
- ⚡ **Real-time Updates** - WebSocket broadcast for admin dashboard
- 🐳 **Docker Ready** - Complete Docker Compose setup

## Quick Start

### Using Docker (Recommended)

```bash
# Copy environment file
cp .env.example .env

# Start all services (PostgreSQL, Redis, API)
docker-compose up -d

# View logs
docker-compose logs -f api
```

### Local Development

Requires Go 1.21+, PostgreSQL 15+, Redis 7+

```bash
# Install dependencies
go mod download

# Run migrations
psql -h localhost -U attendance -d attendance_db -f migrations/001_init.sql

# Start server
go run cmd/server/main.go
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |

### User (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/face-embeddings` | Update face vectors (1-5) |
| GET | `/api/users/sync-face` | Sync face data to mobile |

### Attendance (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/check-in` | Check-in with location |
| POST | `/api/attendance/check-out` | Check-out |
| GET | `/api/attendance/today` | Today's status |
| GET | `/api/attendance/history` | Attendance history |

### Admin (Protected + HR Role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/attendance/today` | All attendance today |

### WebSocket
| Endpoint | Description |
|----------|-------------|
| `ws://localhost:8080/ws/dashboard` | Real-time attendance updates |

## Default Admin Account

- **Email**: admin@attendance.local
- **Password**: admin123

## Environment Variables

```env
APP_ENV=development
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=attendance
DB_PASSWORD=attendance_secret
DB_NAME=attendance_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
```

## Project Structure

```
├── cmd/server/main.go       # Entry point
├── internal/
│   ├── config/              # Configuration
│   ├── database/            # DB connection
│   ├── handlers/            # HTTP handlers
│   ├── middleware/          # Auth middleware
│   ├── models/              # GORM models
│   ├── repository/          # Data access
│   └── utils/               # Helpers (JWT, Geofence)
├── migrations/              # SQL migrations
├── docker-compose.yml
└── Dockerfile
```

## Testing API

```bash
# Register user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"EMP001","name":"John Doe","email":"john@test.com","password":"secret123"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"secret123"}'

# Check-in (use token from login)
curl -X POST http://localhost:8080/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"latitude":-6.200000,"longitude":106.816666,"device_info":"Test Device"}'
```

## License

MIT
# attendance-system
