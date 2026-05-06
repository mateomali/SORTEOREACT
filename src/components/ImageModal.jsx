import { Modal } from './Modal.jsx';

export function ImageModal({ open, src, alt = '', onClose }) {
  return (
    <Modal open={open} title={alt || 'Imagen'} onClose={onClose}>
      {src ? <img className="react-image-modal-img" src={src} alt={alt} /> : null}
    </Modal>
  );
}
