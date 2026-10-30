import { useEffect, useId, useRef, useState } from 'react';

// Keep explanations inline on desktop and within reach on small screens.
export function DrawHelp({ title, children, disclosure = false, heading = false, modalOnly = false, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    const media = window.matchMedia('(max-width: 760px)');
    const resize = () => { if (!modalOnly && !media.matches) setOpen(false); };
    media.addEventListener('change', resize);
    return () => {
      media.removeEventListener('change', resize);
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, modalOnly]);
  return <div className="draw-help" data-heading-help={heading || undefined} data-modal-only={modalOnly || undefined} data-compact={compact || undefined}>
    <div className="draw-help-mobile"><span>{title}</span><button type="button" className="draw-help-trigger" aria-label={`Ayuda: ${title}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>?</button></div>
    {!modalOnly && !open && (disclosure ? <details className="draw-help-inline gf-scoring-help"><summary>{title}</summary>{children}</details> : <div className="draw-help-inline">{children}</div>)}
    <dialog ref={ref} className="draw-help-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => { if(event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false); } }}>
      <header><h2 id={titleId}>{title}</h2><button type="button" className="gf-button gf-button-quiet" aria-label={`Cerrar ayuda: ${title}`} onClick={() => setOpen(false)}>Cerrar</button></header>
      <div className="draw-help-content">{open && children}</div>
    </dialog>
  </div>;
}
