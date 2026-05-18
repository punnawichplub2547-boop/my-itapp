import {
  deleteDevice,
  DeviceDatabaseConfigurationError,
  DeviceNotFoundError,
  DeviceValidationError,
  updateDeviceAssignedTo,
  updateDeviceStatus,
} from '../../../lib/devices/deviceService';
import { requireAuthenticatedRequest } from '../../../lib/auth/mockUser';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { deviceId } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid device payload.' }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ error: 'Invalid device payload.' }, { status: 400 });
  }

  try {
    if ('status' in body) {
      const device = await updateDeviceStatus(deviceId, body.status);
      return Response.json({ device });
    }

    if (typeof body.assignedTo === 'string') {
      const device = await updateDeviceAssignedTo(deviceId, body.assignedTo);
      return Response.json({ device });
    }

    return Response.json({ error: 'No supported update fields provided.' }, { status: 400 });
  } catch (error) {
    if (error instanceof DeviceValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof DeviceNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof DeviceDatabaseConfigurationError) {
      return Response.json(
        {
          error:
            'Database is not configured. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.',
        },
        { status: 503 }
      );
    }

    console.error('Failed to update device', {
      error,
      operation: 'devices.update',
      deviceId,
    });

    return Response.json(
      { error: 'Unable to update the device right now.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const unauthorizedResponse = requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { deviceId } = await params;

  try {
    await deleteDevice(deviceId);
    return Response.json({ ok: true, deletedDeviceId: deviceId });
  } catch (error) {
    if (error instanceof DeviceNotFoundError) {
      return Response.json({ ok: false, error: error.message }, { status: 404 });
    }

    if (error instanceof DeviceDatabaseConfigurationError) {
      return Response.json(
        { ok: false, error: 'Database is not configured. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.' },
        { status: 503 }
      );
    }

    console.error('Failed to delete device', {
      error,
      operation: 'devices.delete',
      deviceId,
    });

    return Response.json({ ok: false, error: 'Unable to delete the device right now.' }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
