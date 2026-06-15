const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (error) {
    const connectionError = new Error(
      'No pudimos cargar las tiendas en este momento. Intenta nuevamente en unos segundos.'
    ) as Error & { cause?: unknown };
    connectionError.cause = error;
    throw connectionError;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error de API' }));
    throw new Error(error.detail || 'Error de API');
  }
  return response.json();
}

export const api = {
  url: API_URL,
  get: (path: string) => request(path),
  post: (path: string, body: unknown) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' }),
  upload: (path: string, formData: FormData) => request(path, { method: 'POST', body: formData })
};

export function productImageUrl(imagenUrl?: string) {
  if (!imagenUrl) return '';
  if (imagenUrl.startsWith('http')) return imagenUrl;
  const fileName = imagenUrl.split('/').pop();
  return `${API_URL}/api/v1/productos/imagenes/${fileName}`;
}

export function storeLogoUrl(logoUrl?: string) {
  if (!logoUrl) return '';
  if (logoUrl.startsWith('http')) return logoUrl;
  const fileName = logoUrl.split('/').pop();
  return `${API_URL}/api/v1/tiendas/logos/${fileName}`;
}
