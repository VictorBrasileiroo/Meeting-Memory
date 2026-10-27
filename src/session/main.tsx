import '../lib/ui-csp';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionApp } from './SessionApp';
import '../styles/global.css';
import './results.css';

createRoot(document.getElementById('root')!).render(<StrictMode><SessionApp /></StrictMode>);
