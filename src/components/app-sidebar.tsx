"use client";

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/use-permission';
import { SiteLogo } from '@/components/site-logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HardDrive,
  LogOut,
  Menu,
  X,
  User,
  Users,
  Shield,
  Settings,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import type { UserRole } from '@/context/UserContext';

const roleBadgeClass: Record<UserRole, string> = {
  viewer: 'bg-gray-100 text-gray-700',
  uploader: 'bg-blue-100 text-blue-700',
  'bucket-creator': 'bg-amber-100 text-amber-700',
  admin: 'bg-red-100 text-red-700',
};
const roleLabels: Record<UserRole, string> = {
  viewer: 'Viewer',
  uploader: 'Uploader',
  'bucket-creator': 'Bucket Creator',
  admin: 'Admin',
};

interface AppSidebarProps {
  title?: string;
  titleIcon?: React.ReactNode;
}

export function AppSidebar({ title = 'S3 Navigator', titleIcon }: AppSidebarProps) {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const { role } = usePermission();
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navLinkClass = (path: string) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
      isActive(path)
        ? 'bg-blue-600 text-white shadow-inner'
        : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
    }`;

  return (
    <>
      {/* Top bar */}
      <header className="skeu-header px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="hover:bg-white/30"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <SiteLogo size="sm" />
          <span className="text-xl font-bold flex items-center gap-2">
            {titleIcon ?? <HardDrive className="h-5 w-5" />}
            {title}
          </span>
        </div>

        {/* Role badge top-right */}
        {user && (
          <Badge className={`${roleBadgeClass[role]} skeu-badge`}>
            {user.username} · {roleLabels[role]}
          </Badge>
        )}
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(180deg, #e8eef8 0%, #d0daea 100%)',
          borderRight: '1px solid #a0aec0',
          boxShadow: '4px 0 20px rgba(0,0,0,0.18)',
        }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-300/60">
          <div className="flex items-center gap-2">
            <SiteLogo size="sm" />
            <span className="font-bold text-slate-800">S3 Navigator</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="hover:bg-white/30">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* User info */}
        {user && (
          <div className="px-4 py-3 border-b border-slate-300/60">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow">
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{user.username}</p>
                <Badge className={`${roleBadgeClass[role]} skeu-badge text-xs`}>{roleLabels[role]}</Badge>
              </div>
            </div>
          </div>
        )}

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <Link href="/" onClick={() => setOpen(false)} className={navLinkClass('/')}>
            <HardDrive className="h-4 w-4" /> Buckets
          </Link>

          {/* Settings group */}
          <div>
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-white/60 transition-all"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              <span className="flex items-center gap-3">
                <Settings className="h-4 w-4" /> Settings
              </span>
              {settingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {settingsOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-300/60 pl-3">
                <Link href="/profile" onClick={() => setOpen(false)} className={navLinkClass('/profile')}>
                  <User className="h-4 w-4" /> Profile
                </Link>
                {isAdmin && (
                  <>
                    <Link href="/users" onClick={() => setOpen(false)} className={navLinkClass('/users')}>
                      <Users className="h-4 w-4" /> User Management
                    </Link>
                    <Link href="/bucket-assignments" onClick={() => setOpen(false)} className={navLinkClass('/bucket-assignments')}>
                      <Shield className="h-4 w-4" /> Bucket Assignments
                    </Link>
                    <Link href="/admin" onClick={() => setOpen(false)} className={navLinkClass('/admin')}>
                      <Settings className="h-4 w-4" /> Admin Settings
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* Logout at bottom */}
        <div className="px-3 py-4 border-t border-slate-300/60">
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>
    </>
  );
}
