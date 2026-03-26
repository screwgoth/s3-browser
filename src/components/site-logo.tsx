"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getLogoUrl } from '@/actions/logo';

interface SiteLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { width: 32, height: 32, className: 'h-8 w-auto' },
  md: { width: 48, height: 48, className: 'h-12 w-auto' },
  lg: { width: 120, height: 120, className: 'h-24 w-auto' },
};

export function SiteLogo({ size = 'md', className = '' }: SiteLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    getLogoUrl().then(setLogoUrl);
  }, []);

  if (!logoUrl) return null;

  const { width, height, className: sizeClass } = sizeMap[size];

  return (
    <Image
      src={logoUrl}
      alt="Site Logo"
      width={width}
      height={height}
      className={`object-contain drop-shadow-md ${sizeClass} ${className}`}
      priority
    />
  );
}
