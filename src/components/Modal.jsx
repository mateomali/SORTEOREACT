export function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="react-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="react-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="react-modal-head">
          <strong>{title}</strong>
          <button type="button" className="player-scout-close" onClick={onClose} aria-label="Cerrar">
            x
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
