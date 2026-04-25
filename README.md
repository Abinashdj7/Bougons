# RideX — Uber-like Platform + Notification Microservice

A full-stack ride-hailing platform built with a microservices architecture.

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 14, Tailwind CSS, Zustand   |
| Backend     | Node.js, Express.js                 |
| Database    | MongoDB (with geospatial indexes)   |
| Cache/Queue | Redis, BullMQ                       |
| Real-time   | Socket.io, SSE                      |
| DevOps      | Docker, Docker Compose              |
| Payments    | Stripe                              |
| Maps        | Leaflet + OpenStreetMap / Mapbox    |

## Project Structure

```
uber-app/
├── apps/
│   ├── rider-app/          # Next.js — Rider interface (port 3000)
│   ├── driver-app/         # Next.js — Driver interface (port 3001)
│   └── admin-app/          # Next.js — Admin dashboard (port 3002) [Phase 4]
├── services/
│   ├── api-gateway/        # Express — Entry point, proxies to services (port 4000)
│   ├── user-service/       # Express — Auth, profiles (port 4001)
│   ├── ride-service/       # Express — Ride logic [Phase 2] (port 4002)
│   ├── location-service/   # Express — GPS & matching [Phase 2] (port 4003)
│   ├── payment-service/    # Express — Stripe [Phase 4] (port 4004)
│   └── notification-service/ # Express — Multi-channel notifs [Phase 3] (port 4005)
├── docker-compose.yml
└── .env
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev without Docker)

### Setup

```bash
# 1. Clone the repo
git clone <your-repo>
cd uber-app

# 2. Copy environment variables
cp .env.example .env
# → Edit .env with your values

# 3. Start everything with Docker
docker compose up --build

# Or start a specific service
docker compose up user-service api-gateway
```

### Services will be available at:
| Service      | URL                        |
|--------------|----------------------------|
| Rider App    | http://localhost:3000      |
| Driver App   | http://localhost:3001      |
| API Gateway  | http://localhost:4000      |
| User Service | http://localhost:4001      |
| MongoDB      | mongodb://localhost:27017  |
| Redis        | redis://localhost:6379     |

## API Endpoints (Phase 1)

All requests go through the API Gateway at `http://localhost:4000`

### Auth
```
POST /api/auth/register    # Register rider or driver
POST /api/auth/login       # Login
POST /api/auth/refresh     # Refresh access token
POST /api/auth/logout      # Logout (requires auth)
GET  /api/auth/me          # Get current user (requires auth)
```

### Profile
```
GET  /api/profile              # Get profile
PUT  /api/profile              # Update profile
PUT  /api/profile/driver       # Update driver vehicle info
PUT  /api/profile/driver/status # Toggle online/offline
GET  /api/profile/drivers/:id  # Get driver by ID
```

## Development Phases

- [x] **Phase 1** — Foundation: Auth, API Gateway, Docker, Next.js shells
- [ ] **Phase 2** — Core Ride Flow: WebSockets, live maps, driver matching
- [ ] **Phase 3** — Notifications: BullMQ, email, push, SSE
- [ ] **Phase 4** — Payments & Polish: Stripe, surge pricing, admin dashboard

## Architecture

```
Rider App (3000)    Driver App (3001)
       ↓                   ↓
    API Gateway (4000)
       ↓
  ┌────────────────────────────────┐
  │ user-service  │  ride-service  │
  │ (4001)        │  (4002)        │
  │               │                │
  │ location-svc  │  notif-svc     │
  │ (4003)        │  (4005)        │
  └────────────────────────────────┘
       ↓              ↓
    MongoDB         Redis
```
