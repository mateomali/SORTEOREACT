import { Button } from './Button.jsx';

export function ConfirmDialog({
  open,
  title = 'Confirmar accion',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  if (!open) return null;

  return (
    <div className="react-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="react-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="react-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h3 id="react-confirm-title">{title}</h3>
        {message ? <p>{message}</p> : null}
        <div className="btn-row">
          <Button className="btn-muted" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button className="btn-danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}
