import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/dynamic-progress.css';
import './styles/components.css';
import './styles/layouts.css';

// Apply initial theme before React renders
const storedTheme = localStorage.getItem('bh_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = storedTheme === 'dark' || (!storedTheme && prefersDark);

if (initialTheme) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
