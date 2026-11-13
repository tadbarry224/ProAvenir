/**
 * Tests du client HTTP (fetch est remplacé : aucun serveur n'est contacté).
 * Lancement : npm test (Vitest)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { ApiError, apiGet, apiUrl } from "./apiClient";

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
    respond({ message: ["type invalide"] }, 400);
    await assert.rejects(apiGet("/offers"), { status: 400, message: /erreur 400/ });
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
