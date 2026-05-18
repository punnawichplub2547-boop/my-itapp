import type { Device, DeviceRepairEvent, RepairTicket } from '../types';
import { getWarrantyLifecycle, parseDeviceDate } from '../lib/devices/warrantyAlerts';

export { parseDeviceDate } from '../lib/devices/warrantyAlerts';

export type DeviceDetailTabKey =
  | 'hardware-os'
  | 'warranty-lifecycle'
  | 'assignment-history'
  | 'repair-log';

export interface DeviceDetailTab {
  key: DeviceDetailTabKey;
  label: string;
}

export interface WarrantySnapshot {
  status: 'active' | 'expiring-soon' | 'expired' | 'unknown';
  headline: string;
  detail: string;
  expirationText: string;
  daysRemainingText: string;
}

export interface AssignmentHistoryRow {
  id: string;
  assetUser: string;
  assetUserMeta: string;
  department: string;
  assignedOn: string;
  returnedOn: string;
  status: string;
}

// TODO: Long-term — store deviceId on RepairTicket and match by deviceId for reliable
// per-asset repair history. Current limitation: all ticket matching is heuristic.
export type MatchConfidence = 'high' | 'medium' | 'low';

export interface MatchedTicket {
  ticket: RepairTicket;
  matchConfidence: MatchConfidence;
  matchReasons: string[];
}

export interface RepairLogEntry {
  id: string;
  title: string;
  eventId: string;
  detail: string;
  timestamp: string;
  technician: string;
  status: string;
  // Undefined on confirmed device events. Set on heuristic ticket-derived entries.
  matchConfidence?: MatchConfidence;
  inferredSource?: string;
}

export const DEVICE_DETAIL_TABS: DeviceDetailTab[] = [
  { key: 'hardware-os', label: 'HARDWARE & OS' },
  { key: 'warranty-lifecycle', label: 'WARRANTY & LIFECYCLE' },
  { key: 'assignment-history', label: 'CURRENT ASSIGNMENT' },
  { key: 'repair-log', label: 'REPAIR LOG' },
];

export function getDeviceDetailHeroTitle(device: Device) {
  return device.deviceId;
}

export function getDeviceDetailHeroSubtitle(device: Device) {
  const parts = [
    device.model || device.deviceType || 'Unknown device',
    device.assetNo ? `Asset #${device.assetNo}` : '',
    device.ipAddress ? `IP: ${device.ipAddress}` : '',
  ].filter(Boolean);

  return parts.join(' • ');
}

export function getWarrantySnapshot(device: Device, now = new Date()): WarrantySnapshot {
  const lifecycle = getWarrantyLifecycle(device, now);
  const expiryDate = lifecycle.expiryDate;

  if (!expiryDate) {
    return {
      status: 'unknown',
      headline: 'Warranty status unavailable',
      detail: 'No parseable lifecycle date is stored for this asset yet.',
      expirationText: device.expireDatePrimary || device.expireDateSecondary || 'Not recorded',
      daysRemainingText: 'Unknown',
    };
  }

  const normalizedExpiry = new Date(expiryDate);
  normalizedExpiry.setUTCHours(0, 0, 0, 0);
  const daysRemaining = lifecycle.daysRemaining ?? 0;

  return {
    status: lifecycle.state,
    headline:
      lifecycle.state === 'expired'
        ? 'Warranty status: expired'
        : lifecycle.state === 'expiring-soon'
        ? 'Warranty status: expiring soon'
        : 'Warranty status: active',
    detail:
      lifecycle.state === 'expired'
        ? 'Support for this asset has expired. Review lifecycle risk before the next hardware issue.'
        : lifecycle.state === 'expiring-soon'
        ? 'Warranty coverage is nearing its end within the next 30 days. Review renewal or replacement plans soon.'
        : 'This asset still has active lifecycle coverage based on the stored expiration date.',
    expirationText: formatIsoDate(normalizedExpiry),
    daysRemainingText: `${daysRemaining} days`,
  };
}

export function buildAssignmentHistory(device: Device): AssignmentHistoryRow[] {
  return [
    {
      id: `${device.deviceId}-assignment-current`,
      assetUser: device.assignedTo || 'Unassigned',
      assetUserMeta: device.assignedTo ? deriveAssignmentIdentity(device.assignedTo) : 'No active custodian',
      department: device.department || 'Unspecified',
      assignedOn: formatDateValue(device.updatedAt || device.createdAt || device.installDate),
      returnedOn: device.assignedTo ? 'Active session' : 'Awaiting assignment',
      status: device.assignedTo ? 'In possession' : 'Available',
    },
  ];
}

// TODO: Long-term — add a device_repair_log table (id, deviceId, ticketId?, eventType,
// message, status, createdBy, createdAt) so repair events exist independently of tickets.
// Next iteration: Add device_assignment_history table to replace the current snapshot approach.

// Returns confirmed ticket entries for tickets explicitly linked to this device by deviceId.
// employeeName is the requester (goes to detail), not the technician.
export function buildConfirmedTicketEntries(device: Device, tickets: RepairTicket[]): RepairLogEntry[] {
  const entries: RepairLogEntry[] = [];

  for (const ticket of tickets) {
    if (!ticket.deviceId || ticket.deviceId.trim() !== device.deviceId.trim()) continue;

    const hasDetailedEvents = (ticket.history?.length ?? 0) > 0 || (ticket.notes?.length ?? 0) > 0;
    const completedLine = ticket.completedAt
      ? ` · Resolved: ${formatDateValue(toDatePart(ticket.completedAt))}`
      : '';

    if (!hasDetailedEvents) {
      entries.push({
        id: `${ticket.id}-confirmed`,
        title: `${ticket.id} — ${ticket.problemType}`,
        eventId: ticket.id,
        detail: `Reported by ${ticket.employeeName}: ${ticket.description}${completedLine}`,
        timestamp: formatDateValue(toDatePart(ticket.createdAt)),
        technician: 'Unassigned',
        status: ticket.status,
      });
    }

    for (const event of ticket.history ?? []) {
      entries.push({
        id: `${ticket.id}-hist-${event.id}`,
        title: `${ticket.id} — ${event.action}`,
        eventId: ticket.id,
        detail: `${event.action} by ${event.user}`,
        timestamp: formatDateValue(toDatePart(event.timestamp)),
        technician: event.user,
        status: ticket.status,
      });
    }

    for (const note of ticket.notes ?? []) {
      entries.push({
        id: `${ticket.id}-note-${note.id}`,
        title: `${ticket.id} — Technician note`,
        eventId: ticket.id,
        detail: note.content,
        timestamp: formatDateValue(toDatePart(note.timestamp)),
        technician: note.author,
        status: ticket.status,
      });
    }
  }

  sortNewestFirst(entries);
  return entries;
}

// Returns only confirmed device-level entries (device.notes). No ticket data.
export function buildDeviceEvents(device: Device): RepairLogEntry[] {
  if (!device.notes) return [];
  return [
    {
      id: `${device.deviceId}-repair-note`,
      title: 'Device note',
      eventId: `LOG-${device.deviceId}`,
      detail: device.notes,
      timestamp: formatDateValue(toDatePart(device.updatedAt) || device.createdAt || device.installDate),
      technician: 'Admin record',
      status: 'Recorded',
    },
  ];
}

// Classify tickets by match confidence against this device.
//
// Matching order — identifiers are checked BEFORE model name:
//   High:   ticket text (description / notes / history) contains a unique device identifier
//           (deviceId or assetNo, min 4 chars) regardless of ticket.deviceName.
//   Medium: ticket.deviceName AND ticket.department both match exactly (no identifier found).
//   Low:    ticket.deviceName matches only (no identifier, no department match).
//
// Model name is NOT a required gate for high-confidence matches. A ticket that correctly
// references this device's identifier is included even if its deviceName field differs.
//
// WARNING: None of these are per-asset guarantees — all are heuristics.
// If multiple assets share the same model, medium/low matches may belong to a different asset.
// TODO: Add deviceId to RepairTicket and match by deviceId for reliable per-asset history.
export function classifyRelatedTickets(device: Device, tickets: RepairTicket[]): MatchedTicket[] {
  const model = (device.model || '').trim().toLowerCase();
  const department = (device.department || '').trim().toLowerCase();

  // Collect unique device identifiers that are long enough to be distinctive.
  // Min length 4 avoids false positives from short numeric strings.
  const uniqueIds = [device.deviceId, device.assetNo]
    .map((v) => v?.trim() ?? '')
    .filter((v) => v.length >= 4);

  // Nothing to match on — device has neither a model nor usable unique identifiers.
  if (!model && uniqueIds.length === 0) return [];

  const result: MatchedTicket[] = [];

  for (const ticket of tickets) {
    // Skip tickets confirmed by deviceId — they appear under Device Events, not heuristic matches.
    if (ticket.deviceId && ticket.deviceId.trim() === device.deviceId.trim()) {
      continue;
    }

    // Step 1 — Identifier-first check (runs before any model gate).
    // A ticket that explicitly references a unique device identifier is high confidence
    // even if its deviceName does not match this device's model.
    if (uniqueIds.length > 0) {
      const allText = [
        ticket.description ?? '',
        ...(ticket.notes ?? []).map((n) => n.content),
        ...(ticket.history ?? []).map((h) => h.action),
      ]
        .join(' ')
        .toLowerCase();

      const matchedId = uniqueIds.find((id) => allText.includes(id.toLowerCase()));
      if (matchedId) {
        result.push({
          ticket,
          matchConfidence: 'high',
          matchReasons: [`Matched by device identifier in ticket content ("${matchedId}")`],
        });
        continue;
      }
    }

    // Step 2 — Model gate for lower-confidence fallbacks.
    // Only apply if no identifier match was found above.
    if (!model) continue;
    if ((ticket.deviceName || '').trim().toLowerCase() !== model) continue;

    // Step 3 — Medium confidence: model + department both match.
    const ticketDept = (ticket.department || '').trim().toLowerCase();
    if (department && ticketDept && ticketDept === department) {
      result.push({
        ticket,
        matchConfidence: 'medium',
        matchReasons: ['Device model name matches', 'Department also matches'],
      });
      continue;
    }

    // Step 4 — Low confidence: model name only.
    result.push({
      ticket,
      matchConfidence: 'low',
      matchReasons: ['Device model name matches'],
    });
  }

  return result;
}

// Build RepairLogEntry[] from classified ticket matches.
// employeeName is the requester, not the technician — it appears in detail, not technician.
export function buildInferredTicketEntries(matchedTickets: MatchedTicket[]): RepairLogEntry[] {
  const entries: RepairLogEntry[] = [];

  for (const { ticket, matchConfidence, matchReasons } of matchedTickets) {
    const inferredSource = matchReasons.join(' · ');
    const hasDetailedEvents =
      (ticket.history?.length ?? 0) > 0 || (ticket.notes?.length ?? 0) > 0;

    if (!hasDetailedEvents) {
      entries.push({
        id: `${ticket.id}-created`,
        title: `${ticket.id} — ${ticket.problemType}`,
        eventId: ticket.id,
        detail: `Reported by ${ticket.employeeName}: ${ticket.description}`,
        timestamp: formatDateValue(toDatePart(ticket.createdAt)),
        technician: 'Unassigned',
        status: ticket.status,
        matchConfidence,
        inferredSource,
      });
    }

    for (const event of ticket.history ?? []) {
      entries.push({
        id: `${ticket.id}-hist-${event.id}`,
        title: `${ticket.id} — ${event.action}`,
        eventId: ticket.id,
        detail: `${event.action} by ${event.user}`,
        timestamp: formatDateValue(toDatePart(event.timestamp)),
        technician: event.user,
        status: ticket.status,
        matchConfidence,
        inferredSource,
      });
    }

    for (const note of ticket.notes ?? []) {
      entries.push({
        id: `${ticket.id}-note-${note.id}`,
        title: `${ticket.id} — Technician note`,
        eventId: ticket.id,
        detail: note.content,
        timestamp: formatDateValue(toDatePart(note.timestamp)),
        technician: note.author,
        status: ticket.status,
        matchConfidence,
        inferredSource,
      });
    }
  }

  sortNewestFirst(entries);
  return entries;
}

// Converts persistent DeviceRepairEvent records into RepairLogEntry for display.
// These entries have no matchConfidence (they are confirmed by the event log, not heuristic).
export function buildPersistedRepairLogEntries(events: DeviceRepairEvent[]): RepairLogEntry[] {
  return events.map(buildPersistedRepairLogEntry);
}

function buildPersistedRepairLogEntry(event: DeviceRepairEvent): RepairLogEntry {
  const eventId = event.ticketId ?? `EVT-${event.id.slice(0, 8)}`;
  return {
    id: event.id,
    title: formatPersistedEventTitle(event),
    eventId,
    detail: formatPersistedEventDetail(event),
    timestamp: formatDateValue(toDatePart(event.createdAt)),
    technician: event.technician ?? event.createdBy ?? 'System',
    status: event.status ?? 'Recorded',
  };
}

function formatPersistedEventTitle(event: DeviceRepairEvent): string {
  const prefix = event.ticketId ? `${event.ticketId} — ` : '';
  switch (event.eventType) {
    case 'ticket_created': return `${prefix}Ticket Created`;
    case 'ticket_status_changed': return `${prefix}Status Changed to ${event.status ?? 'Unknown'}`;
    case 'ticket_completed': return `${prefix}Ticket Completed`;
    case 'ticket_deleted': return `${prefix}Ticket Deleted`;
    case 'device_note': return 'Device Note';
    default: return `${prefix}Event`;
  }
}

function formatPersistedEventDetail(event: DeviceRepairEvent): string {
  if (event.description) return event.description;
  if (event.status) return `Status: ${event.status}`;
  return event.title;
}

function sortNewestFirst(entries: RepairLogEntry[]) {
  entries.sort((a, b) => {
    const aIsDate = /^\d{4}-\d{2}-\d{2}/.test(a.timestamp);
    const bIsDate = /^\d{4}-\d{2}-\d{2}/.test(b.timestamp);
    if (aIsDate && bIsDate) return b.timestamp.localeCompare(a.timestamp);
    if (aIsDate) return -1;
    if (bIsDate) return 1;
    return 0;
  });
}

export function deriveAssignmentIdentity(assignedTo: string) {
  const normalized = assignedTo.trim().toLowerCase();

  if (!normalized) {
    return '';
  }

  if (normalized.includes('@')) {
    return normalized;
  }

  return `${normalized}@company.local`;
}

function toDatePart(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? value.slice(0, 10) : value;
}

export function formatDateValue(value: string | undefined) {
  const parsed = parseDeviceDate(value);
  return parsed ? formatIsoDate(parsed) : value?.trim() || 'Not recorded';
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
