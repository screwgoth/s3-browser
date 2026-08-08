"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermission } from '@/hooks/use-permission';
import { SiteLogo } from '@/components/site-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { getBrandingSettings } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  HardDrive,
  LogOut,
  Menu,
  X,
  User,
  Users,
  Shield,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { UserRole } from '@/context/UserContext';

const roleBadgeClass: Record<UserRole, string> = {
  viewer: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  uploader: 'bg-primary/15 text-primary',
  'bucket-creator': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  admin: 'bg-destructive/15 text-destructive',
};
const roleLabels: Record<UserRole, string> = {
  viewer: 'Viewer',
  uploader: 'Uploader',
  'bucket-creator': 'Bucket Creator',
  admin: 'Admin',
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Buckets', icon: <HardDrive className="h-4 w-4 shrink-0" /> },
  { href: '/users', label: 'User Management', icon: <Users className="h-4 w-4 shrink-0" />, adminOnly: true },
  { href: '/bucket-assignments', label: 'Bucket Assignments', icon: <Shield className="h-4 w-4 shrink-0" />, adminOnly: true },
  { href: '/admin', label: 'Admin Settings', icon: <Settings className="h-4 w-4 shrink-0" />, adminOnly: true },
  { href: '/admin/audit', label: 'Audit Trail', icon: <ShieldCheck className="h-4 w-4 shrink-0" />, adminOnly: true },
];

interface AppSidebarProps {
  title?: string;
  titleIcon?: React.ReactNode;
}

export function AppSidebar({ title, titleIcon }: AppSidebarProps) {
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail collapsed to icons
  const [appName, setAppName] = useState('S3 Navigator'); // configurable branding title
  const { user, isAdmin, logout } = useAuth();
  const { role: rawRole } = usePermission();
  const role = rawRole ?? 'viewer';
  const pathname = usePathname();

  // Configurable branding title (falls back to the default until loaded).
  useEffect(() => {
    getBrandingSettings().then((b) => setAppName(b.title)).catch(() => { /* keep default */ });
  }, []);

  // Header title: page-specific override, else the app name.
  const headerTitle = title ?? appName;

  // Hydrate the collapsed preference and reflect it on <html> so pages can
  // reflow their content offset (see .app-content in globals.css).
  useEffect(() => {
    const saved = (() => {
      try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
    })();
    setCollapsed(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-sidebar-collapsed', String(collapsed));
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  const isActive = (path: string) => pathname === path;

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  const navLinkClass = (path: string, iconOnly: boolean) =>
    `flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
      iconOnly ? 'justify-center px-2 py-2.5' : 'px-4 py-2.5'
    } ${
      isActive(path)
        ? 'bg-primary text-primary-foreground'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
    }`;

  // Navigation body shared by the desktop rail and the mobile drawer.
  const NavBody = ({ onNavigate, iconOnly = false }: { onNavigate?: () => void; iconOnly?: boolean }) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={navLinkClass(item.href, iconOnly)}
          title={iconOnly ? item.label : undefined}
          aria-label={item.label}
        >
          {item.icon}
          {!iconOnly && <span>{item.label}</span>}
        </Link>
      ))}
    </nav>
  );

  const SidebarBrand = ({ iconOnly = false }: { iconOnly?: boolean }) => (
    <div className={`flex items-center border-b border-sidebar-border px-3 py-4 ${iconOnly ? 'justify-center' : 'justify-between'}`}>
      {!iconOnly && (
        <div className="flex items-center gap-2">
          <SiteLogo size="sm" />
          <span className="font-bold text-sidebar-foreground">{appName}</span>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={iconOnly ? 'Expand menu' : 'Collapse menu'}
        title={iconOnly ? 'Expand menu' : 'Collapse menu'}
        className="text-sidebar-foreground hover:bg-sidebar-accent"
      >
        {iconOnly ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>
    </div>
  );

  return (
    <>
      {/* Persistent desktop rail — width toggles between full and icon-only */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 h-full z-30 flex-col bg-sidebar border-r border-sidebar-border transition-[width] duration-300 ease-in-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarBrand iconOnly={collapsed} />
        <NavBody iconOnly={collapsed} />
      </aside>

      {/* Top bar (offset right of the rail on md+ via the page's .app-content) */}
      <header className="skeu-header px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-lg font-bold flex items-center gap-2 text-foreground">
            {titleIcon ?? <HardDrive className="h-5 w-5 text-primary" />}
            {headerTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label="Open user menu"
                >
                  <span className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow">
                    {user.username[0].toUpperCase()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{user.username}</span>
                  <Badge className={`${roleBadgeClass[role]} w-fit text-xs font-normal`}>
                    {roleLabels[role]}
                  </Badge>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout()}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-72 z-50 flex flex-col bg-sidebar border-r border-sidebar-border shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <SiteLogo size="sm" />
            <span className="font-bold text-sidebar-foreground">{appName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close navigation menu">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <NavBody onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
