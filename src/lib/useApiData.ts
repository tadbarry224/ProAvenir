/**
 * Charge des données de l'API et suit l'état de la requête :
 *   "loading" → chargement en cours
 *   "error"   → échec, `error` contient le message à afficher
 *   "success" → `data` contient la réponse
 *
 * La requête est relancée quand une valeur de `deps` change ; la précédente
 * est alors annulée, pour qu'une réponse ancienne n'écrase jamais une plus récente.
 * `reload()` relance la même requête (bouton « Réessayer »).
 */
import { useEffect, useState, type DependencyList } from "react";

export type ApiData<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "error"; data: undefined; error: string }
  | { status: "success"; data: T; error: undefined };

const LOADING = { status: "loading", data: undefined, error: undefined } as const;

export function useApiData<T>(
  /** Fonction de chargement, ou `null` pour attendre (état "loading" sans requête). */
  load: ((signal: AbortSignal) => Promise<T>) | null,
  deps: DependencyList,
): ApiData<T> & { reload: () => void } {
  const [state, setState] = useState<ApiData<T>>(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState(LOADING);
    if (!load) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "success", data, error: undefined });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
        setState({ status: "error", data: undefined, error: message });
      },
    );
    return () => controller.abort();
    // `load` est recréée à chaque rendu : ce sont `deps` qui décident du rechargement.
  }, [...deps, attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}
