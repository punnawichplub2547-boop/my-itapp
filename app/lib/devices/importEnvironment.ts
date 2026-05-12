import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

export function loadDeviceImportEnvironment(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env
) {
  for (const fileName of ['.env.local', '.env']) {
    const filePath = resolve(cwd, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    loadDotenv({
      path: filePath,
      processEnv: env,
      override: false,
    });
  }
}
