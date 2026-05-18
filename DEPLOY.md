# Deployment Guide

This project can be deployed without Docker. For the current handover, that is the recommended path because it is simpler to validate on an internal server.

## Recommended Deployment Mode

- Node.js + MySQL on the server
- No Docker required

## Prerequisites

Install or confirm the following on the target server:

- Node.js
- npm
- MySQL

Check versions:

```bash
node -v
npm -v
mysql --version
```

## Step 1: Get the Source Code

Clone the repository:

```bash
git clone https://github.com/punnawichplub2547-boop/my-itapp.git
cd my-itapp
```

## Step 2: Create the MySQL Database

Open MySQL and create a fresh database:

```sql
CREATE DATABASE repairlink;
USE repairlink;
```

Then create the required tables using:

- `docs/device-database.md`
- `docs/repair-ticket-database.md`
- `docs/migrations/create_device_repair_events.sql`

If you want ticket numbers to start fresh, use a new empty database and do not import old `repair_tickets` data.

## Step 3: Prepare Environment Variables

Create a `.env.production` file based on `.env.production.example`.

Minimum required values:

```env
DEVICE_REPOSITORY=mysql
DATABASE_URL=mysql://root:yourpassword@127.0.0.1:3306/repairlink

AUTH_ADMIN_USERNAME=admin
AUTH_ADMIN_PASSWORD=change-me
AUTH_SESSION_SECRET=change-me-to-a-long-random-secret

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM=RepairLink <noreply@example.com>
```

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Build the App

```bash
npm run build
```

## Step 6: Start the App

```bash
npm run start
```

By default, the app runs on port `3000`.

Open:

- `http://<server-ip>:3000`

## Step 7: Validation Checklist

After starting the app, verify:

1. Login works
2. Dashboard opens
3. Device Inventory loads from MySQL
4. Create Repair Request works
5. Repair Status opens and ticket status updates work
6. Reports opens
7. Warranty Audit opens

## Optional: Run as a Long-Lived Process

Recommended option:

```bash
npm install -g pm2
pm2 start npm --name repairlink -- run start
pm2 save
```

Useful commands:

```bash
pm2 list
pm2 logs repairlink
pm2 restart repairlink
```

## Optional: Docker

Docker support files already exist:

- `Dockerfile`
- `.dockerignore`

Docker is optional and not required for current handover.
