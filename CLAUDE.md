# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Titilatte** is a full-stack minimarket management platform (POS, inventory, purchasing, credit management). It follows a **Modular Monolith** architecture (ADR-001) — single deployment unit, packages organized by bounded context, designed for future microservices extraction if needed.

- **Backend:** Java 21 + Spring Boot 3.3.5 (REST API)
- **Frontend:** React 18 + TypeScript + Vite 5 (SPA)
- **Database:** PostgreSQL 16 (with RLS, triggers, JSONB)
- **Reverse proxy:** Nginx 1.27-alpine
- **Orchestration:** Docker Compose v2.20+

## Development Commands

### Full Stack via Docker (recommended)
```bash
cd infra
cp .env.example .env          # fill in secrets first
bash scripts/start-dev.sh     # validates prereqs, starts all 4 services with hot reload
docker compose down           # stop all services
```

### Backend (Java 21 / Maven)
```bash
# From host (requires Java 21)
cd backend
./mvnw test                   # run all tests
./mvnw test -Dtest=ClassName  # run a single test class
./mvnw verify                 # tests + JaCoCo coverage report
./mvnw checkstyle:check       # lint
./mvnw package -DskipTests    # build JAR

# Inside container
docker compose exec backend ./mvnw test
```

### Frontend (React / npm)
```bash
# From host (requires Node.js 20)
cd frontend
npm test                      # Vitest (watch mode)
npm test -- --run             # single pass, no watch
npm run test:coverage         # coverage report
npm run test:ui               # Vitest UI browser interface
npm run build                 # production build
npx eslint src --max-warnings 0

# Inside container
docker compose exec frontend npm test
```

### Database
```bash
# Backups / restore
bash infra/scripts/backup-postgres.sh
bash infra/scripts/restore-postgres.sh

# Flyway repair (checksum mismatch)
docker compose exec backend ./mvnw flyway:repair
```

## Architecture

### Module Structure (12 modules, 4 phases)

| Phase | Modules |
|-------|---------|
| **1 — Core** | Auth, Products, Sales, Stock |
| **2 — Operations** | Purchases (+ Suppliers), Cash registers, Customers credit, Reports |
| **3 — Real-time & Audit** | SSE alerts, Audit log, Dashboard (role-polymorphic), Caffeine cache |
| **4 — Multi-branch** | Branches catalog, PostgreSQL Row-Level Security on 9 tables |

Backend package layout: `com.titilatte.<module>.{controller, service, repository, domain, dto}`

### API Design
- Base URL: `http://localhost/api/v1` (Nginx proxy)
- Auth: `Authorization: Bearer <jwt>` (15 min access token) + `POST /auth/refresh` (7 day refresh, stored hashed as SHA-256)
- SSE streams use query param `?token=<jwt>` (EventSource limitation)
- Rate limit: Nginx `limit_req` on `/api/auth/*` — 5 req/min per IP
- Role hierarchy: `ADMIN > SUPERVISOR > CAJERO > BODEGA`
- Excel export: Apache POI, binary stream with `Content-Disposition` header

### Database Conventions
- Migrations: Flyway versioned SQL files at `backend/src/main/resources/db/migration/V*.sql`
- **Never modify existing migration files** — always create a new `V{N+1}__description.sql`
- Atomic stock: PL/pgSQL `fn_apply_stock_movement` with `SELECT FOR UPDATE` pessimistic locking
- Multi-branch isolation: PostgreSQL RLS via `current_setting('app.current_branch_id')`, set in each request via `SET LOCAL`
- Audit log is immutable at DB level: `REVOKE UPDATE DELETE ON audit_log FROM PUBLIC`
- Integration tests **require real PostgreSQL** (not H2) because of PL/pgSQL triggers

### Key Architectural Decisions (see docs/ARCHITECTURE.md for full ADR list)
- **ADR-001:** Modular monolith over microservices for Phase 1–3
- **ADR-002:** PostgreSQL RLS for multi-tenant isolation (Phase 4), not application-layer filtering
- **ADR-003:** Caffeine in-memory cache (no Redis) — products-catalog: 5 min TTL, dashboard-kpis: 15 s TTL
- **ADR-004:** Immutable audit log (DB-level `REVOKE`), written via `Propagation.REQUIRES_NEW` so failures never roll back the main transaction
- **ADR-005:** SSE capped at 500 concurrent connections; HEARTBEAT event every 30 s

### Docker Compose Files
| File | Purpose |
|------|---------|
| `infra/docker-compose.yml` | Base: postgres, backend, frontend, nginx |
| `infra/docker-compose.override.yml` | Dev: hot reload, port 5432 exposed, JVM debug :5005 |
| `infra/docker-compose.staging.yml` | Staging: prod profile, Grafana + Prometheus monitoring |

## Environment & Secrets

Template: `infra/.env.example` (committed). Actual: `infra/.env` (git-ignored).

Critical variables to set before first run:
- `POSTGRES_PASSWORD` — min 32 random chars in production
- `JWT_SECRET` — Base64, ≥64 bytes; generate with `openssl rand -base64 64`
- `SPRING_DATASOURCE_URL`
- `VITE_API_URL`

Default seed admin: `admin@minimarket.local` / `Admin1234!` — **must change before any shared or production deployment**.

## CI/CD

Three GitHub Actions workflows in `.github/workflows/`:
- `ci.yml` — PR validation (build + test + checkstyle + ESLint)
- `cd.yml` — Push to `main`: build Docker images, push to `ghcr.io`, SSH deploy to VPS
- `security-scan.yml` — Weekly Trivy + OWASP dependency scan

GitHub secrets required: `SSH_PRIVATE_KEY`, `SSH_HOST`, `SSH_USER`, `GHCR_PULL_TOKEN`, `ENV_FILE`.

## Documentation

| File | Content |
|------|---------|
| `docs/ARCHITECTURE.md` | 13 ADRs, C4 diagrams, auth and POS flow diagrams |
| `docs/MODULES.md` | Per-module entities, business rules, endpoints, DB tables, concurrency notes |
| `docs/API.md` | Full REST reference: 50+ endpoints, request/response schemas, error codes |
| `docs/DEPLOYMENT.md` | Local dev, staging setup, backups, troubleshooting, pre-prod checklist |
| `infra/SECURITY_CHECKLIST.md` | Pre-production hardening checklist |
