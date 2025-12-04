import React from 'react';

export const AppLogoIcon: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => (
  <img
    // import.meta.env.BASE_URL contiene già "/gestore/" definito nel config
    src={`${import.meta.env.BASE_URL}logo.png`} 
    alt="Gestore Spese Logo"
    {...props}
  />
);
