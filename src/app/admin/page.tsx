"use client";

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Settings } from 'lucide-react';
import { LogoUpload } from '@/components/logo-upload';
import { AppSidebar } from '@/components/app-sidebar';

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
      <AppSidebar title="Admin Settings" titleIcon={<Settings className="h-5 w-5" />} />

      <main className="p-6 md:p-10 max-w-3xl mx-auto space-y-8">
        <LogoUpload />
      </main>
    </div>
  );
}
