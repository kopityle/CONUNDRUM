import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './css/index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
const rawBasename = import.meta.env.BASE_URL || '/';
const basename = rawBasename === '/' ? '/' : rawBasename.replace(/\/$/, '');

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
