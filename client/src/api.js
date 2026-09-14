const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
export function clearSession() {
  localStorage.removeItem("helpDeskToken");
  localStorage.removeItem("helpDeskUser");
}
export async function api(path, options = {}) {
  const token = localStorage.getItem("helpDeskToken");
  let response;
  try {
    response = await fetch(API_URL + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...options.headers }
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Cannot reach the API. Check that the server is running.");
  }
  const data = await response.json().catch(() => ({ message: "Server returned an unreadable response." }));
  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith("/auth/login")) {
      clearSession();
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new Error(data.message || "Request failed.");
  }
  return data;
}
