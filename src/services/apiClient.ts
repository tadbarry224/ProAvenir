/**
 * Client HTTP minimal vers l'API NestJS de ProAvenir.
 *
 * L'adresse de l'API vient de la variable d'environnement VITE_API_URL
 * (fichier `.env` à la racine, voir `.env.example`), par exemple :
 *   VITE_API_URL=http://localhost:3001/api
 *
 * Toute erreur (réseau, délai dépassé, réponse 4xx/5xx) devient une `ApiError`
 * avec un message en français prêt à être affiché. Aucune donnée fictive
 * n'est jamais renvoyée à la place d'une erreur.
 */

/** Délai maximal d'attente d'une réponse, en millisecondes. */
const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  /** Code HTTP (404, 500…), ou `null` si le serveur n'a pas répondu. */
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Paramètres de requête ; les valeurs vides ou absentes ne sont pas envoyées. */
export type QueryParams = Record<string, string | undefined>;

function apiBaseUrl(): string {
  const url = import.meta.env.VITE_API_URL;
  if (!url) {
    throw new ApiError(
      "L’adresse du serveur n’est pas configurée (variable VITE_API_URL manquante).",
    );
  }
  return url.replace(/\/+$/, "");
}

/** Construit l'URL complète : apiUrl("/offers", { city: "boke" }) → …/api/offers?city=boke */
export function apiUrl(path: string, params: QueryParams = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const search = query.toString();
  return `${apiBaseUrl()}${path}${search ? `?${search}` : ""}`;
}

/**
 * Requête GET qui renvoie le JSON de la réponse.
 * `signal` permet d'annuler la requête (ex. l'utilisateur change de filtre).
 */
export async function apiGet<T>(
  path: string,
  params?: QueryParams,
  signal?: AbortSignal,
): Promise<T> {
  const url = apiUrl(path, params);

  // Annulation : par l'appelant OU après TIMEOUT_MS.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    // Annulation voulue par l'appelant : on la laisse remonter telle quelle.
    if (signal?.aborted) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "Le serveur met trop de temps à répondre. Réessayez dans un instant."
        : "Impossible de joindre le serveur ProAvenir. Vérifiez votre connexion puis réessayez.",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }

  if (!response.ok) {
    throw new ApiError(
      response.status >= 500
        ? "Le serveur rencontre un problème. Réessayez dans un instant."
        : `La demande n’a pas pu être traitée (erreur ${response.status}).`,
      response.status,
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("La réponse du serveur est illisible.", response.status);
  }
}
