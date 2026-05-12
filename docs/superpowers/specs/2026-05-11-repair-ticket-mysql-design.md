# Repair Ticket MySQL Design

## Goal

Make `Create Repair Request` save real repair ticket data and make `Repair Status` read and update that same saved data. The existing `Repair Status` UI should stay largely intact, while status buttons and ticket detail interactions should operate against persisted ticket records instead of `MOCK_TICKETS`.

## Current State

- `CreateRequestForm` now reads live device inventory data for department, model, assigned user, and priority selection.
- `app/api/tickets/route.ts` validates create-ticket input and emits notification events, but it does not persist tickets.
- `app/api/tickets/[ticketId]/status/route.ts` validates status changes and emits notification events, but it does not persist updated status.
- `TicketManagementCenter` still renders `MOCK_TICKETS`.
- Device data already uses MySQL and shared app state.

## Scope

In scope:

- Persist repair tickets in MySQL.
- Load persisted repair tickets into shared app state.
- Submit `Create Repair Request` through the existing `/api/tickets` route and save the created ticket.
- Replace `Repair Status` mock ticket reads with real saved tickets.
- Make ticket status action buttons update the saved ticket and refresh the UI.
- Preserve the current `Repair Status` layout and modal structure as much as possible.

Out of scope:

- Reworking the overall `Repair Status` design.
- Replacing report demo data.
- Adding a full attachment upload system.
- Persisting email notification history as a first-class table.
- Large refactors outside ticket creation, ticket persistence, and ticket status flow.

## Recommended Architecture

Use a MySQL-backed ticket repository with one denormalized `repair_tickets` table.

Reasons:

- Matches the current device architecture.
- Provides real persistence across refreshes.
- Keeps the current `RepairTicket` UI shape usable with minimal transformation.
- Lets the existing notification routes keep their role while adding storage.

Not chosen:

- Local JSON/demo-file storage, because it weakens the "real data" requirement.
- Client-only state, because it breaks on refresh and does not support shared saved data.

## Data Model

Add a MySQL `repair_tickets` table with columns aligned to the existing `RepairTicket` type.

Required columns:

- `id` primary key
- `device_name`
- `employee_name`
- `employee_email`
- `department`
- `problem_type`
- `description`
- `status`
- `priority`
- `created_at`
- `notes_json`
- `history_json`
- `attachments_json`
- `updated_at`

Storage rules:

- `id` uses the existing `TK-...` ticket identifier format.
- `status` uses the current values:
  - `Pending`
  - `In Progress`
  - `Waiting for Parts`
  - `Completed`
  - `Closed`
- `priority` uses the current values:
  - `Low`
  - `Medium`
  - `High`
  - `Critical`
- `notes_json`, `history_json`, and `attachments_json` store JSON arrays serialized as text or JSON columns depending on current MySQL support in the project environment.

Why JSON fields:

- The current modal already expects arrays for notes, history, and attachments.
- This preserves the existing UI contract without introducing multiple child tables in the same change.

## Backend Design

Create a ticket repository layer similar in role to the device repository.

Suggested responsibilities:

- `listTickets()`
- `createTicket(ticket)`
- `updateTicketStatus(ticketId, nextStatus, actorEmail)`
- `findTicketById(ticketId)`

Route changes:

### `POST /api/tickets`

- Keep the current request validation.
- Build the `RepairTicket` object in the same shape as today.
- Persist the ticket before scheduling notification dispatch.
- Return the saved ticket from storage.

### `GET /api/tickets`

- Add a list endpoint in the same route file so the app can load saved tickets on startup.
- Return tickets newest-first.

### `PATCH /api/tickets/[ticketId]/status`

- Keep the current validation and notification event behavior.
- Replace the in-memory-only update with a persisted update.
- Append a new history event when status changes.
- Return the updated saved ticket.

## Frontend Design

### Shared App State

`RepairLinkApp` should load tickets from `/api/tickets` the same way it already loads devices from `/api/devices`.

Add shared ticket state:

- `tickets`
- `setTickets`

This state becomes the source of truth for:

- `CreateRequestForm`
- `TicketManagementCenter`

### Create Repair Request

`CreateRequestForm` should:

- keep the current style and field layout
- preserve current validation expectations from the route
- submit to `POST /api/tickets`
- on success:
  - append the returned ticket into shared state
  - navigate to `Repair Status`
  - show the created ticket in the `Repair Status` list
  - do not auto-open the detail modal unless the existing UI already supports it

### Repair Status

`TicketManagementCenter` should:

- accept `tickets` and update callbacks as props instead of reading `MOCK_TICKETS`
- preserve the current table and modal layout as much as possible
- continue filtering tickets by tab using the saved ticket status
- keep search and sort UI intact, even if sort remains presentation-only for now

## Status Button Behavior

Buttons in the ticket detail modal should work against the persisted ticket state.

Rules:

- Clicking the current status does nothing.
- Clicking a different allowed status:
  - sends `PATCH /api/tickets/[ticketId]/status`
  - updates the shared ticket state with the saved response
  - updates the detail modal immediately
  - appends a history event row

Intended status behavior:

- `Pending` -> newly created ticket default
- `In Progress` -> active work started
- `Waiting for Parts` -> blocked on parts or external dependency
- `Completed` -> work finished, awaiting closure or handoff
- `Closed` -> final state

Notification behavior:

- Preserve the existing notification event dispatch.
- Continue using the current event routing for employee notifications on status changes and close events.

## Repair Status UI Preservation

Keep these elements visually and structurally stable:

- ticket table layout
- tab layout
- ticket detail modal layout
- quick status shift control area
- email preview and history sections

Allowed data-source changes inside the current UI:

- notification history can remain derived from existing demo notification data if there is no persisted notification store yet
- ticket rows, status pills, employee details, and modal fields must come from saved ticket data

## Validation And Error Handling

Preserve existing validation:

- create-ticket route still requires:
  - `deviceName`
  - `employeeName`
  - `employeeEmail`
  - `department`
  - `problemType`
  - `description`
- priority remains optional at the API layer with default `Medium`

Additional runtime behavior:

- create form should surface API errors without changing page structure
- status update failures should leave the current displayed status unchanged
- ticket list load failures should degrade safely to an empty list state instead of crashing the page

## Testing Strategy

Add tests first, then implement.

Backend tests:

- creating a ticket persists it and returns the saved row
- listing tickets returns persisted tickets
- updating status persists the new status and appends history
- duplicate or malformed data still follows the current validation rules

Frontend tests:

- `CreateRequestForm` submits to `/api/tickets` and handles success
- successful create updates shared ticket state and routes to `Repair Status`
- `Repair Status` shows the newly created ticket in the list
- `TicketManagementCenter` renders passed-in real tickets instead of `MOCK_TICKETS`
- status buttons call the status API and update the rendered ticket state

## Files Expected To Change

Likely files:

- `app/RepairLinkApp.tsx`
- `app/views/CreateRequestForm.tsx`
- `app/views/TicketManagementCenter.tsx`
- `app/api/tickets/route.ts`
- `app/api/tickets/[ticketId]/status/route.ts`
- `app/types.ts`
- new ticket repository / MySQL helper files under `app/lib`
- focused tests for ticket create and status flow

Likely files not to change:

- device inventory feature files outside shared app-state wiring
- report views
- add-device form beyond any already-completed work

## Success Criteria

- A newly created repair request is saved to MySQL.
- After successful create, the app navigates to `Repair Status` and shows the created ticket in the list.
- The detail modal is not auto-opened unless the existing UI already supports that behavior.
- Refreshing the app still shows the saved ticket in `Repair Status`.
- `Repair Status` renders real submitted ticket data instead of mock tickets.
- Quick status buttons persist changes and update the UI correctly.
- Existing ticket notification routing still works.
- Unrelated device and report behavior remains unchanged.
