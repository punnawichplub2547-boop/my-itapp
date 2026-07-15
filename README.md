# IT System

IT System is an internal admin web app for IT repair-request tracking and device inventory management.

The project is built with Next.js and MySQL, and is intended primarily for administrator use rather than employee self-service.

## Current Scope

The app currently supports:

- Admin login
- Dashboard overview
- Device Inventory
- Add New Device
- Create Repair Request
- Repair Status management
- Reports for completed/closed tickets
- Read-only Warranty Audit

## Tech Stack

- Next.js 16
- React 19
- Node.js
- MySQL

Docker files are included as an optional deployment path, but Docker is not required.

## Local Development

Prerequisites:

- Node.js
- MySQL

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Files

Use these example files as references:

- `.env.example` for local development
- `.env.production.example` for server deployment
- `.env.docker.local.example` for Docker Compose deployment

Do not commit or hand over real local secret files such as:

- `.env.local`
- `.env.docker.local`

## Database Setup

Core database references:

- `docs/device-database.md`
- `docs/repair-ticket-database.md`

Related migration scripts:

- `scripts/migrate-add-warranty-alerted-at.ts`
- `scripts/migrate-add-completed-at.ts`

## Deployment

Recommended handover path for this project:

- Non-Docker deployment on an internal server with Node.js + MySQL

Deployment steps are documented in:

- `DEPLOY.md`
- `HANDOVER.md`

### Docker Compose

Create `.env.docker.local` from `.env.docker.local.example`, then run:

```bash
docker compose up -d --build
```

The Compose service uses `restart: unless-stopped`, so Docker will keep the web app running after crashes and start it again after a machine reboot unless the container is manually stopped.

By default, Docker Compose publishes the app on server port `18080`:

Open `http://<server-ip>:18080`.

To use a different server port, set `APP_PORT` when starting Compose.

## Scripts

- `npm run dev` starts the development server
- `npm run build` creates a production build
- `npm run start` serves the production build
- `npm run lint` runs ESLint
- `npm test` runs the test suite
