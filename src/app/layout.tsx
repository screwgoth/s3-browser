import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { BucketProvider } from '@/context/BucketContext';
import { BucketAssignmentProvider } from '@/context/BucketAssignmentContext';
import fs from 'fs';
import path from 'path';
import { getBranding } from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: branding.title,
    description: branding.subtitle,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = fs.readFileSync(path.join(process.cwd(), 'VERSION'), 'utf8').trim();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');var c=localStorage.getItem('sidebar-collapsed')==='true';document.documentElement.setAttribute('data-sidebar-collapsed',String(c));}catch(e){}})();",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          <BucketAssignmentProvider>
            <BucketProvider>
              {children}
            </BucketProvider>
          </BucketAssignmentProvider>
        </AuthProvider>
        <Toaster />
        <div style={{ position: 'fixed', bottom: '10px', right: '10px', color: 'gray', fontSize: '12px' }}>
          {version}
        </div>
      </body>
    </html>
  );
}
