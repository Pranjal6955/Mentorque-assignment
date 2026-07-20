import { api, post } from "./client.js";

export async function register(data) {
  return post("/api/auth/register", data);
}

export async function login(data) {
  return post("/api/auth/login", data);
}

export async function me() {
  return api("GET", `/api/auth/me?_=${Date.now()}`, null, { skipAuthRedirect: true });
}
