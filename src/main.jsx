import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapPlatformContent, platformContentConfig } from './data/platformContent';
import { initGtm } from './analytics/gtm';
import './styles.css';

// Initialise GTM early so the container script loads promptly.
// No-op when VITE_GTM_ID is missing.
initGtm();

const platformApi = platformContentConfig(import.meta.env || {}).apiUrl;
if (platformApi && typeof document !== 'undefined') {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = platformApi;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<main className="platform-content-loading" role="status"><span aria-hidden="true" /><strong>Loading i-play…</strong></main>);

bootstrapPlatformContent().then(() => {
  root.render(<React.StrictMode><App /></React.StrictMode>);
}).catch((error) => {
  // Platform content unavailable → keep the static VELVET catalog as fallback.
  console.warn('iGroup platform content unavailable; falling back to the static VELVET catalog.', error);
  root.render(<React.StrictMode><App /></React.StrictMode>);
});
