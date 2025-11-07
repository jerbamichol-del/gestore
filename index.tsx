import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Fix globale: rimuove il focus "appiccicoso" prima del tap successivo
import { installGlobalFirstTapFix } from './utils/mobileFocusFix';
installGlobalFirstTapFix(document);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
