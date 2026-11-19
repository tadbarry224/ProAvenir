/**
 * Tests du client HTTP (fetch est remplacé : aucun serveur n'est contacté).
 * Lancement : npm test (Vitest)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  apiRequest,
  apiUrl,
  authorizedRequest,
  SESSION_EXPIRED_MESSAGE,
  type AccessTokenSource,
} from "./apiClient";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const respond = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );

describe("apiUrl", () => {
  it("ajoute VITE_API_URL et n'envoie que les paramètres renseignés", () => {
    assert.equal(
      apiUrl("/offers", { city: "boke", domain: "", q: "excel comptable", type: undefined }),
      "http://api.test/api/offers?city=boke&q=excel+comptable",
    );
    assert.equal(apiUrl("/cities"), "http://api.test/api/cities");
  });

  it("signale clairement une adresse d'API manquante", () => {
    vi.stubEnv("VITE_API_URL", "");
    assert.throws(() => apiUrl("/offers"), /VITE_API_URL manquante/);
  });
});

describe("apiGet", () => {
  it("renvoie le JSON de la réponse", async () => {
    respond({ data: [{ id: "boke", name: "Boké" }] });
    assert.deepEqual(await apiGet("/cities"), { data: [{ id: "boke", name: "Boké" }] });
  });

  it("transforme une erreur réseau en message lisible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const error = await apiGet("/offers").catch((e: unknown) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, null);
    assert.match(error.message, /Impossible de joindre le serveur/);
  });

  it("distingue erreur serveur (5xx) et demande refusée (4xx)", async () => {
    respond({}, 503);
    await assert.rejects(apiGet("/offers"), { name: "ApiError", status: 503, message: /problème/ });
    // 4xx : le message (en français) envoyé par l'API est repris tel quel…
    respond({ message: ["type doit valoir JOB ou INTERNSHIP"] }, 400);
    await assert.rejects(apiGet("/offers"), {
      status: 400,
      message: "type doit valoir JOB ou INTERNSHIP",
    });
    // …sinon, message générique avec le code.
    respond({}, 404);
    await assert.rejects(apiGet("/offers"), { status: 404, message: /erreur 404/ });
  });

  it("envoie un corps JSON, les en-têtes et transmet le code d'erreur métier", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Session renouvelée", code: "SESSION_ROTATED" }), {
          status: 401,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const error = await apiRequest("/auth/refresh", {
      method: "POST",
      body: { a: 1 },
      credentials: "include",
      headers: { "X-ProAvenir-CSRF": "1" },
    }).catch((e: unknown) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "SESSION_ROTATED");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    assert.equal(url, "http://api.test/api/auth/refresh");
    assert.equal(init.method, "POST");
    assert.equal(init.body, '{"a":1}');
    assert.equal(init.credentials, "include");
    assert.equal((init.headers as Record<string, string>)["X-ProAvenir-CSRF"], "1");
    assert.equal((init.headers as Record<string, string>)["Content-Type"], "application/json");
  });

  it("renvoie undefined pour une réponse sans contenu (204)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    assert.equal(await apiRequest("/auth/logout", { method: "POST" }), undefined);
  });

  it("abandonne après le délai maximal", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("", "AbortError")),
            ),
          ),
      ),
    );
    const pending = apiGet("/offers").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await pending;
    vi.useRealTimers();
    assert.ok(error instanceof ApiError);
    assert.match(error.message, /trop de temps/);
  });
});

describe("détails d'erreur", () => {
  it("lit les détails bien formés et ignore les autres", async () => {
    respond(
      {
        code: "VALIDATION_FAILED",
        message: ["Date invalide."],
        details: [
          { field: "deadline", message: "Date invalide." },
          { field: 42, message: "ignoré" },
          "ignoré",
        ],
      },
      400,
    );
    const error = await apiGet("/x").catch((e: unknown) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, "VALIDATION_FAILED");
    assert.deepEqual(error.details, [{ field: "deadline", message: "Date invalide." }]);
  });

  it("liste vide quand l'API n'envoie pas de détails", async () => {
    respond({ message: "Refusé." }, 403);
    const error = await apiGet("/x").catch((e: unknown) => e);
    assert.ok(error instanceof ApiError);
    assert.deepEqual(error.details, []);
  });
});

describe("authorizedRequest (routes protégées)", () => {
  /** Session simulée : jetons successifs renvoyés par le renouvellement. */
  function fakeSession(initial: string | null, renewed: (string | null)[] = []) {
    let token = initial;
    const renewAccessToken = vi.fn(async () => {
      token = renewed.shift() ?? null;
      return token;
    });
    const session: AccessTokenSource = { getAccessToken: () => token, renewAccessToken };
    return { session, renewAccessToken };
  }

  /** fetch simulé : une réponse (statut, corps) par appel, dans l'ordre. */
  function serverReplies(...replies: [number, unknown][]) {
    const fetchMock = vi.fn(async () => {
      const [status, body] = replies.shift() ?? [500, {}];
      return new Response(JSON.stringify(body), { status });
    });
    vi.stubGlobal("fetch", fetchMock);
    const authorizations = () =>
      fetchMock.mock.calls.map(
        (call) =>
          ((call as unknown as [string, RequestInit])[1].headers as Record<string, string>)
            .Authorization,
      );
    return { fetchMock, authorizations };
  }

  it("envoie le jeton en mémoire dans l'en-tête Authorization (PATCH accepté)", async () => {
    const { session, renewAccessToken } = fakeSession("jeton-1");
    const { fetchMock, authorizations } = serverReplies([200, { ok: true }]);
    const result = await authorizedRequest(session, "/x", { method: "PATCH", body: { a: 1 } });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(authorizations(), ["Bearer jeton-1"]);
    assert.equal((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].method, "PATCH");
    assert.equal(renewAccessToken.mock.calls.length, 0);
  });

  it("jeton refusé (401) : renouvelle la session une fois puis rejoue la requête", async () => {
    const { session, renewAccessToken } = fakeSession("ancien", ["nouveau"]);
    const { authorizations } = serverReplies([401, { message: "Connexion requise." }], [200, {}]);
    await authorizedRequest(session, "/x");
    assert.deepEqual(authorizations(), ["Bearer ancien", "Bearer nouveau"]);
    assert.equal(renewAccessToken.mock.calls.length, 1);
  });

  it("sans jeton en mémoire : renouvelle d'abord (ex. après rechargement)", async () => {
    const { session } = fakeSession(null, ["restauré"]);
    const { authorizations } = serverReplies([200, {}]);
    await authorizedRequest(session, "/x");
    assert.deepEqual(authorizations(), ["Bearer restauré"]);
  });

  it("session impossible à renouveler : 401 « session expirée » sans appeler l'API", async () => {
    const { session } = fakeSession(null, [null]);
    const { fetchMock } = serverReplies();
    await assert.rejects(authorizedRequest(session, "/x"), {
      name: "ApiError",
      status: 401,
      message: SESSION_EXPIRED_MESSAGE,
    });
    assert.equal(fetchMock.mock.calls.length, 0);
  });

  it("toujours 401 après renouvellement : session expirée, pas de boucle", async () => {
    const { session, renewAccessToken } = fakeSession("a", ["b", "c"]);
    const { fetchMock } = serverReplies([401, {}], [401, {}], [200, {}]);
    await assert.rejects(authorizedRequest(session, "/x"), {
      status: 401,
      message: SESSION_EXPIRED_MESSAGE,
    });
    assert.equal(fetchMock.mock.calls.length, 2);
    assert.equal(renewAccessToken.mock.calls.length, 1);
  });

  it("les autres erreurs (403, 409…) remontent telles quelles, sans renouvellement", async () => {
    const { session, renewAccessToken } = fakeSession("a");
    serverReplies([409, { code: "INVALID_STATUS_TRANSITION", message: "Déjà clôturée." }]);
    await assert.rejects(authorizedRequest(session, "/x"), {
      status: 409,
      code: "INVALID_STATUS_TRANSITION",
      message: "Déjà clôturée.",
    });
    assert.equal(renewAccessToken.mock.calls.length, 0);
  });
});
