import React, { useEffect, useMemo } from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function ProfilePageIsland({ root }) {
  const payload = useMemo(() => readPayload(root), [root]);
  const html = typeof payload.html === 'string' ? payload.html : '';

  useEffect(() => {
    window.goodfellasHydrateDynamicContent?.(root);

    if (typeof window.goodfellasInitPlayers === 'function') {
      window.goodfellasInitPlayers();
      return;
    }

    const existingScript = document.querySelector('script[data-goodfellas-players-script]');
    if (existingScript) {
      existingScript.addEventListener('load', () => window.goodfellasInitPlayers?.(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'assets/jugadores.js';
    script.dataset.goodfellasPlayersScript = '1';
    script.async = false;
    document.body.appendChild(script);
  }, [root, html]);

  return (
    <div
      className="profile-page-react grid gap-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
