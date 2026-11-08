import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

// Render synchronously while the page is still render-blocked (index.html), so a page-load
// cross-fade from Live camera lands on the finished view instead of an empty page.
const root = createRoot(document.getElementById('root')!);
flushSync(() => root.render(<StrictMode><App /></StrictMode>));
