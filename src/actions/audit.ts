'use server';

import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

function getAuditLogPath(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return join(process.cwd(), 'logs', `audit-${date}.log`);
}

export async function writeAuditLog(
  actor: string,
  action: string,
  detail: string
): Promise<void> {
  try {
    const logsDir = join(process.cwd(), 'logs');
    await mkdir(logsDir, { recursive: true });

    const now = new Date().toISOString();
    const line = `[${now}] [${action}] actor="${actor}" detail="${detail}"\n`;

    await appendFile(getAuditLogPath(), line, 'utf8');
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err);
  }
}
