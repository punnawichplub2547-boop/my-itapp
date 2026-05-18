import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';
import { listDevices } from '../../../lib/devices/deviceService';
import { filterDevices } from '../../../lib/devices/filterDevices';
import { buildDeviceInventoryXlsx } from '../../../lib/devices/excelExport';

export const runtime = 'nodejs';

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const url = new URL(request.url);
    const devices = await listDevices();
    const filtered = filterDevices(devices, {
      search: url.searchParams.get('search') ?? '',
      department: url.searchParams.get('department') ?? 'All',
      deviceType: url.searchParams.get('deviceType') ?? 'All',
      os: url.searchParams.get('os') ?? 'All',
    });

    const buffer = await buildDeviceInventoryXlsx(filtered);
    const filename = `device-inventory-${todayStamp()}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build inventory export.';
    return Response.json({ error: message }, { status: 500 });
  }
}
