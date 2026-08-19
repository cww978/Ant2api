export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('ant2api_auth_token') || '';
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('ant2api_auth_token');
    window.dispatchEvent(new CustomEvent('ant2api:unauthorized'));
    throw new Error('未授权或登录已过期，请重新输入密码');
  }

  const data = await response.json();
  return data as T;
}
