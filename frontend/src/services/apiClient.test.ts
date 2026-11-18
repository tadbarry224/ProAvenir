/**
 * Tests du client HTTP (fetch est remplacé : aucun serveur n'est contacté).
 * Lancement : npm test (Vitest)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { ApiError, apiGet, apiRequest, apiUrl } from "./apiClient";

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
