/**
 * Application entry point.
 *
 * Renders the root {@link App} component into the `#root` DOM element.
 *
 * @module
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in the DOM.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
