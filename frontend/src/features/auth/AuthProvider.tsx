/**
 * Fournit l'état de session à toute l'application.
 *
 * - Au chargement (et après F5) : la session est restaurée grâce au cookie httpOnly
 *   (POST /api/auth/refresh). Sans cookie valide → « anonymous ».
 * - Le jeton d'accès est gardé dans une référence React (mémoire) : il disparaît à
 *   la fermeture de l'onglet et n'est jamais écrit dans localStorage.
 * - Il est renouvelé automatiquement une minute avant son expiration.
 *
 * Ces vérifications côté client servent l'affichage ; la vraie protection est
 * appliquée par l'API (gardes JwtAuthGuard et RolesGuard).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../../services/apiClient";
import * as authService from "../../services/authService";
import type { AuthResponse, SessionUser } from "../../services/authService";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);
  const accessToken = useRef<string | null>(null);
  const renewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearSession = useCallback(() => {
    clearTimeout(renewTimer.current);
    accessToken.current = null;
    setUser(null);
    setStatus("anonymous");
  }, []);

  const applySession = useCallback(
    (response: AuthResponse): SessionUser => {
      accessToken.current = response.accessToken;
      setUser(response.user);
      setStatus("authenticated");
      // Renouvellement automatique avant expiration (au minimum après 10 s).
      clearTimeout(renewTimer.current);
      renewTimer.current = setTimeout(
        () => {
          authService.refreshSession().then(applySession, clearSession);
        },
        Math.max(response.expiresIn - 60, 10) * 1000,
      );
      return response.user;
    },
    [clearSession],
  );

  const applySessionToken = useCallback(
    (response: AuthResponse): string => {
      applySession(response);
      return response.accessToken;
    },
    [applySession],
  );

  // Restauration de la session au chargement de la page.
  useEffect(() => {
    let active = true;
    authService.refreshSession().then(
      (response) => {
        if (active) applySession(response);
      },
      () => {
        if (active) clearSession();
      },
    );
    return () => {
      active = false;
      clearTimeout(renewTimer.current);
    };
  }, [applySession, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      getAccessToken: () => accessToken.current,
      // Renouvellement à la demande (jeton expiré ou refusé par l'API).
      // Session refusée (401) → déconnexion locale et null ; autre erreur
      // (réseau…) → remontée telle quelle, la session reste ouverte.
      renewAccessToken: async () => {
        try {
          return applySessionToken(await authService.refreshSession());
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            clearSession();
            return null;
          }
          throw error;
        }
      },
      login: async (input) => applySession(await authService.login(input)),
      register: async (input) => applySession(await authService.register(input)),
      logout: async () => {
        try {
          await authService.logout();
        } finally {
          // Même si le serveur est injoignable, la session locale est effacée.
          clearSession();
        }
      },
    }),
    [status, user, applySession, applySessionToken, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
