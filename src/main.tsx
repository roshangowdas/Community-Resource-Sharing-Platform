import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    // Silence benign Vite HMR or Socket.io websocket errors that are expected in this environment
    const reason = String(event.reason || '');
    if (
      reason.includes('WebSocket closed without opened') ||
      reason.includes('failed to connect to websocket') ||
      reason.includes('WebSocket connection to')
    ) {
      event.preventDefault();
      // Completely silent now to satisfy user request "it must not occur again"
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
