import React from 'react';

export const AppLogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1052 768" {...props}>
        <defs>
            <linearGradient id="app-logo-lipShade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#184B6E" stopOpacity=".9"/>
                <stop offset="1" stopColor="#184B6E" stopOpacity="0"/>
            </linearGradient>
            <filter id="app-logo-softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="6"/>
                <feOffset dx="0" dy="3" result="o"/>
                <feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
        <g transform="translate(520 116) rotate(-10)">
            <rect x="-12" y="-6" width="320" height="168" rx="16" fill="#0FA38A"/>
        </g>
        <g transform="translate(488 138) rotate(-7)">
            <rect x="0" y="0" width="340" height="176" rx="18" fill="#45C3B1"/>
            <rect x="12" y="12" width="316" height="152" rx="14" fill="none" stroke="#98E2D7" strokeWidth="10"/>
            <circle cx="188" cy="88" r="38" fill="#98E2D7" opacity=".95"/>
            <path d="M188 62v52" stroke="#45C3B1" strokeWidth="12" strokeLinecap="round"/>
            <path d="M170 80c0-11 8-18 18-18h9c10 0 18 7 18 18s-8 18-18 18h-18c-10 0-18 7-18 18s8 18 18 18h9c10 0 18-7 18-18" fill="none" stroke="#45C3B1" strokeWidth="12" strokeLinecap="round"/>
        </g>
        <g transform="translate(230 238) skewX(-8)">
            <rect x="18" y="16" width="520" height="408" rx="32" fill="#15456E" opacity=".55"/>
            <rect x="0" y="0" width="520" height="408" rx="32" fill="#1F5E8A" filter="url(#app-logo-softShadow)"/>
            <rect x="0" y="0" width="520" height="38" rx="32" fill="url(#app-logo-lipShade)"/>
            <rect x="20" y="22" width="160" height="26" rx="13" fill="#184B6E" opacity=".9"/>
            <rect x="12" y="12" width="496" height="384" rx="26" fill="none" stroke="#8AB3DA" strokeWidth="12" strokeDasharray="28 26" strokeLinecap="round" opacity=".95"/>
            <rect x="450" y="112" width="180" height="120" rx="18" fill="#15456E" opacity=".35"/>
            <rect x="438" y="96" width="180" height="120" rx="18" fill="#2A6CA0"/>
            <rect x="452" y="110" width="152" height="92" rx="14" fill="none" stroke="#8AB3DA" strokeWidth="10" strokeDasharray="26 24" strokeLinecap="round" opacity=".95"/>
            <circle cx="516" cy="156" r="20" fill="#F3C94C"/>
            <circle cx="516" cy="156" r="9" fill="#C39200" opacity=".85"/>
        </g>
    </svg>
);
