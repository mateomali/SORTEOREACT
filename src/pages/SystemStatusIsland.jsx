import { useMemo } from 'react';

export function SystemStatusIsland({ root }) {
  const payload = useMemo(() => {
    const raw = root.querySelector('script[type="application/json"]')?.textContent || '{}';
    try {
      return JSON.parse(raw);
    } catch (error) {
      return {};
    }
  }, [root]);

  return (
    <div className="react-system-status" aria-label="Estado del sistema interactivo">
      <strong>{payload.label || 'Interfaz interactiva'}</strong>
      <span>{payload.message || 'React cargado en modo progresivo.'}</span>
    </div>
  );
}
