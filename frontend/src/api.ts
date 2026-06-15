const API_URL = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

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
      'No pudimos conectarnos en este momento. Intenta nuevamente en unos segundos.'
    ) as Error & { cause?: unknown };
    connectionError.cause = error;
    throw connectionError;
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const requestError = new Error(error.detail || 'No pudimos completar la solicitud.') as Error & {
      status?: number;
    };
    requestError.status = response.status;
    throw requestError;
  }
  return response.json();
}

export const api = {
  url: API_URL,
  get: (path: string) => request(path),
  post: (path: string, body: unknown) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: 'DELETE' })
};

export function productImageUrl(imagenUrl?: string) {
  return imagenUrl?.startsWith('http') ? imagenUrl : '';
}

export function storeLogoUrl(logoUrl?: string) {
  return logoUrl?.startsWith('http') ? logoUrl : '';
}
