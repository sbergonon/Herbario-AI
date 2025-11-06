
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApiKeyProvider } from './contexts/ApiKeyContext';
import { LanguageProvider } from './contexts/LanguageContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz para montar la aplicación.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ApiKeyProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ApiKeyProvider>
  </React.StrictMode>
);