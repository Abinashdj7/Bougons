# RideX — Uber-like Platform

A full-stack ride-hailing platform built with a microservices architecture, covering real-time GPS tracking, multi-channel notifications, Stripe payments, and a comprehensive test suite.

---

## Tech Stack

| Layer        | Technology                                        |
|--------------|---------------------------------------------------|
| Frontend     | Next.js 14, React 18, Tailwind CSS, Zustand       |
| Backend      | Node.js 20, Express.js                            |
| Database     | MongoDB 7 (geospatial indexes, Atlas-compatible)  |
| Cache / Queue| Redis 7, BullMQ                                   |
| Real-time    | Socket.io (WebSocket), SSE                        |
| DevOps       | Docker, Docker Compose, GitHub Actions CI/CD      |
| Payments     | Stripe (payment intents, webhooks, refunds)       |
| Maps         | Leaflet + OpenStreetMap / Mapbox                  |
| Testing      | Jest, Supertest, mongodb-memory-server, Cypress   |

---

## Project Structure

```
uber-app/
├── apps/
│   ├── rider-app/            # Next.js — Rider interface          (port 3000)
│   ├── driver-app/           # Next.js — Driver interface         (port 3001)
│   └── admin-app/            # Next.js — Admin dashboard          (port 3002)
├── services/
│   ├── api-gateway/          # Express — Proxy + WebSocket hub    (port 4000)
│   ├── user-service/         # Express — Auth, profiles           (port 4001)
│   ├── ride-service/         # Express — Ride lifecycle           (port 4002)
│   ├── location-service/     # Express — GPS & driver matching    (port 4003)
│   ├── payment-service/      # Express — Stripe                   (port 4004)
│   └── notification-service/ # Express — Email, push, SSE        (port 4005)
├── e2e/                      # Cypress end-to-end tests
├── docker-compose.yml
└── .env
```

---

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev without Docker)

### Run with Docker

```bash
git clone <your-repo>
cd uber-app
cp .env.example .env        # fill in secrets
docker compose up --build
```

### Run a single service locally

```bash
cd services/user-service
npm install
npm run dev
```

### Services

| Service              | URL                       |
|----------------------|---------------------------|
| Rider App            | http://localhost:3000     |
| Driver App           | http://localhost:3001     |
| Admin App            | http://localhost:3002     |
| API Gateway          | http://localhost:4000     |
| User Service         | http://localhost:4001     |
| Ride Service         | http://localhost:4002     |
| Location Service     | http://localhost:4003     |
| Payment Service      | http://localhost:4004     |
| Notification Service | http://localhost:4005     |
| MongoDB              | mongodb://localhost:27017 |
| Redis                | redis://localhost:6379    |

---

## API Reference

All requests route through the API Gateway at `http://localhost:4000`.

### Auth
```
POST  /api/auth/register
POST  /api/auth/login
POST  /api/auth/refresh
POST  /api/auth/logout
GET   /api/auth/me
```

### Profile
```
GET   /api/profile
PUT   /api/profile
PUT   /api/profile/driver
PUT   /api/profile/driver/status
GET   /api/profile/drivers/:id
```

### Rides
```
GET   /api/rides/estimate
POST  /api/rides
GET   /api/rides
GET   /api/rides/:id
PUT   /api/rides/:id/accept
PUT   /api/rides/:id/arriving
PUT   /api/rides/:id/start
PUT   /api/rides/:id/complete
PUT   /api/rides/:id/cancel
POST  /api/rides/:id/rate
```

### Location
```
PUT   /api/location/drivers/update
PUT   /api/location/drivers/status
GET   /api/location/drivers/nearby
GET   /api/location/drivers/:id
GET   /api/location/drivers        (admin)
```

### Payments
```
POST  /api/payments/intent
POST  /api/payments/confirm
GET   /api/payments/history
GET   /api/payments/earnings       (driver)
GET   /api/payments/revenue        (admin)
POST  /api/payments/:id/refund     (admin)
POST  /api/payments/webhook        (Stripe)
```

### Notifications
```
GET   /api/notifications
PUT   /api/notifications/read-all
PUT   /api/notifications/:id/read
DELETE /api/notifications/:id
GET   /api/notifications/preferences
PUT   /api/notifications/preferences
POST  /api/notifications/subscribe
GET   /api/notifications/stream    (SSE)
```

---

## Testing

The project has three layers of automated tests.

### Unit Tests

Co-located with source files. All external dependencies (MongoDB, Redis, Stripe, axios) are mocked with `jest.mock`. Tests focus on controller and service logic in isolation.

```bash
cd services/user-service && npm test
cd services/ride-service && npm test
cd services/location-service && npm test
cd services/payment-service && npm test
```

### Integration Tests

Located in `__tests__/integration/` in each service. Use [`mongodb-memory-server`](https://github.com/nodkz/mongodb-memory-server) to spin up a real in-memory MongoDB instance, so tests hit actual Mongoose models and indexes — no mocking of the database layer. Redis is replaced with a lightweight in-memory `Map`; external HTTP calls (Stripe, axios) remain mocked.

```bash
cd services/user-service          && npm run test:integration
cd services/ride-service          && npm run test:integration
cd services/location-service      && npm run test:integration
cd services/notification-service  && npm run test:integration
```

#### What is covered

| Service              | Scenarios                                                                      |
|----------------------|--------------------------------------------------------------------------------|
| user-service         | Register (rider + driver), duplicate email, login, wrong password, deactivated account, `/me`, refresh cookie, logout + token blacklist |
| ride-service         | Fare estimate, create ride, full lifecycle (searching → accepted → driver_arriving → in_progress → completed), cancel, rate |
| location-service     | Update + persist location, Redis cache, online/offline toggle, nearby geospatial query, admin list |
| notification-service | List, unread count, mark-as-read, mark-all-read, delete, preferences CRUD, internal `/send` endpoint, auth guards |

### End-to-End Tests (Cypress)

Located in `e2e/`. Tests run against the Next.js apps with all backend API calls intercepted by Cypress, so no live services are required. The Electron browser renders the full React UI.

```bash
cd e2e

# Open interactive browser
npx cypress open

# Run headless
npx cypress run

# Run a specific suite
npx cypress run --spec "cypress/e2e/rider/ride-request.cy.js"
```

#### Suites

| Suite                              | Tests | Covers                                                             |
|------------------------------------|-------|--------------------------------------------------------------------|
| `rider/auth.cy.js`                 | 12    | Register, login, logout, protected routes                          |
| `rider/dashboard.cy.js`            | 6     | Dashboard load, ride history, profile nav                          |
| `rider/ride-request.cy.js`         | 7     | Fare estimate, ride confirmation, surge pricing, searching state   |
| `driver/auth.cy.js`                | —     | Driver login and registration                                      |
| `driver/dashboard.cy.js`           | —     | Online/offline toggle, incoming ride request                       |
| `admin/dashboard.cy.js`            | —     | Admin stats, user and ride management                              |

---

## Security (OWASP Top 10)

Security hardening was applied across all services against the OWASP Top 10:

| OWASP Risk | Mitigation |
|---|---|
| **A01 Broken Access Control** | JWT `authenticate` + `authorize(role)` middleware on every protected route; ride ownership checked before returning data; admin-only endpoints isolated |
| **A02 Cryptographic Failures** | Passwords hashed with bcrypt (12 rounds); JWTs signed with separate `JWT_SECRET` / `JWT_REFRESH_SECRET`; `HttpOnly` + `SameSite=Strict` cookie for refresh token; no secrets in logs |
| **A03 Injection** | All user input validated with Joi schemas before reaching controllers; Mongoose parameterised queries; no raw string interpolation into queries |
| **A04 Insecure Design** | Short-lived access tokens (15 min); refresh-token rotation with Redis blacklist; internal service routes protected by `x-internal-secret`, never user JWTs |
| **A05 Security Misconfiguration** | `helmet()` on every service; CORS configured with explicit `ALLOWED_ORIGINS` allowlist; `trust proxy` set correctly behind the gateway |
| **A06 Vulnerable Components** | Dependencies pinned in `package-lock.json`; CI runs `npm audit` on every push |
| **A07 Auth Failures** | Rate limiting (`express-rate-limit`) on `/api/auth/*`; token blacklisting on logout; tampered/expired refresh tokens return 401 (not 500) |
| **A08 Software Integrity** | Docker images built from locked lockfiles; GitHub Actions uses pinned action versions |
| **A09 Logging Failures** | Winston structured logging across all services; raw JWTs and secrets are never logged or stored beyond the auth handshake |
| **A10 SSRF** | Internal service-to-service calls use explicit allow-listed base URLs from env vars; user-supplied URLs are never forwarded |

---

## Clean Code Principles

The codebase follows KISS and SOLID throughout:

### Single Responsibility
- Controllers handle only HTTP request/response — all business logic lives in service modules.
- The API gateway is a pure routing and WebSocket hub; it calls location-service via internal REST endpoints rather than owning any location state.
- Internal routes (notification-service `/internal/send`, location-service `/internal/drivers/:id/*`) are in their own router files, mounted separately from the user-facing API.

### Open/Closed
- Auth middleware (`authenticate`, `authorize`, `authenticateInternal`) can be composed onto any route without touching the middleware implementation.
- Fare calculation (`fareCalculator.js`) is a pure function — surge multiplier and breakdown logic are extended by passing different inputs, not by branching inside the function.

### Dependency Inversion
- Service modules depend on injected Mongoose models and utility helpers, not on concrete infrastructure (Redis, HTTP clients) directly.
- The API gateway uses `x-internal-secret` for all service-to-service calls, removing the dependency on short-lived user JWTs that would expire mid-connection.

### KISS / DRY
- `onlyDriver(handler)` in `api-gateway/src/socket.js` centralises the driver role guard that previously appeared in every socket event handler.
- `setDriverStatus(driverId, isOnline)` and `persistDriverLocation(driverId, …)` are named helpers that replace three copy-pasted `axios.put` blocks.
- `explicitlyOffline` flag prevents the `disconnect` handler from sending a duplicate PUT when the driver already called `driver:offline` before closing the connection.

---

## Architecture

```
Rider App (3000)    Driver App (3001)    Admin App (3002)
         \                |                /
          └───────────────┴───────────────┘
                          │
                   API Gateway (4000)
                   WebSocket Hub
                          │
         ┌────────────────┼─────────────────┐
         │                │                 │
   user-service     ride-service    location-service
     (4001)           (4002)            (4003)
         │                │                 │
         └────────────────┼─────────────────┘
                          │
             notification-service  payment-service
                  (4005)               (4004)
                          │
                   ┌──────┴──────┐
                MongoDB         Redis
```

### Service communication

- **Client → Services**: All traffic via API Gateway (HTTP proxy + WebSocket)
- **Service → Service**: Internal REST calls authenticated with `x-internal-secret`; never forwarded user JWTs
- **Real-time**: Socket.io rooms (`user:<id>`, `drivers`, `tracking:<driverId>`) managed by the gateway; driver GPS persisted to location-service on every update

---

## CI/CD

GitHub Actions runs on every push to `main` and every pull request.

| Job                  | What it does                                            |
|----------------------|---------------------------------------------------------|
| `Unit — <service>`   | `npm test` with coverage for ride, user, location, payment services |
| `Integration — <service>` | `npm run test:integration` for all 4 services including notification-service |
| `Build — <app>`      | `npm run lint` + `npm run build` for rider, driver, admin apps |
| `E2E — <app>`        | Cypress headless against the built Next.js app         |

Coverage artifacts and Cypress screenshots on failure are uploaded to GitHub Actions.
