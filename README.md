# Smart Campus Operations Hub (IT3030 PAF 2026)

Full-stack **Smart Campus Operations Hub**: Spring Boot REST API + **React (JavaScript / JSX)** SPA for facility/asset catalogue, booking workflow with conflict checks, maintenance tickets (with image attachments and comments), in-app notifications, and **OAuth 2.0 (Google)** with **USER / ADMIN / TECHNICIAN** roles.

## Prerequisites

- **JDK 17+** and **Maven 3.9+**
- **Node.js 20+** (for the React client)
- **Google Cloud OAuth client** (optional for local dev; see below)

## Run locally

### 1. API (Spring Boot)

From the `backend` folder:

```bash
# H2 file database + dev login + sample data (recommended for coursework demo)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

The API listens on **http://localhost:8080**.

Environment variables (optional):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Real Google OAuth (replace placeholders in `application.yml`) |
| `FRONTEND_URL` | OAuth success redirect (default `http://localhost:5173`) |
| `SERVER_PORT` | API port (default set to `8080` in local env file) |
| `DATABASE_URL` | JDBC URL (default embedded H2 file under `backend/data/`) |
| `DATABASE_USER` / `DATABASE_PASSWORD` | Database credentials (used in `postgres` profile) |

**Development profile** (`dev`):

- `POST /api/auth/dev-login` — sign in without Google (JSON: `email`, `name`, `role`: `USER` | `ADMIN` | `TECHNICIAN`).
- Seeds sample **campus resources** and ensures `admin@campus.local` / `tech@campus.local` exist (you still sign in via dev-login with those emails if you want fixed accounts).

### Optional: PostgreSQL instead of H2 (no Docker)

Install PostgreSQL locally and create:

- Database: `smartcampus`
- User: `smartcampus`
- Password: `smartcampus`

Then run API with postgres profile (PowerShell):

```powershell
cd backend
.\start-postgres.cmd
```

If you prefer calling the PowerShell script directly, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-postgres.ps1
```

Defaults used by this setup:

- DB: `smartcampus`
- User: `smartcampus`
- Password: `smartcampus`
- JDBC URL: `jdbc:postgresql://localhost:5432/smartcampus`
- API URL: `http://localhost:8080`

### 2. Web client (React + JavaScript)

Source lives under `frontend/src` as **`.jsx`** / **`.js`** files (no TypeScript).

From the `frontend` folder:

```bash
npm install
npm run dev
```

Open **http://localhost:5173** for local dev (keeps OAuth redirect URIs and session cookies aligned).

**Google OAuth (local dev):** The Vite dev server **proxies** `/api`, `/oauth2`, and `/login` to the API (default `http://localhost:8080` via `VITE_DEV_PROXY_TARGET`). That way the session cookie is set for the **same origin** as the React app, and sign-in completes instead of bouncing back to the login page.

- In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), set **Authorized redirect URI** to `http://localhost:5173/login/oauth2/code/google`.
- Leave `VITE_API_URL` **empty** in dev (see `frontend/.env.development`). Only set `VITE_API_URL` if you deploy the built SPA against a separate API host.

- Use **Continue with Google** once OAuth credentials are configured.
- With **`npm run dev`**, the login page also shows **development login** (calls dev-login on the API).

### Troubleshooting: `HTTP ERROR 502` on localhost

In dev, `/api`, `/oauth2`, and `/login` are **proxied** to the API (see `VITE_DEV_PROXY_TARGET` in `frontend/.env.development`, default `http://localhost:8080`). A **502** almost always means the **backend is not running** or is on a **different port** than the proxy target. Start the API first, then reload the page. If you changed the API port, update `VITE_DEV_PROXY_TARGET` to match.

## Main API areas (illustrative)

| Area | Examples |
|------|-----------|
| Auth | `GET /api/auth/me`, `GET /api/auth/csrf`, `POST /api/auth/logout` |
| Resources | `GET/POST/PUT/DELETE /api/resources` (writes: `ADMIN`) |
| Bookings | `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings` (admin), **`PUT /api/bookings/{id}/decision`**, **`DELETE /api/bookings/{id}`** (cancel approved booking) |
| Tickets | Multipart `POST /api/tickets`, `GET` list/detail, **`PUT /api/tickets/{id}`** (status/assign), comments (`POST`/`PATCH`/`DELETE`), attachment `GET` download |
| Notifications | `GET /api/notifications`, `PATCH .../read`, `POST /api/notifications/read-all` |

Full behaviour is implemented in the `com.smartcampus.hub` package (layered controllers → services → JPA).

## GitHub Actions

Workflow **`.github/workflows/ci.yml`** runs `mvn verify` on the backend and `npm run build` on the frontend.

## Team contribution (for your report)

Use the table below (equal split) and replace names with your group. Point to **concrete classes / files** in the report (e.g. `ResourceController`, `CataloguePage.jsx`).

| Member | Module | Backend (examples) | Frontend (examples) | HTTP verbs (examples for “4+ methods”) |
|--------|--------|--------------------|---------------------|----------------------------------------|
| **1** | Facilities & assets (A) | `CampusResource*`, `ResourceController`, search in `CampusResourceService` | `CataloguePage.jsx`, `AdminResourcesPage.jsx` | `GET` list, `POST`, `PUT`, `DELETE` on `/api/resources` |
| **2** | Bookings (B) | `Booking*`, `BookingController`, overlap in `BookingRepository` | `BookingsPage.jsx`, `AdminBookingsPage.jsx` | `POST` create, `GET` mine/list, **`PUT`** decision, **`DELETE`** cancel |
| **3** | Tickets (C) | `Ticket*`, `TicketController`, `FileStorageService`, comments | `TicketsPage.jsx`, `TicketDetailPage.jsx` | `POST` ticket + comments, `GET`, **`PUT`** ticket update, `DELETE` comment |
| **4** | Auth, notifications, roles (D+E) | `SecurityConfig`, OAuth user service, `Notification*`, `AuthController` | `LoginPage.jsx`, `AuthCallbackPage.jsx`, `AuthContext.jsx`, `NotificationsPage.jsx`, `Layout.jsx` (role nav) | e.g. `GET /me`, `POST` logout, `GET` notifications, `PATCH` read |

## Repository naming

Use the naming convention from the brief (e.g. `it3030-paf-2026-smart-campus-groupXX`) when you publish to GitHub.

## Licence

Coursework baseline — adjust for your group’s submission policy.
