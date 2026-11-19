/**
 * État de la session, partagé par toute l'application via `useAuth()`.
 * Le fournisseur (AuthProvider.tsx) est placé dans App.
 */
import { createContext, useContext } from "react";
import type { AccessTokenSource } from "../../services/apiClient";
import type { LoginInput, RegisterInput, SessionUser } from "../../services/authService";

export type AuthStatus =
  /** Vérification de la session en cours (au chargement de la page). */
  "loading" | "authenticated" | "anonymous";

/**
 * `getAccessToken` / `renewAccessToken` (AccessTokenSource) : à passer tels quels
 * aux services des routes protégées (ex. companyOffersService), qui renouvellent
 * la session si le jeton a expiré.
 */
export type AuthContextValue = AccessTokenSource & {
  status: AuthStatus;
  user: SessionUser | null;
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
