import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { CrashErrorBoundary } from './components/CrashErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <CrashErrorBoundary>
    <App />
  </CrashErrorBoundary>
);
