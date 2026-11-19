/**
 * Profil et CV du candidat connecté, lus et modifiés via l'API (étape B6).
 *
 * - Données rattachées à l'utilisateur connecté : si le compte change, l'ancien
 *   profil est effacé avant tout nouvel affichage.
 * - Une seule opération à la fois (`pending`), contre les doubles clics.
 * - Après une réussite, le profil affiché est celui renvoyé par le serveur.
 * - Une erreur n'est jamais remplacée par des données fictives.
 */
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  SESSION_EXPIRED_MESSAGE,
  type AccessTokenSource,
} from "../../services/apiClient";
import {
  deleteMyCv,
  downloadMyCv,
  fetchMyProfile,
  updateMyProfile,
  uploadMyCv,
  type CandidateProfileApi,
} from "../../services/candidateProfileService";
import { saveFile } from "../../lib/saveFile";
import {
  cvFileProblem,
  validateProfileForm,
  type CandidateProfileForm,
  type ProfileField,
} from "./candidateProfileForm";

type LoadState =
  | { status: "idle" | "loading"; userId: string | null }
  | { status: "error"; userId: string | null; error: string }
  | { status: "success"; userId: string | null; profile: CandidateProfileApi };

export type ProfileSaveError = {
  message: string;
  fieldErrors: Partial<Record<ProfileField, string>>;
};

export type CandidateProfileState = {
  status: LoadState["status"];
  error: string;
  profile: CandidateProfileApi | null;
  /** Opération en cours : enregistrement du profil, CV, ou rien. */
  pending: "save" | "cv" | null;
  reload: () => void;
  /** null si le profil est enregistré, sinon les erreurs à afficher. */
  save: (form: CandidateProfileForm) => Promise<ProfileSaveError | null>;
  /** null si le CV est déposé, sinon le message d'erreur. */
  uploadCv: (file: File) => Promise<string | null>;
  deleteCv: () => Promise<string | null>;
  downloadCv: () => Promise<string | null>;
};

const API_FIELDS: Record<string, ProfileField> = {
  fullName: "fullName",
  cityId: "cityId",
  education: "education",
  bio: "bio",
  skills: "skills",
};

function messageOf(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) return SESSION_EXPIRED_MESSAGE;
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

export function useCandidateProfile({
  session,
  userId,
  enabled,
  onSessionExpired,
  onNameChanged,
}: {
  session: AccessTokenSource;
  userId: string | null;
  /** Faux : aucune requête (pas de candidat connecté). */
  enabled: boolean;
  onSessionExpired?: () => void;
  /** Le nom complet a changé : la session doit être relue (nom affiché partout). */
  onNameChanged?: () => void;
}): CandidateProfileState {
  const [state, setState] = useState<LoadState>({ status: "idle", userId });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<"save" | "cv" | null>(null);
  const busy = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const callbacks = useRef({ onSessionExpired, onNameChanged });
  callbacks.current = { onSessionExpired, onNameChanged };

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
    fetchMyProfile(sessionRef.current, controller.signal)
      .then((profile) => {
        if (!controller.signal.aborted) setState({ status: "success", userId, profile });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          callbacks.current.onSessionExpired?.();
        }
        setState({ status: "error", userId, error: messageOf(error) });
      });
    return () => controller.abort();
  }, [enabled, userId, attempt]);

  /** Exécute une opération ; met à jour le profil affiché si elle en renvoie un. */
  async function run<T>(
    kind: "save" | "cv",
    action: (session: AccessTokenSource) => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
    if (busy.current) {
      return {
        ok: false,
        error: new Error("Une opération est déjà en cours. Patientez un instant."),
      };
    }
    busy.current = true;
    setPending(kind);
    try {
      const value = await action(sessionRef.current);
      return { ok: true, value };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        callbacks.current.onSessionExpired?.();
      }
      return { ok: false, error };
    } finally {
      busy.current = false;
      setPending(null);
    }
  }
  const show = (profile: CandidateProfileApi) =>
    setState((current) => ({ status: "success", userId: current.userId, profile }));

  const mine = state.userId === userId ? state : null;
  const profile = mine?.status === "success" ? mine.profile : null;

  return {
    status: mine?.status ?? "loading",
    error: mine?.status === "error" ? mine.error : "",
    profile,
    pending,
    reload: () => setAttempt((n) => n + 1),
    save: async (form) => {
      const checked = validateProfileForm(form);
      if (!checked.ok) {
        return { message: Object.values(checked.errors)[0] ?? "", fieldErrors: checked.errors };
      }
      const previousName = profile?.fullName;
      const result = await run("save", (s) => updateMyProfile(s, checked.payload));
      if (!result.ok) {
        const fieldErrors: Partial<Record<ProfileField, string>> = {};
        if (result.error instanceof ApiError) {
          for (const detail of result.error.details) {
            const field = API_FIELDS[detail.field];
            if (field) fieldErrors[field] = detail.message;
          }
        }
        return { message: messageOf(result.error), fieldErrors };
      }
      show(result.value);
      if (result.value.fullName !== previousName) callbacks.current.onNameChanged?.();
      return null;
    },
    uploadCv: async (file) => {
      const problem = cvFileProblem(file);
      if (problem) return problem;
      const result = await run("cv", (s) => uploadMyCv(s, file));
      if (!result.ok) return messageOf(result.error);
      show(result.value);
      return null;
    },
    deleteCv: async () => {
      const result = await run("cv", (s) => deleteMyCv(s));
      if (!result.ok) return messageOf(result.error);
      show(result.value);
      return null;
    },
    downloadCv: async () => {
      const fileName = profile?.cv?.fileName ?? "CV.pdf";
      const result = await run("cv", (s) => downloadMyCv(s));
      if (!result.ok) return messageOf(result.error);
      saveFile(result.value, fileName);
      return null;
    },
  };
}
