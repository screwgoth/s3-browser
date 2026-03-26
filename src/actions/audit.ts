'use server';

import { appendFile, mkdir, readFile, readdir } from 'fs/promises';
import { join } from 'path';

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  detail: string;
  raw: string;
}

export interface AuditLogFile {
  date: string;
  filename: string;
}

export async function listAuditLogDates(): Promise<AuditLogFile[]> {
  try {
    const logsDir = join(process.cwd(), 'logs');
    await mkdir(logsDir, { recursive: true });
    const files = await readdir(logsDir);
    return files
      .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
      .map(f => ({ filename: f, date: f.replace('audit-', '').replace('.log', '') }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function readAuditLog(date: string): Promise<AuditEntry[]> {
  try {
    const filePath = join(process.cwd(), 'logs', `audit-${date}.log`);
    const content = await readFile(filePath, 'utf8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Format: [ISO] [ACTION] actor="..." detail="..."
        const tsMatch = line.match(/^\[(.+?)\]/);
        const actionMatch = line.match(/\[(.+?)\]\s+actor=/);
        const actorMatch = line.match(/actor="(.+?)"/);
        const detailMatch = line.match(/detail="(.+?)"/);
        return {
          timestamp: tsMatch?.[1] ?? '',
          action: actionMatch?.[1] ?? '',
          actor: actorMatch?.[1] ?? '',
          detail: detailMatch?.[1] ?? '',
          raw: line,
        };
      })
      .reverse(); // newest first
  } catch {
    return [];
  }
}

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
