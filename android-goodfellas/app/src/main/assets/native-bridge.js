(() => {
  if (window !== window.top || window.__goodfellasNativeBridge) return;
  window.__goodfellasNativeBridge = true;
  const bridge = window.GoodfellasNative;
  if (!bridge) return;
  const pending = new Map();
  let sequence = 0;
  bridge.onmessage = event => {
    const reply = JSON.parse(event.data);
    const request = pending.get(reply.id);
    if (!request) return;
    pending.delete(reply.id);
    reply.ok ? request.resolve() : request.reject(new DOMException(reply.error || 'Operación cancelada', reply.cancelled ? 'AbortError' : 'OperationError'));
  };
  const send = payload => new Promise((resolve, reject) => {
    const id = String(++sequence);
    pending.set(id, { resolve, reject });
    try { bridge.postMessage(JSON.stringify({ ...payload, id })); }
    catch (error) { pending.delete(id); reject(error); }
  });
  window.goodfellasSpeak = text => send({ action: 'speak', text: String(text) });
  // SPA navigation does not call WebView.onPageFinished. Follow the live island too.
  let liveScreen;
  const updateLiveScreen = () => {
    const enabled = !!document.querySelector('[data-react-island="live_matches"]');
    if (enabled === liveScreen) return;
    liveScreen = enabled;
    send({ action: 'live_screen', enabled }).catch(() => {});
  };
  const watchLiveScreen = () => {
    updateLiveScreen();
    new MutationObserver(updateLiveScreen).observe(document.documentElement, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchLiveScreen, { once: true });
  else watchLiveScreen();
  const encode = blob => new Promise((resolve, reject) => {
    if (blob.size > 32 * 1024 * 1024) return reject(new Error('El archivo supera 32 MB.'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });
  const download = async (url, name) => {
    if (/^(blob:|data:)/i.test(url)) {
      const response = await fetch(url);
      const blob = await response.blob();
      return send({ action: 'save', name: name || 'goodfellas-exportacion', mime: blob.type, data: await encode(blob) });
    }
    return send({ action: 'download', url: new URL(url, location.href).href, name });
  };
  const notifyError = error => { if (error.name !== 'AbortError') alert(error.message || 'No se pudo exportar el archivo.'); };
  const intercept = anchor => {
    const href = anchor.href;
    if (!href || (!anchor.hasAttribute('download') && !/^(blob:|data:)/i.test(href))) return false;
    download(href, anchor.download).catch(notifyError);
    return true;
  };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a');
    if (anchor && intercept(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  // Programmatic exports often click a detached anchor, which never reaches document.
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (intercept(this)) return;
    return originalClick.call(this);
  };
  // Backup exports use POST and must retain the form's token and request body.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.querySelector('[name="action"]')?.value !== 'export_backup') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    (async () => {
      const response = await fetch(form.getAttribute('action') || location.href, { method: 'POST', body: new FormData(form), credentials: 'same-origin' });
      if (!response.ok || /text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('No se pudo exportar el backup. Revisá tu sesión.');
      const disposition = response.headers.get('content-disposition') || '';
      const name = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'goodfellas-backup.zip';
      const blob = await response.blob();
      await send({ action: 'save', name, mime: blob.type, data: await encode(blob) });
    })().catch(notifyError);
  }, true);
  window.__goodfellasDownload = (url, name) => download(url, name).catch(notifyError);
  Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
    const files = data.files || [];
    if (files.length > 1) throw new Error('Compartí un archivo por vez.');
    const file = files[0];
    return send({ action: 'share', title: data.title || '', text: data.text || '', url: data.url || '',
      ...(file ? { name: file.name, mime: file.type, data: await encode(file) } : {}) });
  }});
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => !data.files || (data.files.length === 1 && data.files[0].size <= 32 * 1024 * 1024) });
  const clipboard = navigator.clipboard || {};
  Object.defineProperty(clipboard, 'writeText', { configurable: true, value: text => send({ action: 'clipboard', text: String(text) }) });
  if (!navigator.clipboard) Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
  window.print = () => send({ action: 'print' }).catch(notifyError);
})();
