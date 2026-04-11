"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Download, Search, RefreshCw } from 'lucide-react';
import { listAuditLogDates, readAuditLog, type AuditEntry, type AuditLogFile } from '@/actions/audit';

const actionColors: Record<string, string> = {
  USER_CREATE:           'bg-green-100 text-green-800',
  USER_DELETE:           'bg-red-100 text-red-800',
  USER_ROLE_CHANGE:      'bg-amber-100 text-amber-800',
  USER_PASSWORD_CHANGE:  'bg-blue-100 text-blue-800',
  BUCKET_CREATE:         'bg-emerald-100 text-emerald-800',
  BUCKET_UPDATE:         'bg-sky-100 text-sky-800',
  BUCKET_DELETE:         'bg-red-100 text-red-800',
  BUCKET_ASSIGN:         'bg-purple-100 text-purple-800',
  BUCKET_UNASSIGN:       'bg-orange-100 text-orange-800',
  LOGO_UPLOAD:           'bg-indigo-100 text-indigo-800',
  LOGO_REMOVE:           'bg-slate-100 text-slate-800',
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

export default function AuditLogPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  const [dates, setDates] = useState<AuditLogFile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filtered, setFiltered] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.push('/');
  }, [isAdmin, isLoading, router]);

  useEffect(() => {
    listAuditLogDates().then((d) => {
      setDates(d);
      if (d.length > 0) setSelectedDate(d[0].date);
    });
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    setLoadingEntries(true);
    readAuditLog(selectedDate).then((e) => {
      setEntries(e);
      setFiltered(e);
      setLoadingEntries(false);
    });
  }, [selectedDate]);

  useEffect(() => {
    let result = entries;
    if (userFilter !== 'all') result = result.filter(e => e.actor === userFilter);
    if (actionFilter !== 'all') result = result.filter(e => e.action === actionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.actor.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, actionFilter, userFilter, entries]);

  const handleExportCSV = () => {
    const header = 'Timestamp,Action,Actor,Detail\n';
    const rows = filtered.map(e =>
      `"${e.timestamp}","${e.action}","${e.actor}","${e.detail.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueActions = Array.from(new Set(entries.map(e => e.action))).sort();
  const uniqueActors = Array.from(new Set(entries.map(e => e.actor))).sort();

  if (isLoading || !isAdmin) {
    return <div className="w-screen h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen skeu-bg">
      <AppSidebar title="Audit Trail" titleIcon={<ShieldCheck className="h-5 w-5" />} />
      <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-6">

        {/* PCI-DSS header */}
        <Card className="skeu-card border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-blue-600" /> Audit Trail — PCI-DSS v4.0 Compliant
            </CardTitle>
            <CardDescription>
              Complete tamper-evident log of all system events: user management, role changes, bucket operations, and access control changes.
              Retained per-day in <code className="text-xs bg-muted px-1 rounded">logs/audit-YYYY-MM-DD.log</code>.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Controls */}
        <Card className="skeu-card">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Date selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Log Date</label>
                <Select value={selectedDate} onValueChange={setSelectedDate}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select date" />
                  </SelectTrigger>
                  <SelectContent>
                    {dates.length === 0 && <SelectItem value="_none" disabled>No logs yet</SelectItem>}
                    {dates.map(d => (
                      <SelectItem key={d.date} value={d.date}>{d.date}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">User</label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {uniqueActors.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Action</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {uniqueActions.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1 flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Actor, action, or detail…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="flex gap-2 pb-0.5">
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setActionFilter('all'); setUserFilter('all'); }}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filtered.length === 0}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Events', value: filtered.length, color: 'text-slate-700' },
            { label: 'User Changes', value: filtered.filter(e => e.action.startsWith('USER_')).length, color: 'text-blue-700' },
            { label: 'Bucket Changes', value: filtered.filter(e => e.action.startsWith('BUCKET_')).length, color: 'text-emerald-700' },
            { label: 'Actors', value: new Set(filtered.map(e => e.actor)).size, color: 'text-purple-700' },
          ].map(stat => (
            <Card key={stat.label} className="skeu-card">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Log table */}
        <Card className="skeu-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDate ? `Events for ${selectedDate}` : 'Select a date'} — {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEntries ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">
                {dates.length === 0 ? 'No audit logs yet. Events will appear here after the first action.' : 'No events match your filters.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="skeu-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Timestamp</TableHead>
                      <TableHead className="w-44">Action</TableHead>
                      <TableHead className="w-28">Actor</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((entry, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatTs(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs font-mono ${actionColors[entry.action] ?? 'bg-slate-100 text-slate-700'}`}>
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{entry.actor}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
