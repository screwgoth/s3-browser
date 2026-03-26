"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Trash2, ImageIcon } from 'lucide-react';
import { uploadLogo, getLogoUrl, removeLogo } from '@/actions/logo';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function LogoUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getLogoUrl().then(setLogoUrl);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('logo', file);

    const result = await uploadLogo(formData, user?.username ?? 'admin');
    if (result.success && result.url) {
      setLogoUrl(result.url + '?t=' + Date.now()); // bust cache
      toast({ title: 'Logo uploaded', description: 'Logo will appear on all pages.', duration: 2000 });
    } else {
      toast({ variant: 'destructive', title: 'Upload failed', description: result.error });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async () => {
    await removeLogo(user?.username ?? 'admin');
    setLogoUrl(null);
    toast({ title: 'Logo removed', duration: 1500 });
  };

  return (
    <Card className="skeu-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Site Logo</CardTitle>
        <CardDescription>Upload a logo to display on the login page and all page headers. PNG, JPG, SVG or WebP — max 2MB.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {logoUrl ? (
          <div className="flex items-center gap-4 p-4 border rounded-xl bg-white/60 shadow-inner">
            <Image src={logoUrl} alt="Current logo" width={80} height={80} className="object-contain h-16 w-auto rounded" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">Current logo</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-1" /> Replace
              </Button>
              <Button variant="destructive" size="sm" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload logo</p>
            <Button variant="outline" size="sm" disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" /> {uploading ? 'Uploading...' : 'Choose File'}
            </Button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </CardContent>
    </Card>
  );
}
