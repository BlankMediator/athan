import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/noto-sans-arabic';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import './browser.css';
import './styles.css';
import './mobile.css';
import './interaction.css';
import { isMobile } from './platform';
import { App } from './App';
import { isBrowser, prepareOffline } from './browser/offline';
const root = createRoot(document.getElementById('root')!);
async function start() {
  if (isBrowser) {
    document.documentElement.classList.add('browser-app');
    if (isMobile) document.documentElement.classList.add('mobile-app');
    else { const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = `${import.meta.env.BASE_URL}manifest.webmanifest`; document.head.append(manifest); }
    root.render(<div className="loading-state"><h1>Athan</h1><p>Opening your saved prayer companion…</p></div>);
    try { window.athan = isMobile ? await (await import('./mobile/api')).createMobileAPI() : await (await import('./browser/api')).createBrowserAPI(); }
    catch (error) { root.render(<div className="loading-state"><h1>Local storage needs attention.</h1><p>{String(error)}</p><p>Allow site data, free some browser storage, then reload. Existing settings have not been reset.</p><button className="button primary" onClick={() => location.reload()}>Try again</button></div>); return; }
    void prepareOffline();
  }
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
void start();
