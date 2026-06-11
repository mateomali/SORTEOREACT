import React, { useEffect, useMemo } from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function EncountersPageIsland({ root }) {
  const payload = useMemo(() => readPayload(root), [root]);
  const html = typeof payload.html === 'string' ? payload.html : '';

  useEffect(() => {
    window.goodfellasHydrateDynamicContent?.(root);
  }, [root, html]);

  return (
    <div
      className="encounters-page-react grid gap-3"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
