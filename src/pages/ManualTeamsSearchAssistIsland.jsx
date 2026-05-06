import { useEffect, useState } from 'react';

export function ManualTeamsSearchAssistIsland({ root }) {
  const targetId = root.dataset.target || 'manualPlayerSearch';
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const input = document.getElementById(targetId);
    if (!input) return undefined;

    const sync = () => {
      setQuery(input.value || '');
      const cards = Array.from(document.querySelectorAll('.manual-player-card'));
      setTotal(cards.length);
      setVisible(cards.filter((card) => !card.closest('[hidden]') && !card.hidden).length);
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    input.addEventListener('input', sync);
    sync();

    return () => {
      observer.disconnect();
      input.removeEventListener('input', sync);
    };
  }, [targetId]);

  const clear = () => {
    const input = document.getElementById(targetId);
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  };

  return (
    <div className="manual-search-assist">
      <span aria-live="polite">
        {query.trim() === '' ? `${total} jugadores` : `${visible} visibles`}
      </span>
      {query.trim() !== '' ? (
        <button className="btn btn-muted" type="button" onClick={clear}>Limpiar</button>
      ) : null}
    </div>
  );
}
