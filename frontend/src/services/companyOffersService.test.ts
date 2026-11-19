/**
 * Tests de companyOffersService (fetch est remplacé : aucun serveur n'est contacté).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { ApiError, type AccessTokenSource } from "./apiClient";
import {
  changeCompanyOfferStatus,
  createCompanyOffer,
  fetchCompanyOffers,
  OFFER_ERROR_CODES,
  type CompanyOfferApi,
} from "./companyOffersService";

afterEach(() => vi.unstubAllGlobals());

const session: AccessTokenSource = {
  getAccessToken: () => "jeton-test",
  renewAccessToken: async () => null,
};

const apiOffer: CompanyOfferApi = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Assistant·e marketing digital",
  type: "INTERNSHIP",
  contractType: "INTERNSHIP",
  workSchedule: null,
  duration: "6 mois",
  status: "PUBLISHED",
  city: { id: "conakry", name: "Conakry" },
  domain: { id: "marketing", name: "Marketing" },
  description: "Description de test.",
  deadline: "2026-12-28",
  skills: ["Réseaux sociaux"],
  featured: false,
  publishedAt: "2026-11-01T12:00:00.000Z",
  closedAt: null,
  createdAt: "2026-10-30T08:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  applicationsCount: 2,
  publiclyVisible: true,
};

/** Remplace fetch par une réponse unique et renvoie l'appel effectué. */
function reply(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return () => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return {
      url,
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
    };
  };
}

describe("fetchCompanyOffers", () => {
  it("GET /companies/me/offers avec le jeton, et renvoie offres + date + entreprise", async () => {
    const call = reply(200, {
      data: [apiOffer],
      meta: { total: 1, today: "2026-11-20", company: { name: "Kamsar", status: "APPROVED" } },
    });
    const result = await fetchCompanyOffers(session);
    assert.deepEqual(result, {
      offers: [apiOffer],
      today: "2026-11-20",
      company: { name: "Kamsar", status: "APPROVED" },
    });
    const { url, method, headers, body } = call();
    assert.equal(url, "http://api.test/api/companies/me/offers");
    assert.equal(method, "GET");
    assert.equal(headers.Authorization, "Bearer jeton-test");
    assert.equal(body, undefined);
  });
});

describe("createCompanyOffer", () => {
  it("POST le corps tel quel (sans identifiant d'entreprise)", async () => {
    const call = reply(201, apiOffer);
    const payload = {
      status: "DRAFT" as const,
      title: "Assistant marketing",
      type: "JOB" as const,
      cityId: "conakry",
      domainId: "marketing",
      deadline: null,
      skills: [],
    };
    assert.deepEqual(await createCompanyOffer(session, payload), apiOffer);
    const sent = call();
    assert.equal(sent.url, "http://api.test/api/companies/me/offers");
    assert.equal(sent.method, "POST");
    assert.equal(sent.headers.Authorization, "Bearer jeton-test");
    assert.equal(sent.headers["Content-Type"], "application/json");
    assert.deepEqual(sent.body, payload);
    assert.ok(!("companyId" in sent.body));
  });

  it("transmet le code et les détails d'une erreur de validation (400)", async () => {
    reply(400, {
      statusCode: 400,
      code: OFFER_ERROR_CODES.validationFailed,
      message: ["Choisissez une ville dans la liste."],
      details: [{ field: "cityId", message: "Choisissez une ville dans la liste." }],
    });
    const error = await createCompanyOffer(session, {
      status: "DRAFT",
      title: "Offre",
      type: "JOB",
      cityId: "atlantis",
      domainId: "marketing",
    }).catch((e: unknown) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "VALIDATION_FAILED");
    assert.deepEqual(error.details, [
      { field: "cityId", message: "Choisissez une ville dans la liste." },
    ]);
  });
});

describe("changeCompanyOfferStatus", () => {
  it("PATCH /companies/me/offers/:id/status avec { status }", async () => {
    const call = reply(200, { ...apiOffer, status: "CLOSED" });
    const result = await changeCompanyOfferStatus(session, apiOffer.id, "CLOSED");
    assert.equal(result.status, "CLOSED");
    const sent = call();
    assert.equal(sent.url, `http://api.test/api/companies/me/offers/${apiOffer.id}/status`);
    assert.equal(sent.method, "PATCH");
    assert.deepEqual(sent.body, { status: "CLOSED" });
  });

  it("encode l'identifiant dans l'adresse (aucune injection de chemin)", async () => {
    const call = reply(400, { code: OFFER_ERROR_CODES.invalidOfferId, message: "Invalide." });
    await changeCompanyOfferStatus(session, "../autre?x=1", "CLOSED").catch(() => undefined);
    assert.equal(call().url, "http://api.test/api/companies/me/offers/..%2Fautre%3Fx%3D1/status");
  });

  it.each([
    [403, OFFER_ERROR_CODES.companyNotApproved],
    [404, OFFER_ERROR_CODES.offerNotFound],
    [409, OFFER_ERROR_CODES.invalidTransition],
    [409, OFFER_ERROR_CODES.notPublishable],
  ])("transmet l'erreur %i %s", async (status, code) => {
    reply(status, { statusCode: status, code, message: "Refusé." });
    await assert.rejects(changeCompanyOfferStatus(session, apiOffer.id, "PUBLISHED"), {
      name: "ApiError",
      status,
      code,
      message: "Refusé.",
    });
  });
});
