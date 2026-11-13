import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { startPwa } from './lib/pwa.js';
import './lib/installPrompt.js'; // listen for beforeinstallprompt before React mounts
import { detectLang } from './lib/i18n.js';
import { getLang } from './lib/storage.js';
import './styles.css';

startPwa();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary lang={getLang() || detectLang()}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
