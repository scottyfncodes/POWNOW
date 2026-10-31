import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { IntroSplash } from './ui/components/IntroSplash';
import './styles/global.css';
import './styles/components.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing.');

createRoot(container).render(
  <StrictMode>
    <App />
    <IntroSplash />
  </StrictMode>,
);
