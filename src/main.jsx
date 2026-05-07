import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactIslandRegistry } from './pages/ReactIslandRegistry.jsx';

const mountReactIsland = (element) => {
  if (!element || element.dataset.reactMounted === '1') return;
  element.dataset.reactMounted = '1';
  createRoot(element).render(
    <React.StrictMode>
      <ReactIslandRegistry root={element} />
    </React.StrictMode>,
  );
};

document.querySelectorAll('[data-react-root]').forEach(mountReactIsland);

document.addEventListener('goodfellas:mount-react', (event) => {
  const root = event.detail?.root;
  if (root instanceof HTMLElement) {
    mountReactIsland(root);
  }
});
