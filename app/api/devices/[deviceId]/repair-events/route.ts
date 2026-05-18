import { requireAuthenticatedRequest } from '../../../../lib/auth/mockUser';
import { listDeviceRepairEvents } from '../../../../lib/devices/deviceRepairEventService';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  const { deviceId } = await params;

  try {
    const events = await listDeviceRepairEvents(deviceId);
    return Response.json({ events });
  } catch {
    return Response.json({ events: [] });
  }
}
