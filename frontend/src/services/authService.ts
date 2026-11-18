/**
 * Authentification : POST /api/auth/register | login | refresh | logout, GET /api/auth/me.
 *
 * - Le jeton d'accès (JWT, 15 min) est renvoyé dans la réponse et gardé EN MÉMOIRE
 *   par l'application (jamais dans localStorage, lisible par un script malveillant).
 * - Le jeton de rafraîchissement voyage dans un cookie httpOnly posé par l'API :
 *   le JavaScript ne peut ni le lire ni le voler ; `credentials: "include"` demande
 *   au navigateur de l'envoyer.
 * - L'en-tête X-ProAvenir-CSRF prouve que la requête vient de l'application
 *   (un autre site ne peut pas l'ajouter) : protection contre le CSRF.
 */
import type { UserRole } from "../types/auth";
import { ApiError, apiRequest } from "./apiClient";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  company: { id: string; name: string; status: "PENDING" | "APPROVED" | "REJECTED" } | null;
};

export type AuthResponse = {
  accessToken: string;
  /** Validité du jeton d'accès, en secondes. */
  expiresIn: number;
  user: SessionUser;
};

export type LoginInput = { email: string; password: string; rememberMe: boolean };

export type RegisterInput = {
  role: "CANDIDATE" | "COMPANY";
  fullName: string;
  companyName?: string;
  email: string;
  password: string;
};

const SESSION_REQUEST = {
  method: "POST",
  credentials: "include",
  headers: { "X-ProAvenir-CSRF": "1" },
} as const;

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", { ...SESSION_REQUEST, body: input });
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", { ...SESSION_REQUEST, body: input });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/auth/logout", SESSION_REQUEST);
}

/** Une seule demande de renouvellement à la fois (évite deux rotations concurrentes). */
let refreshInFlight: Promise<AuthResponse> | null = null;

/**
 * Restaure / prolonge la session à partir du cookie (ex. après F5).
 * Si un autre onglet vient de renouveler la session (SESSION_ROTATED), le
 * navigateur a déjà reçu le nouveau cookie : on réessaie une fois.
 */
export function refreshSession(): Promise<AuthResponse> {
  refreshInFlight ??= (async () => {
    try {
      return await apiRequest<AuthResponse>("/auth/refresh", SESSION_REQUEST);
    } catch (error) {
      if (error instanceof ApiError && error.code === "SESSION_ROTATED") {
        return apiRequest<AuthResponse>("/auth/refresh", SESSION_REQUEST);
      }
      throw error;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function fetchMe(accessToken: string): Promise<SessionUser> {
  return apiRequest<SessionUser>("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
