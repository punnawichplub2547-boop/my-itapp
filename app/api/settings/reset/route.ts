import { NextResponse } from 'next/server';
import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';
import { getSettingsService } from '../../../lib/settings/settingsService';
import type { SystemSettings } from '../../../types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const keys = Array.isArray(body?.keys) ? (body.keys as Array<keyof SystemSettings>) : undefined;

    const service = getSettingsService();
    const settings = await service.resetSettings(keys);

    return NextResponse.json({ settings, message: 'Settings reset successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
