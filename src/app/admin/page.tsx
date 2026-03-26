"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { LogoUpload } from '@/components/logo-upload';
import { SiteLogo } from '@/components/site-logo';

export default function AdminSettingsPage() {
  const { isAdmin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAdmin) router.push('/');
  }, [isAdmin, isLoading, router]);

  if (isLoading || !isAdmin) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen skeu-bg">
      <header className="skeu-header p-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-3">
          <SiteLogo size="sm" />
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" /> Admin Settings
          </h1>
        </div>
        <Link href="/">
          <Button variant="outline">← Back to Buckets</Button>
        </Link>
      </header>

      <main className="p-6 md:p-10 max-w-3xl mx-auto space-y-8">
        <LogoUpload />
      </main>
    </div>
  );
}
