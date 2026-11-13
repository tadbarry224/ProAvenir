/**
 * État de la session, partagé par toute l'application via `useAuth()`.
 * Le fournisseur (AuthProvider.tsx) est placé dans App.
 */
import { createContext, useContext } from "react";
import type { LoginInput, RegisterInput, SessionUser } from "../../services/authService";

export type AuthStatus =
  /** Vérification de la session en cours (au chargement de la page). */
  "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  /** Jeton d'accès courant (en mémoire uniquement), pour les appels protégés. */
  getAccessToken: () => string | null;
  login: (input: LoginInput) => Promise<SessionUser>;
  register: (input: RegisterInput) => Promise<SessionUser>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>.");
  return value;
}
