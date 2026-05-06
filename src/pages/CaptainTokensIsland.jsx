import { useState } from 'react';

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  return copied;
}

function CaptainTokenCard({ card }) {
  const [copyLabel, setCopyLabel] = useState('Copiar');
  const [shareLabel, setShareLabel] = useState('Compartir');

  const flashCopy = (labelSetter, label, fallback) => {
    labelSetter(label);
    window.setTimeout(() => labelSetter(fallback), 1600);
  };

  const handleCopy = async () => {
    await copyText(card.token || '');
    flashCopy(setCopyLabel, 'Copiado', 'Copiar');
  };

  const handleShare = async () => {
    const text = card.share_text || card.token || '';
    if (navigator.share) {
      try {
        await navigator.share({ text });
        flashCopy(setShareLabel, 'Compartido', 'Compartir');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyText(text);
    flashCopy(setShareLabel, 'Copiado', 'Compartir');
  };

  return (
    <div className="stat-box captain-token-card">
      <div className="label">Token {card.name}</div>
      <input type="text" readOnly value={card.token || ''} onClick={(event) => event.currentTarget.select()} />
      <div className="captain-link-actions">
        <button className="btn btn-primary" type="button" onClick={handleShare}>{shareLabel}</button>
        <button className="btn btn-muted" type="button" onClick={handleCopy}>{copyLabel}</button>
        <a className="btn btn-muted" href={card.open_url || '#'}>Abrir</a>
      </div>
    </div>
  );
}

export function CaptainTokensIsland({ root }) {
  const cards = JSON.parse(root.dataset.captainCards || '[]');

  if (!cards.length) {
    return null;
  }

  return (
    <div className="grid cols-2 mb-3 captain-token-grid">
      {cards.map((card) => (
        <CaptainTokenCard key={`${card.team}-${card.token}`} card={card} />
      ))}
    </div>
  );
}
