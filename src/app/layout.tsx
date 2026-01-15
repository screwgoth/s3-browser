import type {Metadata} from 'next';
import { Toaster } from "@/components/ui/toaster"
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { BucketProvider } from '@/context/BucketContext';
import { UserProvider } from '@/context/UserContext';
import fs from 'fs';
import path from 'path';

export const metadata: Metadata = {
  title: 'S3 Navigator',
  description: 'A simple AWS S3 bucket browser app.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = fs.readFileSync(path.join(process.cwd(), 'VERSION'), 'utf8').trim();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <UserProvider>
          <AuthProvider>
            <BucketProvider>
              {children}
            </BucketProvider>
          </AuthProvider>
        </UserProvider>
        <Toaster />
        <div style={{ position: 'fixed', bottom: '10px', right: '10px', color: 'gray', fontSize: '12px' }}>
          {version}
        </div>
      </body>
    </html>
  );
}
