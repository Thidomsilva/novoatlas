import { Mountain } from 'lucide-react';
import React from 'react';

export function AtlasLogo() {
  return (
    <div className="flex items-center gap-2 font-headline text-lg font-semibold">
      <Mountain className="h-6 w-6 text-primary" />
      <span>Atlas</span>
    </div>
  );
}
