import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapPlatformContent } from './data/platformContent';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(<main className="platform-content-loading" role="status"><span aria-hidden="true" /><strong>Loading i-play…</strong></main>);

bootstrapPlatformContent().then(() => {
  root.render(<React.StrictMode><App /></React.StrictMode>);
}).catch((error) => {
  // Platform content unavailable → keep the static VELVET catalog as fallback.
  console.warn('iGroup platform content unavailable; falling back to the static VELVET catalog.', error);
  root.render(<React.StrictMode><App /></React.StrictMode>);
});
