import { NextResponse } from 'next/server';
import { requireAuthenticatedRequest } from '../../lib/auth/mockUser';
import { getSettingsService } from '../../lib/settings/settingsService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const service = getSettingsService();
    const settings = await service.getSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload.' }, { status: 400 });
    }

    const payload = (body.settings && typeof body.settings === 'object') ? body.settings : body;
    const service = getSettingsService();
    const settings = await service.updateSettings(payload, 'admin');

    return NextResponse.json({ settings, message: 'Settings updated successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
