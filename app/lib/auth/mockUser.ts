export const SESSION_COOKIE_NAME = 'repairlink_session';
export const STANDARD_SESSION_MAX_AGE = 60 * 60 * 8;
export const REMEMBERED_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const mockAdminUser = {
  username: process.env.AUTH_ADMIN_USERNAME ?? 'admin',
  password: process.env.AUTH_ADMIN_PASSWORD ?? 'Admincar_1996',
  displayName: 'Admin User',
  role: 'Global Administrator',
};

const sessionSecret = process.env.AUTH_SESSION_SECRET ?? 'repairlink-dev-session';

export function authenticateAdmin(username: string, password: string) {
  if (username.trim() !== mockAdminUser.username || password !== mockAdminUser.password) {
    return null;
  }

  return {
    username: mockAdminUser.username,
    displayName: mockAdminUser.displayName,
    role: mockAdminUser.role,
  };
}

export function createSessionToken(username: string) {
  return `${username}.${sessionSecret}`;
}

export function isValidSessionToken(token?: string) {
  return token === createSessionToken(mockAdminUser.username);
}
