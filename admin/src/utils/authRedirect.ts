let redirecting = false;

/** 401 时统一跳转登录页，避免并发请求重复触发整页刷新。 */
export function redirectToLogin(): void {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const loginPath = `${base}/login`;
  if (window.location.pathname === loginPath || window.location.pathname.endsWith('/login')) {
    return;
  }
  if (redirecting) return;
  redirecting = true;
  localStorage.removeItem('auth_token');
  window.location.href = `${base}/login`;
}
