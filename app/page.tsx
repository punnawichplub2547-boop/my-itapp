import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginView from './views/LoginView';
import { SESSION_COOKIE_NAME, isValidSessionToken } from './lib/auth/mockUser';

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (isValidSessionToken(sessionToken)) {
    redirect('/dashboard');
  }

  return <LoginView />;
}
