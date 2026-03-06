const AUTH_TOKEN_KEY = 'sd_auth_token';
const CSRF_KEY = 'sd_csrf';

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function getCsrfToken() {
  return localStorage.getItem(CSRF_KEY) || 'local-preview';
}

export function storeSession(token, csrfToken) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (csrfToken) localStorage.setItem(CSRF_KEY, csrfToken);
}

export function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function authRequest(path, { method = 'GET', body } = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (method !== 'GET') {
    headers['x-csrf-token'] = getCsrfToken();
    headers['x-csrf-cookie'] = getCsrfToken();
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export async function ensureUser() {
  return authRequest('/api/auth/me');
}
