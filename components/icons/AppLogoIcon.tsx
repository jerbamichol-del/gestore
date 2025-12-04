import React from 'react';

export const AppLogoIcon: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => (
  <img
    src="/logo.png"
    alt="Gestore Spese Logo"
    {...props}
  />
);
