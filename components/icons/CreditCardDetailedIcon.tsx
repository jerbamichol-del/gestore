import React from 'react';

export const CreditCardDetailedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    version="1.1" 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 64 64" 
    xmlSpace="preserve"
    {...props}
  >
    <g id="Layer_1">
        <g>
            <circle fill="#77B3D4" cx="32" cy="32" r="32"/>
        </g>
        <g opacity="0.2">
            <path fill="#231F20" d="M52,45c0,2.2-1.8,4-4,4H16c-2.2,0-4-1.8-4-4V25c0-2.2,1.8-4,4-4h32c2.2,0,4,1.8,4,4V45z"/>
        </g>
        <g>
            <path fill="#FFFFFF" d="M52,43c0,2.2-1.8,4-4,4H16c-2.2,0-4-1.8-4-4V23c0-2.2,1.8-4,4-4h32c2.2,0,4,1.8,4,4V43z"/>
        </g>
        <g>
            <rect x="12" y="25" fill="#4F5D73" width="40" height="6"/>
        </g>
        <g>
            <circle fill="#E0995E" cx="38" cy="41" r="2"/>
        </g>
        <g>
            <circle fill="#E0995E" cx="46" cy="41" r="2"/>
        </g>
        <g>
            <circle fill="#E0995E" cx="30" cy="41" r="2"/>
        </g>
    </g>
  </svg>
);
