const API_URL = import.meta.env.VITE_API_URL || "";

function getToken() {
  return sessionStorage.getItem("token") || localStorage.getItem("token");
}

function clearAuthAndRedirectToLogin(expired = false) {
  for (const key of ["token", "userRole", "userId", "userEmail", "role", "user"]) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  const q = expired ? "?expired=1" : "";
  window.location.href = `/login${q}`;
}

function redirectToRoleDashboardOrLogin() {
  const role = sessionStorage.getItem("userRole") || localStorage.getItem("userRole");
  const path =
    role === "ADMIN" ? "/admin" : role === "MENTOR" ? "/mentor" : role === "USER" ? "/availability" : "/login";
  window.location.href = path;
}

export async function api(method, path, body, options = {}) {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    cache: "no-store",
    ...(body != null && { body: JSON.stringify(body) }),
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      if (!options.skipAuthRedirect) {
        clearAuthAndRedirectToLogin(true);
      }
      const err = new Error("Session expired");
      err.status = 401;
      throw err;
    }
    if (res.status === 403) {
      redirectToRoleDashboardOrLogin();
      const err = new Error("Redirecting");
      err.status = 403;
      err.data = data;
      throw err;
    }
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const get = (path) => api("GET", path);
export const post = (path, body) => api("POST", path, body);
export const put = (path, body) => api("PUT", path, body);
export const del = (path) => api("DELETE", path);
