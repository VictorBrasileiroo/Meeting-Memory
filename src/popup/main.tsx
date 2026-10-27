import '../lib/ui-csp';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './PopupApp';
import { isExtensionContext } from '../messaging/client';
import './popup-entry.css';

// Give the extension window an intrinsic width before rendering its content.
// A viewport-based cap alone can keep an automatically sized popup too narrow.
if (isExtensionContext()) document.documentElement.classList.add('extension-popup');

createRoot(document.getElementById('root')!).render(<StrictMode><PopupApp /></StrictMode>);
