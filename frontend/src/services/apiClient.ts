/**
 * Client HTTP minimal vers l'API NestJS de ProAvenir.
 *
 * L'adresse de l'API vient de la variable d'environnement VITE_API_URL
 * (fichier `frontend/.env`, voir `frontend/.env.example`), par exemple :
 *   VITE_API_URL=http://localhost:3001/api
 *
 * Toute erreur (réseau, délai dépassé, réponse 4xx/5xx) devient une `ApiError`
 * avec un message en français prêt à être affiché. Aucune donnée fictive
 * n'est jamais renvoyée à la place d'une erreur.
 */

/** Délai maximal d'attente d'une réponse, en millisecondes. */
const TIMEOUT_MS = 10_000;

/** Erreur rattachée à un champ précis (ex. { field: "deadline", message: "…" }). */
export type ApiErrorDetail = { field: string; message: string };

export class ApiError extends Error {
  /** Code HTTP (404, 500…), ou `null` si le serveur n'a pas répondu. */
  readonly status: number | null;
  /**
   * Code d'erreur métier STABLE renvoyé par l'API (ex. "SESSION_ROTATED",
   * "OFFER_NOT_PUBLISHABLE"), s'il existe : à tester plutôt que le texte du message.
   */
  readonly code: string | undefined;
  /** Erreurs par champ renvoyées par l'API (liste vide s'il n'y en a pas). */
  readonly details: ApiErrorDetail[];

  constructor(
    message: string,
    status: number | null = null,
    code?: string,
    details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Ne garde que les détails bien formés (le serveur pourrait évoluer). */
function errorDetails(body: unknown): ApiErrorDetail[] {
  const details = (body as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return [];
  return details.filter(
    (item): item is ApiErrorDetail =>
      typeof item?.field === "string" && typeof item?.message === "string",
  );
}

/** Paramètres de requête ; les valeurs vides ou absentes ne sont pas envoyées. */
export type QueryParams = Record<string, string | undefined>;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  params?: QueryParams;
  /** Corps JSON de la requête. */
  body?: unknown;
  /** Annulation (ex. l'utilisateur change de filtre). */
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** "include" : envoie et reçoit les cookies (session), même vers l'adresse de l'API. */
  credentials?: RequestCredentials;
};

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

/** Message d'erreur envoyé par l'API ({ message: "…" } ou { message: ["…", …] }). */
function serverMessage(body: unknown): string | undefined {
  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message.join(" ");
  return undefined;
}

/**
 * Envoie une requête et renvoie le JSON de la réponse (`undefined` pour une
 * réponse sans contenu, 204).
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", params, body, signal, headers, credentials } = options;
  const url = apiUrl(path, params);

  // Annulation : par l'appelant OU après TIMEOUT_MS.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials,
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

  if (response.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    if (response.ok) throw new ApiError("La réponse du serveur est illisible.", response.status);
  }

  if (!response.ok) {
    const code = (data as { code?: unknown } | undefined)?.code;
    throw new ApiError(
      response.status >= 500
        ? "Le serveur rencontre un problème. Réessayez dans un instant."
        : // Les messages 4xx de l'API sont rédigés en français pour l'utilisateur.
          (serverMessage(data) ??
            `La demande n’a pas pu être traitée (erreur ${response.status}).`),
      response.status,
      typeof code === "string" ? code : undefined,
      errorDetails(data),
    );
  }
  return data as T;
}

/** Requête GET (raccourci de `apiRequest`). */
export function apiGet<T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { params, signal });
}

// --- Requêtes authentifiées ---------------------------------------------------

/**
 * Accès au jeton de la session, fourni par `useAuth()` (AuthProvider) :
 * le jeton reste EN MÉMOIRE (jamais dans localStorage).
 */
export type AccessTokenSource = {
  /** Jeton d'accès courant, ou null s'il n'y en a pas. */
  getAccessToken: () => string | null;
  /**
   * Renouvelle la session grâce au cookie httpOnly et renvoie le nouveau jeton,
   * ou null si la session n'est plus valide (l'utilisateur doit se reconnecter).
   */
  renewAccessToken: () => Promise<string | null>;
};

export const SESSION_EXPIRED_MESSAGE = "Votre session a expiré. Reconnectez-vous pour continuer.";

const sessionExpired = () => new ApiError(SESSION_EXPIRED_MESSAGE, 401);

/**
 * Requête vers une route protégée, avec l'en-tête `Authorization: Bearer …`.
 *
 * Si le jeton manque ou est refusé (401, ex. expiré pendant une longue saisie),
 * la session est renouvelée UNE fois puis la requête est rejouée. Si le
 * renouvellement échoue : ApiError 401 « session expirée ». Les autres erreurs
 * (400, 403, 404, 409, réseau…) remontent telles quelles.
 */
export async function authorizedRequest<T>(
  session: AccessTokenSource,
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const send = (token: string) =>
    apiRequest<T>(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });

  const current = session.getAccessToken() ?? (await session.renewAccessToken());
  if (!current) throw sessionExpired();
  try {
    return await send(current);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const renewed = await session.renewAccessToken();
    if (!renewed) throw sessionExpired();
    try {
      return await send(renewed);
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) throw sessionExpired();
      throw retryError;
    }
  }
}
