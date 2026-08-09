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
  console.error('iGroup platform content failed to load', error);
  root.render(<main className="platform-content-error" role="alert"><strong>i-play content is temporarily unavailable.</strong><p>{error.message}</p><button onClick={() => window.location.reload()} type="button">Try again</button></main>);
});
