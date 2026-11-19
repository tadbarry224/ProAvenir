/**
 * Entreprises à vérifier (espace administrateur), lues et modifiées via l'API :
 *   GET   /api/admin/companies
 *   PATCH /api/admin/companies/:id/status
 *
 * - Les droits sont vérifiés par le serveur (rôle ADMIN) ; ce hook ne fait qu'afficher.
 * - Les données sont propres à l'administrateur connecté : si le compte change,
 *   l'ancienne liste est effacée avant tout nouvel affichage.
 * - Après une décision, l'entreprise est mise à jour tout de suite (réponse du
 *   serveur), puis la liste est relue sans écran de chargement.
 * - Une seule décision à la fois (`pending`), pour éviter les doubles clics.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AccessTokenSource } from "../../services/apiClient";
import {
  fetchAdminCompanies,
  reviewCompany,
  type AdminCompanyApi,
  type CompanyReview,
} from "../../services/adminCompaniesService";
import type { AdminCompanyView } from "../../types/admin";
import { adminErrorFromApi, toAdminCompanyView, type AdminActionError } from "./adminCompanyView";

type LoadState =
  | { status: "idle" | "loading"; userId: string | null }
  | { status: "error"; userId: string | null; error: string }
  | { status: "success"; userId: string | null; companies: AdminCompanyApi[] };

export type AdminCompaniesState = {
  status: LoadState["status"];
  error: string;
  companies: AdminCompanyView[];
  /** Nombre d'entreprises en attente de vérification. */
  pendingCount: number;
  /** Entreprise dont la décision est en cours d'envoi, ou null. */
  pending: string | null;
  reload: () => void;
  /** null si la décision est enregistrée, sinon l'erreur à afficher. */
  review: (companyId: string, review: CompanyReview) => Promise<AdminActionError | null>;
};

const BUSY: AdminActionError = {
  kind: "other",
  message: "Une décision est déjà en cours. Patientez un instant.",
};

export function useAdminCompanies({
  session,
  userId,
  enabled,
  onSessionExpired,
}: {
  /** Session de `useAuth()` : jeton en mémoire, renouvelé si besoin. */
  session: AccessTokenSource;
  userId: string | null;
  /** Faux tant que l'espace administrateur n'est pas affiché (aucune requête). */
  enabled: boolean;
  /** Appelé quand la session a expiré (retour à la connexion avec un message). */
  onSessionExpired?: () => void;
}): AdminCompaniesState {
  const [state, setState] = useState<LoadState>({ status: "idle", userId });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (!enabled || !userId) {
      setState({ status: "idle", userId });
      return;
    }
    // Même administrateur : relecture silencieuse ; autre compte : on efface tout.
    setState((current) =>
      current.status === "success" && current.userId === userId
        ? current
        : { status: "loading", userId },
    );
    const controller = new AbortController();
    fetchAdminCompanies(sessionRef.current, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ status: "success", userId, companies: result.companies });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const failure = adminErrorFromApi(error);
        if (failure.kind === "session") onSessionExpired?.();
        setState({ status: "error", userId, error: failure.message });
      });
    return () => controller.abort();
    // `onSessionExpired` est recréée à chaque rendu : volontairement absente.
  }, [enabled, userId, attempt]);

  const mine = state.userId === userId ? state : null;
  const apiCompanies = mine?.status === "success" ? mine.companies : null;
  const companies = useMemo(() => apiCompanies?.map(toAdminCompanyView) ?? [], [apiCompanies]);

  return {
    status: mine?.status ?? "loading",
    error: mine?.status === "error" ? mine.error : "",
    companies,
    pendingCount: companies.filter((company) => company.status === "PENDING").length,
    pending,
    reload: () => setAttempt((n) => n + 1),
    review: async (companyId, review) => {
      if (busy.current) return BUSY;
      busy.current = true;
      setPending(companyId);
      try {
        const updated = await reviewCompany(sessionRef.current, companyId, review);
        // Mise à jour immédiate, puis relecture (l'ordre et les compteurs suivent).
        setState((current) =>
          current.status === "success"
            ? {
                ...current,
                companies: current.companies.map((c) => (c.id === updated.id ? updated : c)),
              }
            : current,
        );
        setAttempt((n) => n + 1);
        return null;
      } catch (error) {
        const failure = adminErrorFromApi(error);
        if (failure.kind === "session") onSessionExpired?.();
        // La liste affichée était périmée : on la relit.
        if (failure.kind === "stale") setAttempt((n) => n + 1);
        return failure;
      } finally {
        busy.current = false;
        setPending(null);
      }
    },
  };
}
