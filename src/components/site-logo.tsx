"use client";

import { useEffect, useState } from 'react';
import { getLogoUrl } from '@/actions/logo';

interface SiteLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-8 w-auto max-w-[120px]',
  md: 'h-12 w-auto max-w-[160px]',
  lg: 'h-24 w-auto max-w-[240px]',
};

export function SiteLogo({ size = 'md', className = '' }: SiteLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getLogoUrl().then((url) => {
      if (url) {
        // Cache-bust so updated logo always shows
        setLogoUrl(url + '?t=' + Date.now());
      }
    });
  }, []);

  if (!logoUrl) return null;

  return (
    // Use plain <img> — avoids Next.js Image domain/config issues for local uploads
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt="Site Logo"
      className={`object-contain drop-shadow-md ${sizeMap[size]} ${className}`}
    />
  );
}
