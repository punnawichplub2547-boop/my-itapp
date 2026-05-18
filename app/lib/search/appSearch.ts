import type { Device, RepairTicket } from '../../types';
import { getWarrantyAlertStatus } from '../devices/warrantyAlerts';

const MAX_RESULTS_PER_GROUP = 5;

export type AppSearchResultType = 'device' | 'ticket' | 'warranty';

export interface AppSearchResult {
  type: AppSearchResultType;
  key: string;
  title: string;
  subtitle: string;
  detail: string;
  score: number;
  deviceId?: string;
  ticketId?: string;
}

export interface AppSearchGroups {
  devices: AppSearchResult[];
  tickets: AppSearchResult[];
  warranties: AppSearchResult[];
}

export function buildAppSearchGroups(
  query: string,
  devices: Device[],
  tickets: RepairTicket[]
): AppSearchGroups {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return {
      devices: [],
      tickets: [],
      warranties: [],
    };
  }

  return {
    devices: buildDeviceResults(normalizedQuery, devices),
    tickets: buildTicketResults(normalizedQuery, tickets),
    warranties: buildWarrantyResults(normalizedQuery, devices),
  };
}

export function flattenAppSearchGroups(groups: AppSearchGroups) {
  return [...groups.devices, ...groups.tickets, ...groups.warranties].sort(compareSearchResults);
}

function buildDeviceResults(query: string, devices: Device[]): AppSearchResult[] {
  const results = devices.map((device): AppSearchResult | null => {
      const score = scoreMatch(query, [
        device.deviceId,
        device.assetNo,
        device.model,
        device.assignedTo,
        device.department,
        device.ipAddress,
        device.os,
      ]);

      if (score === 0) {
        return null;
      }

      return {
        type: 'device',
        key: `device:${device.deviceId}`,
        title: device.deviceId,
        subtitle: device.model || device.deviceType,
        detail: [device.department, device.assignedTo || 'Unassigned', device.ipAddress]
          .filter(Boolean)
          .join(' • '),
        score,
        deviceId: device.deviceId,
      } satisfies AppSearchResult;
    });

  return results
    .filter((result): result is AppSearchResult => result !== null)
    .sort(compareSearchResults)
    .slice(0, MAX_RESULTS_PER_GROUP);
}

function buildTicketResults(query: string, tickets: RepairTicket[]): AppSearchResult[] {
  const results = tickets.map((ticket): AppSearchResult | null => {
      const score = scoreMatch(query, [
        ticket.id,
        ticket.deviceName,
        ticket.employeeName,
        ticket.employeeEmail,
        ticket.department,
        ticket.problemType,
        ticket.description,
        ticket.status,
        ticket.priority,
      ]);

      if (score === 0) {
        return null;
      }

      return {
        type: 'ticket',
        key: `ticket:${ticket.id}`,
        title: ticket.id,
        subtitle: `${ticket.deviceName} • ${ticket.problemType}`,
        detail: [ticket.employeeName, ticket.department, ticket.status].filter(Boolean).join(' • '),
        score,
        ticketId: ticket.id,
      } satisfies AppSearchResult;
    });

  return results
    .filter((result): result is AppSearchResult => result !== null)
    .sort(compareSearchResults)
    .slice(0, MAX_RESULTS_PER_GROUP);
}

function buildWarrantyResults(query: string, devices: Device[]): AppSearchResult[] {
  const results = devices.map((device): AppSearchResult | null => {
      const status = getWarrantyAlertStatus(device);
      const statusLabel =
        status.kind === 'expired'
          ? 'Expired'
          : status.kind === 'expiring-soon'
          ? 'Expiring Soon'
          : 'Active Warranty';
      const daysDetail =
        typeof status.daysRemaining === 'number'
          ? status.daysRemaining < 0
            ? `${Math.abs(status.daysRemaining)} days overdue`
            : `${status.daysRemaining} days remaining`
          : 'Warranty date not recorded';
      const score = scoreMatch(query, [
        device.deviceId,
        device.model,
        device.warranty,
        device.yearValue,
        device.expireDatePrimary,
        device.expireDateSecondary,
        statusLabel,
      ]);

      if (score === 0) {
        return null;
      }

      return {
        type: 'warranty',
        key: `warranty:${device.deviceId}`,
        title: device.deviceId,
        subtitle: `${device.model || device.deviceType} • ${statusLabel}`,
        detail: [device.warranty || 'Warranty not recorded', daysDetail]
          .filter(Boolean)
          .join(' • '),
        score,
        deviceId: device.deviceId,
      } satisfies AppSearchResult;
    });

  return results
    .filter((result): result is AppSearchResult => result !== null)
    .sort(compareSearchResults)
    .slice(0, MAX_RESULTS_PER_GROUP);
}

function scoreMatch(query: string, fields: Array<string | undefined>) {
  let bestScore = 0;

  for (const field of fields) {
    const normalizedField = normalizeSearchText(field);

    if (!normalizedField) {
      continue;
    }

    if (normalizedField === query) {
      bestScore = Math.max(bestScore, 120);
      continue;
    }

    if (normalizedField.startsWith(query)) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    if (normalizedField.includes(query)) {
      bestScore = Math.max(bestScore, 60);
    }
  }

  return bestScore;
}

function compareSearchResults(left: AppSearchResult, right: AppSearchResult) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.title.localeCompare(right.title);
}

function normalizeSearchText(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}
