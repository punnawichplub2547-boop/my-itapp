import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

const workbookPath = './F-IT-010 Rev.01.xlsx';
const workbookExists = fs.existsSync(path.join(process.cwd(), workbookPath));

const nextConfig: NextConfig = {
  serverExternalPackages: ['nodemailer'],
  outputFileTracingIncludes: workbookExists
    ? {
        '/api/reports/export': [workbookPath],
        '/api/devices/export': [workbookPath],
      }
    : undefined,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
