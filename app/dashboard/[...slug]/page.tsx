import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RepairLinkApp from '../../RepairLinkApp';
import { SESSION_COOKIE_NAME, isValidSessionToken } from '../../lib/auth/mockUser';
import type { ViewType } from '../../types';

const SLUG_TO_VIEW: Record<string, ViewType> = {
  'create-repair-request': 'create-request',
  'repair-status': 'tickets',
  'device-inventory': 'inventory',
  'add-new-device': 'add-device',
  reports: 'reports',
  'warranty-audit': 'warranty-audit',
  settings: 'settings',
};

export default async function DashboardSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<{ ticket?: string; q?: string; device?: string }>;
}) {
  const cookieStore = await cookies();
  if (!isValidSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value)) {
    redirect('/');
  }

  const { slug } = await params;
  const view: ViewType = SLUG_TO_VIEW[slug[0]] ?? 'dashboard';
  const { ticket, q, device } = await searchParams;

  return (
    <RepairLinkApp
      initialView={view}
      initialTicketId={ticket}
      initialSearchQuery={q}
      initialDeviceId={device}
    />
  );
}
