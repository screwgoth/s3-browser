/**
 * Audit logging utilities (PCI-DSS compliant)
 */

import { query } from './db';

export interface AuditLog {
  id?: number;
  user_id?: number;
  username?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status?: 'success' | 'failure';
  created_at?: Date;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(log: AuditLog): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs 
       (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        log.user_id || null,
        log.username || null,
        log.action,
        log.resource_type || null,
        log.resource_id || null,
        log.details ? JSON.stringify(log.details) : null,
        log.ip_address || null,
        log.user_agent || null,
        log.status || 'success',
      ]
    );
  } catch (error) {
    // Don't throw errors for audit logging failures
    // Just log to console to avoid breaking the main flow
    console.error('Failed to create audit log:', error);
  }
}

/**
 * Get audit logs with pagination and filtering
 */
export async function getAuditLogs(options: {
  limit?: number;
  offset?: number;
  userId?: number;
  action?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const { limit = 50, offset = 0, userId, action, resourceType, startDate, endDate } = options;

  let whereConditions: string[] = [];
  let params: any[] = [];
  let paramIndex = 1;

  if (userId) {
    whereConditions.push(`user_id = $${paramIndex++}`);
    params.push(userId);
  }

  if (action) {
    whereConditions.push(`action = $${paramIndex++}`);
    params.push(action);
  }

  if (resourceType) {
    whereConditions.push(`resource_type = $${paramIndex++}`);
    params.push(resourceType);
  }

  if (startDate) {
    whereConditions.push(`created_at >= $${paramIndex++}`);
    params.push(startDate);
  }

  if (endDate) {
    whereConditions.push(`created_at <= $${paramIndex++}`);
    params.push(endDate);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get logs
  const logsResult = await query<AuditLog>(
    `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    logs: logsResult.rows,
    total,
  };
}

/**
 * Search audit logs by keyword
 */
export async function searchAuditLogs(
  keyword: string,
  limit: number = 50
): Promise<AuditLog[]> {
  const result = await query<AuditLog>(
    `SELECT * FROM audit_logs 
     WHERE username ILIKE $1 
        OR action ILIKE $1 
        OR resource_type ILIKE $1
        OR resource_id ILIKE $1
     ORDER BY created_at DESC 
     LIMIT $2`,
    [`%${keyword}%`, limit]
  );

  return result.rows;
}

/**
 * Get audit log statistics
 */
export async function getAuditStats(): Promise<{
  totalLogs: number;
  todayLogs: number;
  loginAttempts: number;
  failedLogins: number;
  topActions: Array<{ action: string; count: number }>;
}> {
  const [totalResult, todayResult, loginResult, failedResult, topActionsResult] = await Promise.all([
    // Total logs
    query<{ count: string }>('SELECT COUNT(*) as count FROM audit_logs'),

    // Today's logs
    query<{ count: string }>(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE created_at >= CURRENT_DATE
    `),

    // Login attempts
    query<{ count: string }>(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE action LIKE 'login%'
    `),

    // Failed logins
    query<{ count: string }>(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE action = 'login.failed'
    `),

    // Top actions
    query<{ action: string; count: string }>(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `),
  ]);

  return {
    totalLogs: parseInt(totalResult.rows[0].count, 10),
    todayLogs: parseInt(todayResult.rows[0].count, 10),
    loginAttempts: parseInt(loginResult.rows[0].count, 10),
    failedLogins: parseInt(failedResult.rows[0].count, 10),
    topActions: topActionsResult.rows.map((row) => ({
      action: row.action,
      count: parseInt(row.count, 10),
    })),
  };
}
