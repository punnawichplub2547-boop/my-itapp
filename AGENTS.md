<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This project uses Next.js 16.2.6 and React 19.2.4. APIs, conventions, and file structure may differ from older Next.js versions. Before writing code that touches Next.js routing, route handlers, cookies, `after()`, caching, Turbopack, or config behavior, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.

Useful local docs for this repo:
- `node_modules/next/dist/docs/01-app/index.md`
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`
<!-- END:nextjs-agent-rules -->

# RepairLink Agent Guide

## Project Identity

RepairLink is an internal IT support and asset management web app for IT administrators. It is not a public customer portal.

The app manages:
- Admin login and protected dashboard access.
- Device inventory records backed by workbook-shaped fields.
- Add New Device.
- Create Repair Request.
- Repair Status management.
- Monthly ticket reports by ticket creation date.
- Read-only Warranty Audit.
- Device detail repair logs, including persisted repair events.

## Stack And Runtime

- Next.js `16.2.6` App Router.
- React `19.2.4`.
- TypeScript.
- Tailwind CSS via `app/globals.css`.
- Motion via `motion/react`.
- Icons via `lucide-react`.
- MySQL via `mysql2`.
- Excel import/export via `xlsx` and `exceljs`.
- Tests use Node's built-in test runner with `tsx`, not Jest or Vitest.
- Docker deploy uses the root `Dockerfile` and `docker-compose.yml`.

Node requirements follow Next.js 16: use Node `20.9+`. The Docker image uses `node:22-alpine`.

## Commands

Use these from the repo root:

```bash
npm install
npm run dev
npm test
npm run build
npm run lint
```

On Windows PowerShell, if `npm` is blocked by execution policy, use `npm.cmd`:

```bat
npm.cmd test
npm.cmd run build
```

The test script is:

```bash
node --import tsx --test-concurrency=1 --test "app/**/*.test.ts"
```

## Routing And UI Shell

The route structure is App Router based:

- `/` renders `app/page.tsx`, checks the session cookie, and redirects authenticated users to `/dashboard`.
- `/dashboard` renders `app/dashboard/page.tsx`, requires auth, and mounts `RepairLinkApp` with `initialView="dashboard"`.
- `/dashboard/[...slug]` maps dashboard slugs to `ViewType` values and passes optional `ticket`, `q`, and `device` search params into `RepairLinkApp`.

`app/RepairLinkApp.tsx` is the main client shell. It owns:
- Sidebar navigation.
- Loading `/api/devices` and `/api/tickets`.
- Global search across devices, tickets, and warranties.
- View switching and route pushes.
- Ticket/device state updates after mutations.

Do not introduce a separate top-level dashboard shell unless the requested change truly requires it. Prefer extending the existing `RepairLinkApp` flow.

## Auth Model

Auth is intentionally simple and admin-only:

- Login route: `app/api/auth/login/route.ts`.
- Logout route: `app/api/auth/logout/route.ts`.
- Auth/session helpers: `app/lib/auth/mockUser.ts`.
- Cookie name: `repairlink_session`.
- Session tokens are HMAC signed.
- API auth guard: `requireAuthenticatedRequest`.
- In `NODE_ENV=test`, API auth is bypassed for tests.
- In production, admin credentials must come from environment variables.

Important environment variables:
- `AUTH_ADMIN_USERNAME`
- `AUTH_ADMIN_PASSWORD`
- `AUTH_SESSION_SECRET`
- `AUTH_COOKIE_SECURE`

For internal HTTP deployments, `AUTH_COOKIE_SECURE=false` may be required. Do not hardcode production credentials.

## Data Model Contracts

Core types live in `app/types.ts`.

Device identity:
- `deviceId` is the stable primary identity.
- Do not replace it with generated IDs.
- Assignment is mutable metadata in `assignedTo`; changing assignment must not change device identity.

Device statuses:
- `Active`
- `Inactive`
- `Out of Service`

Create-device UI currently allows only these device types:
- `Notebook`
- `PC`
- `Server`

Ticket statuses:
- `Pending`
- `In Progress`
- `Waiting for Parts`
- `Completed`
- `Closed`

Ticket priorities:
- `Low`
- `Medium`
- `High`
- `Critical`

## Persistence

MySQL is the intended persistent backend.

Database connection:
- `app/lib/db/mysql.ts`
- Uses `DATABASE_URL` if present.
- Otherwise uses `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_CONNECTION_LIMIT`.

Device service:
- `app/lib/devices/deviceService.ts`
- Main repository interface: `DeviceRepository`.
- MySQL implementation: `MySqlDeviceRepository`.
- File/demo implementation exists for non-production/demo paths.
- In production without DB config, device routes should return a configuration error instead of silently using demo storage.

Ticket service:
- `app/lib/tickets/ticketService.ts`
- Main repository interface: `TicketRepository`.
- MySQL implementation: `MySqlTicketRepository`.
- Status transitions use transactional row locking and stale-status conflict detection.
- `completedAt` is set when tickets move to `Completed` or `Closed`.

Database docs:
- `docs/device-database.md`
- `docs/repair-ticket-database.md`
- `docs/migrations/create_device_repair_events.sql`
- `docs/migrations/add_device_id_to_repair_tickets.sql`

## API Routes

All important mutation routes use `runtime = 'nodejs'`.

Devices:
- `GET /api/devices` lists devices and syncs warranty alert timestamps.
- `POST /api/devices` creates a device.
- `PATCH /api/devices/[deviceId]` updates status or assignment.
- `DELETE /api/devices/[deviceId]` deletes a device.
- `GET /api/devices/export` exports filtered inventory to Excel.
- `GET /api/devices/[deviceId]/repair-events` lists persisted repair events.

Tickets:
- `GET /api/tickets` lists tickets.
- `POST /api/tickets` creates a ticket.
- `PATCH /api/tickets/[ticketId]` adds a note.
- `DELETE /api/tickets/[ticketId]` deletes a ticket and writes a best-effort device repair event.
- `PATCH /api/tickets/[ticketId]/status` transitions status with stale update protection.
- `POST /api/tickets/[ticketId]/attachments` uploads image attachments.
- `DELETE /api/tickets/[ticketId]/attachments/[attachmentId]` removes attachments.
- `POST /api/tickets/[ticketId]/notify` sends an employee notification for a ticket.

Reports:
- `GET /api/reports?month=YYYY-MM` lists tickets created in the selected report month across every status.
- `GET /api/reports/export?month=YYYY-MM` exports the selected report month to Excel and may include explicit cross-month ticket IDs with repeated `includeTicketId` query params.
- `POST /api/reports/cleanup` deletes completed tickets older than 60 days.

When adding API work, keep the same response style: JSON for normal API responses, explicit status codes for validation/auth/conflict errors, and `Response`/`NextResponse` only as appropriate for the route.

## Repair Request Flow

The repair request form is `app/views/CreateRequestForm.tsx`.

Current behavior:
- Department is a free-text input with inventory-backed datalist suggestions.
- Device Name is a free-text/creatable input with inventory-backed datalist suggestions.
- Selecting a known Device Name shows its Device Model in a read-only companion field.
- Assigned To is a free-text/creatable input.
- Employee Email is manually editable.
- A unique matching inventory device may set `deviceId` for confirmed linking, but `deviceId` is optional.
- Unregistered, external, temporary, and special repair jobs must still be accepted.

Payload mapping is important:

```ts
{
  deviceId,
  deviceName: deviceName.trim(),
  employeeName: assignedTo.trim(),
  employeeEmail: employeeEmail.trim(),
  department: department.trim(),
  problemType: problemType.trim(),
  description: description.trim(),
  priority
}
```

Do not reintroduce requirements for `selectedDeviceId`, `selectedEmployeeId`, or inventory-only values.

## Search And Warranty Logic

Search:
- `app/lib/search/appSearch.ts`.
- Builds grouped results for devices, tickets, and warranties.
- `buildAppSearchGroups` accepts optional `{ now?: Date }` for deterministic warranty tests.
- Do not write tests that depend on the machine's current date unless the behavior under test is explicitly date-current.

Warranty:
- `app/lib/devices/warrantyAlerts.ts`.
- Expiring soon window is 30 days.
- Visible alert window is 7 days.
- Dates are normalized to UTC day boundaries.
- Supported date inputs include ISO `YYYY-MM-DD`, Excel serial dates, and `DD/MM/YYYY`.
- Warranty Audit is read-only and should not mutate inventory.

## Notifications And Email

Notification code lives in `app/lib/notifications/`.

The route handlers create ticket events, then schedule notification dispatch using Next.js `after()` so HTTP responses are not blocked.

Important files:
- `ticketEvents.ts`
- `recipientRouting.ts`
- `notificationJobs.ts`
- `templates.ts`
- `emailClient.ts`
- `emailQueue.ts`
- `eventDispatcher.ts`

Recipient behavior:
- `notifyRecipients` may include `customer`, `employee`, or both.
- `notifyRecipients: []` means a status-only update with no email.
- Recipient emails are normalized and deduplicated.

Attachment emails:
- Ticket attachments are read from `public/uploads/tickets/...` just before sending.
- Upload limits and MIME rules live in `app/lib/tickets/attachmentStorage.ts`.

## Attachments

Ticket image uploads:
- Allowed MIME types: JPG/JPEG, PNG, WebP, GIF.
- Max size: 5 MB.
- Stored under `public/uploads/tickets/<ticketId>/`.
- Stored attachment URLs are `/uploads/tickets/<ticketId>/<uuid>.<ext>`.

Be careful with Docker deployments: files written into the container filesystem are not automatically durable unless a volume is added. Do not assume uploaded files survive container replacement unless deployment has persistent storage configured.

## Excel Import And Export

Device workbook import:
- Script: `scripts/import-devices-from-excel.ts`.
- Parser: `app/lib/devices/excelImport.ts`.
- Default sheet: `F-IT-010 Rev.00(Update)`.
- Header row index: `3`.
- `Name` maps to `deviceId`.
- `No` maps to `assetNo`.
- `IP Address` maps to `ipMode` and `ipAddress`.
- Workbook footer/note rows are skipped.

Exports:
- Device inventory export: `app/lib/devices/excelExport.ts`.
- Repair report export: `app/lib/reports/excelExport.ts`.
- Report styling may use workbook template helpers in `app/lib/reports/excelTemplate.ts`.
- `next.config.ts` conditionally includes `F-IT-010 Rev.01.xlsx` in output file tracing when it exists.

## UI Guidance

This is an internal operations app. Keep UI changes restrained, dense, and consistent with the existing admin dashboard style.

Current style:
- Sidebar + top search shell.
- White work surfaces with `outline-variant` borders.
- Blue primary palette from `app/globals.css`.
- Rounded panels are common in existing views.
- Icons come from `lucide-react`.
- Motion uses `motion/react`.

When modifying UI:
- Preserve existing layout and visual language unless the user explicitly asks for redesign.
- Prefer behavior/state fixes over broad visual rewrites.
- Keep forms ergonomic for admin users and repeated operational use.
- Keep route state, query params, and parent state callbacks in sync.
- For existing forms, ensure displayed values are the same values submitted to the API.

## Testing Expectations

Tests are colocated under `app/**/*.test.ts` and `app/**/*.test.tsx`.

Coverage includes:
- Auth/session token behavior.
- API route validation and auth guards.
- Device and ticket service behavior.
- MySQL repository mapping and status transition conflict handling.
- Warranty date/lifecycle logic.
- Search grouping and scoring.
- Notification recipient/job/template behavior.
- View helper behavior for Create Request, Add Device, Inventory, Dashboard, Reports, Warranty Audit, and Ticket Management.

Before claiming a change is complete, run the smallest relevant test first, then the full suite when the change is not trivial:

```bash
npm.cmd test
npm.cmd run build
```

Use `npm test` and `npm run build` on shells where `npm` is not blocked.

## Deployment

Environment examples:
- `.env.example`
- `.env.production.example`
- `.env.docker.local.example`

Never commit real secrets:
- `.env`
- `.env.local`
- `.env.production`
- `.env.docker.local`

Docker:
- `Dockerfile` builds a production Next.js app.
- `docker-compose.yml` defines service `app`.
- Image name: `my-itapp:latest`.
- Container name: `my-itapp`.
- Restart policy: `unless-stopped`.
- Default published port: `18080` on the host to `3000` in the container.
- Compose reads `.env.docker.local`.
- `host.docker.internal` is mapped with `host-gateway` for host MySQL access.

Server update flow:

```bash
cd D:\IT\my-itapp
git pull origin master
docker compose up -d --build
```

Expected URL in the current server setup:

```text
http://10.255.255.173:18080
```

If using a hosts file alias on a machine:

```text
10.255.255.173 repairlink.car-1996.com
```

Then open:

```text
http://repairlink.car-1996.com:18080
```

## Operational Notes

- Existing server may run other containers on ports `80`, `3000`, `3001`, and others. Do not assume port `80` is free.
- If port `18080` is already allocated, inspect `docker ps` before changing Compose.
- The previous one-off container name `repairlink` may conflict with Compose if it still owns port `18080`; stop/remove it only after confirming it is the old RepairLink container.
- Docker Compose should now own the production RepairLink container.

## Development Rules For Agents

- Start by checking `git status --short --branch`.
- Do not overwrite user changes.
- Keep edits scoped to the request.
- Use `rg` for search.
- Use `apply_patch` for manual edits.
- Keep ASCII in code and docs unless editing existing Thai/user-facing text that requires Thai.
- Avoid committing generated files, logs, `.next`, `node_modules`, uploads, or real env files.
- Do not add new dependencies without a clear reason.
- Prefer repository/service helpers over duplicating SQL or business rules in components.
- Keep API auth behavior intact unless explicitly requested.
- Preserve the optional/unregistered-device repair request flow.
- For date-sensitive logic, inject `now` or use fixed dates in tests.
- For Next.js route handlers with dynamic params, remember that `params` is a Promise in this version.
- For async post-response side effects, use `after()` according to the local Next.js docs.
