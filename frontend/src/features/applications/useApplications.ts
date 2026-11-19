/**
 * Candidatures réelles (API, étape B5) :
 * - `useCandidateApplications` : celles du candidat connecté, et « postuler » ;
 * - `useReceivedApplications` : celles reçues par l'entreprise connectée, et le
 *   changement de statut.
 *
 * Règles communes :
 * - les données sont rattachées à l'utilisateur connecté : si le compte change,
 *   l'ancienne liste est effacée avant tout nouvel affichage (aucune fuite) ;
 * - après une modification, l'élément est mis à jour tout de suite (réponse du
 *   serveur), puis la liste est relue sans écran de chargement ;
 * - une seule modification à la fois (`pending`), contre les doubles clics ;
 * - une erreur n'est jamais remplacée par des données fictives.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AccessTokenSource } from "../../services/apiClient";
import { saveFile } from "../../lib/saveFile";
import {
  applyToOffer,
  changeApplicationStatus,
  downloadApplicationCv,
  fetchMyApplications,
  fetchReceivedApplications,
  type ApplicationStatusTarget,
  type CandidateApplicationApi,
  type ReceivedApplicationApi,
} from "../../services/applicationsService";
import type { CandidateApplicationView, RecruitApplicationView } from "../../types/application";
import {
  applicationErrorFromApi,
  toCandidateApplicationView,
  toRecruitApplicationView,
  type ApplicationActionError,
} from "./applicationView";

type ListOptions = {
  /** Session de `useAuth()` : jeton en mémoire, renouvelé si besoin. */
  session: AccessTokenSource;
  userId: string | null;
  /** Faux : aucune requête (ex. pas connecté avec le bon rôle). */
  enabled: boolean;
  /** Appelé quand la session a expiré (retour à la connexion avec un message). */
  onSessionExpired?: () => void;
};

type LoadState<T> =
  | { status: "idle" | "loading"; userId: string | null }
  | { status: "error"; userId: string | null; error: string }
  | { status: "success"; userId: string | null; items: T[] };

const BUSY: ApplicationActionError = {
  kind: "other",
  message: "Une opération est déjà en cours. Patientez un instant.",
};

/** Chargement d'une liste protégée + modifications une par une (logique commune). */
function useProtectedList<T extends { id: string }>(
  load: (session: AccessTokenSource, signal: AbortSignal) => Promise<T[]>,
  { session, userId, enabled, onSessionExpired }: ListOptions,
) {
  const [state, setState] = useState<LoadState<T>>({ status: "idle", userId });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const expiredRef = useRef(onSessionExpired);
  expiredRef.current = onSessionExpired;

  useEffect(() => {
    if (!enabled || !userId) {
      setState({ status: "idle", userId });
      return;
    }
    setState((current) =>
      current.status === "success" && current.userId === userId
        ? current
        : { status: "loading", userId },
    );
    const controller = new AbortController();
    load(sessionRef.current, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setState({ status: "success", userId, items });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const failure = applicationErrorFromApi(error);
        if (failure.kind === "session") expiredRef.current?.();
        setState({ status: "error", userId, error: failure.message });
      });
    return () => controller.abort();
    // `load` est une fonction stable du module : seuls ces critères relancent.
  }, [enabled, userId, attempt]);

  /** Exécute une modification ; `key` identifie ce qui est en cours (bouton désactivé). */
  const run = async (
    key: string,
    action: (session: AccessTokenSource) => Promise<T>,
  ): Promise<ApplicationActionError | null> => {
    if (busy.current) return BUSY;
    busy.current = true;
    setPending(key);
    try {
      const updated = await action(sessionRef.current);
      setState((current) =>
        current.status === "success"
          ? {
              ...current,
              items: current.items.some((item) => item.id === updated.id)
                ? current.items.map((item) => (item.id === updated.id ? updated : item))
                : [updated, ...current.items],
            }
          : current,
      );
      setAttempt((n) => n + 1);
      return null;
    } catch (error) {
      const failure = applicationErrorFromApi(error);
      if (failure.kind === "session") expiredRef.current?.();
      if (failure.kind === "stale") setAttempt((n) => n + 1);
      return failure;
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const mine = state.userId === userId ? state : null;
  return {
    status: mine?.status ?? "loading",
    error: mine?.status === "error" ? mine.error : "",
    items: mine?.status === "success" ? mine.items : null,
    pending,
    reload: () => setAttempt((n) => n + 1),
    run,
    /** Session actuelle (pour une requête qui ne modifie pas la liste, ex. un téléchargement). */
    session: () => sessionRef.current,
    sessionExpired: () => expiredRef.current?.(),
  };
}

export type CandidateApplicationsState = {
  status: "idle" | "loading" | "error" | "success";
  error: string;
  applications: CandidateApplicationView[];
  /** A déjà postulé à cette offre (d'après la liste du serveur). */
  hasApplied: (offerId: string) => boolean;
  /** Offre en cours d'envoi, ou null. */
  pending: string | null;
  reload: () => void;
  /** null si la candidature est envoyée, sinon l'erreur à afficher. */
  apply: (offerId: string, message: string) => Promise<ApplicationActionError | null>;
};

export function useCandidateApplications(options: ListOptions): CandidateApplicationsState {
  const list = useProtectedList<CandidateApplicationApi>(fetchMyApplications, options);
  const applications = useMemo(
    () => list.items?.map(toCandidateApplicationView) ?? [],
    [list.items],
  );
  return {
    status: list.status,
    error: list.error,
    applications,
    hasApplied: (offerId) => applications.some((item) => item.offerId === offerId),
    pending: list.pending,
    reload: list.reload,
    apply: (offerId, message) =>
      list.run(offerId, (session) => applyToOffer(session, offerId, message)),
  };
}

export type ReceivedApplicationsState = {
  status: "idle" | "loading" | "error" | "success";
  error: string;
  applications: RecruitApplicationView[];
  /** Candidature en cours de mise à jour, ou null. */
  pending: string | null;
  reload: () => void;
  /** null si le statut a changé, sinon l'erreur à afficher. */
  changeStatus: (
    applicationId: string,
    status: ApplicationStatusTarget,
  ) => Promise<ApplicationActionError | null>;
  /** Télécharge le CV joint ; null si le téléchargement a démarré, sinon l'erreur. */
  downloadCv: (applicationId: string, fileName: string) => Promise<ApplicationActionError | null>;
};

export function useReceivedApplications(options: ListOptions): ReceivedApplicationsState {
  const list = useProtectedList<ReceivedApplicationApi>(fetchReceivedApplications, options);
  const applications = useMemo(() => list.items?.map(toRecruitApplicationView) ?? [], [list.items]);
  return {
    status: list.status,
    error: list.error,
    applications,
    pending: list.pending,
    reload: list.reload,
    changeStatus: (applicationId, status) =>
      list.run(applicationId, (session) => changeApplicationStatus(session, applicationId, status)),
    downloadCv: async (applicationId, fileName) => {
      try {
        saveFile(await downloadApplicationCv(list.session(), applicationId), fileName);
        return null;
      } catch (error) {
        const failure = applicationErrorFromApi(error);
        if (failure.kind === "session") list.sessionExpired();
        return failure;
      }
    },
  };
}
