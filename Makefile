.PHONY: up down build logs restart clean install

# ─── Docker ──────────────────────────────────────────────────
up:
	docker compose up

up-build:
	docker compose up --build

down:
	docker compose down

down-volumes:
	docker compose down -v

build:
	docker compose build

logs:
	docker compose logs -f

logs-users:
	docker compose logs -f user-service

logs-gateway:
	docker compose logs -f api-gateway

restart:
	docker compose restart

clean:
	docker compose down -v --rmi local

# ─── Local dev (without Docker) ──────────────────────────────
install:
	cd services/user-service && npm install
	cd services/api-gateway && npm install
	cd apps/rider-app && npm install
	cd apps/driver-app && npm install

dev-users:
	cd services/user-service && cp .env.example .env && npm run dev

dev-gateway:
	cd services/api-gateway && cp .env.example .env && npm run dev

dev-rider:
	cd apps/rider-app && npm run dev

dev-driver:
	cd apps/driver-app && npm run dev

# ─── Helpers ──────────────────────────────────────────────────
health:
	curl http://localhost:4000/health | jq
	curl http://localhost:4001/health | jq
