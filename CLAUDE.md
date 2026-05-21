@AGENTS.md

# Claude Working Notes

Use `AGENTS.md` as the canonical project guide. These notes only add Claude-specific reminders and a compact project map.

## Current Project State

RepairLink is live as an internal IT admin app. The current server deployment uses Docker Compose and publishes the app on host port `18080`.

Current server URL:

```text
http://10.255.255.173:18080
```

Optional hosts-file alias used during setup:

```text
10.255.255.173 repairlink.car-1996.com
```

Then browse to:

```text
http://repairlink.car-1996.com:18080
```

## Most Important Local Facts

- Next.js is `16.2.6`; read the relevant docs under `node_modules/next/dist/docs/` before touching Next-specific APIs.
- Main client shell: `app/RepairLinkApp.tsx`.
- Route auth guards live in `app/page.tsx`, `app/dashboard/page.tsx`, and `app/dashboard/[...slug]/page.tsx`.
- Auth/session helpers live in `app/lib/auth/mockUser.ts`.
- Device service: `app/lib/devices/deviceService.ts`.
- Ticket service: `app/lib/tickets/ticketService.ts`.
- Warranty logic: `app/lib/devices/warrantyAlerts.ts`.
- Search logic: `app/lib/search/appSearch.ts`.
- Notification pipeline: `app/lib/notifications/`.
- Docker Compose default host port: `18080`.

## Fixed Historical Issue

The old Create Repair Request payload-mapping issue is no longer the current known issue. The form now maps:

- user-facing `Device Name` input to ticket `deviceName`
- selected inventory device to a read-only `Device Model` display
- `assignedTo` to `employeeName`
- optional matched inventory device to `deviceId`

Do not re-add requirements for inventory-only IDs. Repair requests must still support custom/unregistered devices.

The previous date-sensitive warranty search test has also been fixed. `buildAppSearchGroups` accepts an optional stable `now` value for deterministic warranty search tests.

## Commands

On Windows PowerShell, prefer `npm.cmd` if plain `npm` is blocked:

```bat
npm.cmd test
npm.cmd run build
```

Standard commands:

```bash
npm test
npm run build
npm run lint
```

Server redeploy:

```bat
cd D:\IT\my-itapp
git pull origin master
docker compose up -d --build
```

## Safety Rules

- Never commit real `.env*` files.
- Do not print or preserve secrets from local environment files.
- Do not modify Docker port `18080` unless the user asks.
- Do not disrupt other server containers that may own ports `80`, `3000`, `3001`, or `5000`.
- Uploaded ticket images live under `public/uploads/tickets`; container rebuilds may not preserve them unless persistent storage is configured.
- Run relevant tests and build before reporting success.
