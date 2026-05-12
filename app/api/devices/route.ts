import {
  createDevice,
  DeviceDatabaseConfigurationError,
  DeviceValidationError,
  DuplicateDeviceIdError,
  listDevices,
} from '../../lib/devices/deviceService';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const devices = await listDevices();
    return Response.json({ devices });
  } catch (error) {
    if (error instanceof DeviceDatabaseConfigurationError) {
      return Response.json(
        {
          error:
            'Database is not configured. Set DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME.',
        },
        { status: 503 }
      );
    }

    console.error('Failed to list devices', {
      error,
      operation: 'devices.list',
    });

    return Response.json({ error: 'Unable to load devices right now.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid device payload.' }, { status: 400 });
  }

  try {
    const device = await createDevice(body);

    console.info('Device created', {
      deviceId: device.deviceId,
      repository: process.env.DATABASE_URL || process.env.DB_HOST ? 'mysql' : 'demo-file',
    });

    return Response.json({ device }, { status: 201 });
  } catch (error) {
    if (error instanceof DeviceValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof DuplicateDeviceIdError) {
      return Response.json({ error: error.message }, { status: 409 });
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

    console.error('Failed to create device', {
      error,
      operation: 'devices.create',
    });

    return Response.json(
      { error: 'Unable to save the device right now.' },
      { status: 500 }
    );
  }
}
