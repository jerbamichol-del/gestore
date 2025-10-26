
import React from 'react';

export const AppLogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="app-logo-wallet-gradient" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366F1"/>
        <stop offset="1" stopColor="#4F46E5"/>
      </linearGradient>
      <filter id="app-logo-shadow" x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#4338ca" floodOpacity="0.4"/>
      </filter>
    </defs>
    <g filter="url(#app-logo-shadow)">
      {/* Back part of wallet */}
      <rect x="10" y="24" width="60" height="40" rx="8" fill="url(#app-logo-wallet-gradient)"/>
      
      {/* Receipt paper */}
      <rect x="22" y="12" width="36" height="30" rx="4" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2"/>
      <path d="M29 22H51" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
      <path d="M29 29H43" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
      
      {/* Front part of wallet */}
      <rect x="10" y="30" width="60" height="34" rx="8" fill="#4F46E5"/>
    </g>
  </svg>
);
