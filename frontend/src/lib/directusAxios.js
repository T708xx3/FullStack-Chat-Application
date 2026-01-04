// New: axios instance for Directus REST API
const DIRECTUS_BASE = import.meta.env.VITE_DIRECTUS_URL || "http://localhost:8055";

import axios from "axios";

export const directusAxios = axios.create({
  baseURL: DIRECTUS_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// helper to set auth token for Directus requests
export function setDirectusAuthToken(token) {
  if (token) {
    directusAxios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("token", token); // keep same storage key as before
  } else {
    delete directusAxios.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
  }
}
