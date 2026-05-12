import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RepairLinkApp from '../RepairLinkApp';
import { SESSION_COOKIE_NAME, isValidSessionToken } from '../lib/auth/mockUser';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!isValidSessionToken(sessionToken)) {
    redirect('/');
  }

  return <RepairLinkApp initialView="dashboard" />;
}
