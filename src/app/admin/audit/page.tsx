"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Download, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  status: 'success' | 'failure';
  created_at: string;
}

const PAGE_SIZE = 50;

const ACTION_CATEGORIES = [
  { label: 'All Actions', value: 'all' },
  { label: '— Auth —', value: '_divider_auth', disabled: true },
  { label: 'Login Success', value: 'login.success' },
  { label: 'Login Failed', value: 'login.failed' },
  { label: 'Logout', value: 'logout' },
  { label: '— Password —', value: '_divider_password', disabled: true },
  { label: 'Password Changed', value: 'password.changed' },
  { label: 'Password Change Failed', value: 'password.change.failed' },
  { label: 'Password Force Change', value: 'password.force_change' },
  { label: 'Password Admin Reset', value: 'password.admin_reset' },
  { label: '— Files —', value: '_divider_files', disabled: true },
  { label: 'File Upload', value: 'file.upload' },
  { label: 'File Download', value: 'file.download' },
  { label: 'Batch Download', value: 'file.download.batch' },
  { label: 'Folder Download', value: 'file.download.folder' },
  { label: '— Buckets —', value: '_divider_buckets', disabled: true },
  { label: 'Bucket Created', value: 'bucket.created' },
  { label: 'Bucket Updated', value: 'bucket.updated' },
  { label: 'Bucket Deleted', value: 'bucket.deleted' },
  { label: 'Bucket Assigned', value: 'bucket.assigned' },
  { label: 'Bucket Unassigned', value: 'bucket.unassigned' },
  { label: '— Users —', value: '_divider_users', disabled: true },
  { label: 'User Created', value: 'user.created' },
  { label: 'User Updated', value: 'user.updated' },
  { label: 'User Deleted', value: 'user.deleted' },
  { label: 'User Activated', value: 'user.activated' },
  { label: 'User Deactivated', value: 'user.deactivated' },
  { label: '— Settings —', value: '_divider_settings', disabled: true },
  { label: 'Logo Uploaded', value: 'settings.logo_upload' },
  { label: 'Logo Removed', value: 'settings.logo_remove' },
];

const ACTION_COLORS: Record<string, string> = {
  // Auth
  'login.success':           'bg-green-100 text-green-800',
  'login.failed':            'bg-red-100 text-red-800',
  'logout':                  'bg-slate-100 text-slate-700',
  // Password
  'password.changed':        'bg-blue-100 text-blue-800',
  'password.change.failed':  'bg-red-100 text-red-800',
  'password.force_change':   'bg-amber-100 text-amber-800',
  'password.admin_reset':    'bg-orange-100 text-orange-800',
  // Files
  'file.upload':             'bg-emerald-100 text-emerald-800',
  'file.download':           'bg-sky-100 text-sky-800',
  'file.download.batch':     'bg-cyan-100 text-cyan-800',
  'file.download.folder':    'bg-teal-100 text-teal-800',
  // Buckets
  'bucket.created':          'bg-emerald-100 text-emerald-800',
  'bucket.updated':          'bg-sky-100 text-sky-800',
  'bucket.deleted':          'bg-red-100 text-red-800',
  'bucket.assigned':         'bg-purple-100 text-purple-800',
  'bucket.unassigned':       'bg-orange-100 text-orange-800',
  // Users
  'user.created':            'bg-green-100 text-green-800',
  'user.updated':            'bg-blue-100 text-blue-800',
  'user.deleted':            'bg-red-100 text-red-800',
  'user.activated':          'bg-emerald-100 text-emerald-800',
  'user.deactivated':        'bg-slate-100 text-slate-700',
  // Settings
  'settings.logo_upload':    'bg-indigo-100 text-indigo-800',
  'settings.logo_remove':    'bg-slate-100 text-slate-700',
};

function formatTs(ts: string) {
  try {
    return new Date(ts).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });
  } catch { return ts; }
}

function formatDetails(details: Record<string, any> | null): string {
  if (!details) return '';
  const parts: string[] = [];
  if (details.bucket) parts.push(`bucket: ${details.bucket}`);
  if (details.key) parts.push(`key: ${details.key}`);
  if (details.prefix) parts.push(`prefix: ${details.prefix}`);
  if (details.size_bytes) parts.push(`${(details.size_bytes / 1024).toFixed(1)} KB`);
  if (details.content_type) parts.push(details.content_type);
  if (details.item_count) parts.push(`${details.item_count} items`);
  if (details.target_username) parts.push(`→ ${details.target_username}`);
  if (details.bucket_name) parts.push(`bucket: ${details.bucket_name}`);
  if (details.target_user) parts.push(`→ ${details.target_user}`);
  if (details.target_role) parts.push(`role: ${details.target_role}`);
  if (details.filename) parts.push(details.filename);
  if (details.size_kb) parts.push(`${details.size_kb} KB`);
  if (details.reason) parts.push(`reason: ${details.reason}`);
  if (details.method) parts.push(details.method);
  return parts.join(' · ');
}

export default function AuditLogPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, today: 0, fileEvents: 0, failures: 0 });

  useEffect(() => {
    if (!isLoading && !isAdmin) router.push('/');
  }, [isAdmin, isLoading, router]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to first page whenever filters change
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, actionFilter, startDate, endDate]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (debouncedSearch) params.set('username', debouncedSearch);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.set('endDate', end.toISOString());
      }

      const res = await fetch(`/api/audit?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, debouncedSearch, startDate, endDate]);

  const fetchStats = useCallback(async () => {
    try {
      const [allRes, todayRes, fileRes, failRes] = await Promise.all([
        fetch('/api/audit?limit=0', { credentials: 'include' }),
        fetch(`/api/audit?limit=0&startDate=${new Date().toISOString().slice(0, 10)}`, { credentials: 'include' }),
        fetch('/api/audit?limit=0&resourceType=s3_object', { credentials: 'include' }),
        fetch('/api/audit?limit=1000', { credentials: 'include' }),
      ]);
      const [allData, todayData, fileData, allLogsData] = await Promise.all([
        allRes.json(), todayRes.json(), fileRes.json(), failRes.json(),
      ]);
      const failures = (allLogsData.logs as AuditLog[])?.filter(l => l.status === 'failure').length ?? 0;
      setStats({
        total: allData.total ?? 0,
        today: todayData.total ?? 0,
        fileEvents: fileData.total ?? 0,
        failures,
      });
    } catch { /* stats are non-critical */ }
  }, []);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      fetchLogs();
      fetchStats();
    }
  }, [isLoading, isAdmin, fetchLogs, fetchStats]);

  const handleExportCSV = () => {
    const header = 'Timestamp,Action,Username,Resource Type,Resource ID,Status,Details\n';
    const rows = logs.map(l =>
      `"${l.created_at}","${l.action}","${l.username ?? ''}","${l.resource_type ?? ''}","${l.resource_id ?? ''}","${l.status}","${formatDetails(l.details).replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setSearch('');
    setActionFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (isLoading || !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen skeu-bg app-content">
      <AppSidebar title="Audit Trail" titleIcon={<ShieldCheck className="h-5 w-5" />} />
      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <Card className="skeu-card border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-blue-600" /> Audit Trail — PCI-DSS v4.0 Compliant
            </CardTitle>
            <CardDescription>
              Complete tamper-evident log of all system events: authentication, file operations, user management,
              bucket operations, and settings changes. Stored in PostgreSQL.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Events', value: stats.total, color: 'text-slate-700' },
            { label: "Today's Events", value: stats.today, color: 'text-blue-700' },
            { label: 'File Events', value: stats.fileEvents, color: 'text-emerald-700' },
            { label: 'Failures', value: stats.failures, color: 'text-red-700' },
          ].map(stat => (
            <Card key={stat.label} className="skeu-card">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="skeu-card">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">

              {/* Action filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_CATEGORIES.map(opt =>
                      opt.disabled ? (
                        <SelectItem key={opt.value} value={opt.value} disabled className="text-xs text-muted-foreground font-semibold">
                          {opt.label}
                        </SelectItem>
                      ) : (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-36" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-36" />
              </div>

              {/* Username search */}
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Username</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filter by username…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex gap-2 pb-0.5">
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={logs.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Log table */}
        <Card className="skeu-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{total.toLocaleString()} event{total !== 1 ? 's' : ''} {total > 0 ? `— page ${page + 1} of ${totalPages}` : ''}</span>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && logs.length === 0 ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : logs.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                No audit events found. Events will appear here after the first action.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table className="skeu-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-44">Timestamp</TableHead>
                        <TableHead className="w-48">Action</TableHead>
                        <TableHead className="w-28">User</TableHead>
                        <TableHead className="w-24">Resource</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(log => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {formatTs(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs font-mono ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-700'}`}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-sm">{log.username ?? '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.resource_type ?? '—'}
                            {log.resource_id && <span className="block truncate max-w-[120px]" title={log.resource_id}>{log.resource_id}</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={formatDetails(log.details)}>
                            {formatDetails(log.details)}
                          </TableCell>
                          <TableCell>
                            <Badge className={log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {log.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p - 1)}
                        disabled={page === 0 || loading}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm font-medium px-2">{page + 1} / {totalPages}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={page >= totalPages - 1 || loading}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
