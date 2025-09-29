import React from 'react';

export function AtlasLogo() {
  return (
    <div className="flex items-center gap-2 font-headline text-lg font-semibold">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary"
      >
        <path
          d="M3.5 18.5L9.5 6.5L13.5 14.5L16.5 8.5L20.5 18.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="group-data-[collapsible=icon]:hidden">Atlas</span>
    </div>
  );
}
