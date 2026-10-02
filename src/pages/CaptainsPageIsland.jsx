import React, { useEffect, useMemo } from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function CaptainsPageIsland({ root }) {
  const payload = useMemo(() => readPayload(root), [root]);
  const html = typeof payload.html === 'string' ? payload.html : '';

  useEffect(() => {
    window.goodfellasHydrateDynamicContent?.(root);

    if (!root.querySelector('.captain-board')) {
      return;
    }

    if (typeof window.goodfellasInitCaptains === 'function') {
      window.goodfellasInitCaptains();
      return;
    }

    const existingScript = document.querySelector('script[data-goodfellas-captains-script]');
    if (existingScript) {
      existingScript.addEventListener('load', () => window.goodfellasInitCaptains?.(), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'assets/capitanes.js';
    script.dataset.goodfellasCaptainsScript = '1';
    script.async = false;
    document.body.appendChild(script);
  }, [root, html]);

  return (
    <div
      className="captains-page-react grid gap-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
