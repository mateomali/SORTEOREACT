(() => {
  const textSource = document.querySelector('[data-finish-share-text]');
  if (!textSource || textSource.dataset.finishShareBound === '1') return;
  textSource.dataset.finishShareBound = '1';

  const getText = () => textSource.value || textSource.textContent || '';
  const copyText = async (text) => {
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
  };

  const flashButton = (button, label) => {
    const original = button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  };

  const openAndroidShareSheet = (text) => {
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (!isAndroid) return false;
    const encodedText = encodeURIComponent(text);
    window.location.href = `intent://share/#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encodedText};end`;
    return true;
  };

  document.querySelector('[data-finish-share]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const text = getText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        flashButton(button, 'Compartido');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    if (openAndroidShareSheet(text)) {
      flashButton(button, 'Abriendo...');
      return;
    }
    await copyText(text);
    flashButton(button, 'Copiado');
  });

  document.querySelector('[data-finish-copy]')?.addEventListener('click', async (event) => {
    await copyText(getText());
    flashButton(event.currentTarget, 'Copiado');
  });
})();
