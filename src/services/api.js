export async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'fetch',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (error) {
    data = text;
  }

  if (!response.ok) {
    const message = data?.message || 'No se pudo completar la accion.';
    throw new Error(message);
  }

  return data;
}

export function formDataWithAjax(form) {
  const formData = new FormData(form);
  formData.set('ajax', '1');
  return formData;
}
