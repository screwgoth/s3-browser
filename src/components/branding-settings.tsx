"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Type, Loader2, Save } from 'lucide-react';
import { getBrandingSettings, updateBrandingSettings } from '@/actions/settings';
import { useToast } from '@/hooks/use-toast';

export function BrandingSettings() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [footer, setFooter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBrandingSettings().then((b) => {
      setTitle(b.title);
      setSubtitle(b.subtitle);
      setFooter(b.footer);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateBrandingSettings({ title, subtitle, footer });
    if (result.success && result.branding) {
      setTitle(result.branding.title);
      setSubtitle(result.branding.subtitle);
      setFooter(result.branding.footer);
      toast({ title: 'Branding saved', description: 'Login page text updated.', duration: 2000 });
    } else {
      toast({ variant: 'destructive', title: 'Save failed', description: result.error });
    }
    setSaving(false);
  };

  return (
    <Card className="skeu-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" /> Branding</CardTitle>
        <CardDescription>
          Customize the application title, subtitle and footer shown on the login page. Leave a field
          empty to fall back to the default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="branding-title">Application Title</Label>
              <Input
                id="branding-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="S3 Navigator"
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branding-subtitle">Subtitle</Label>
              <Input
                id="branding-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Secure S3 bucket management"
                className="bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branding-footer">Footer Text</Label>
              <Input
                id="branding-footer"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Secure S3 Bucket Management"
                className="bg-card"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="skeu-btn border-0">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Branding'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
