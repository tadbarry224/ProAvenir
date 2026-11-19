/**
 * Conversions espace entreprise ↔ API et traduction des erreurs (fonctions pures).
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { ApiError, SESSION_EXPIRED_MESSAGE } from "../../services/apiClient";
import type { CompanyOfferApi } from "../../services/companyOffersService";
import type { OfferInput } from "../../types/offer";
import {
  companyOfferFromApi,
  offerErrorFromApi,
  toCreateOfferPayload,
  UnexpectedApiDataError,
  type ReferenceLists,
} from "./companyOfferMapping";
import { toJobView } from "./toJobView";

const apiOffer: CompanyOfferApi = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Assistant·e ressources humaines",
  type: "JOB",
  contractType: "CDD",
  workSchedule: "FULL_TIME",
  duration: "12 mois",
  status: "DRAFT",
  city: { id: "kindia", name: "Kindia" },
  domain: { id: "ressources-humaines", name: "Ressources humaines" },
  description: "Description de test.",
  deadline: null,
  skills: ["Excel"],
  featured: false,
  publishedAt: null,
  closedAt: null,
  createdAt: "2026-10-30T08:00:00.000Z",
  updatedAt: "2026-10-30T08:00:00.000Z",
  applicationsCount: 0,
  publiclyVisible: false,
};

describe("companyOfferFromApi", () => {
  it("garde l'identifiant texte et les LIBELLÉS affichés, « pas de date » → texte vide", () => {
    const offer = companyOfferFromApi(apiOffer);
    assert.equal(offer.id, apiOffer.id);
    assert.equal(offer.city, "Kindia");
    assert.equal(offer.domain, "Ressources humaines");
    assert.equal(offer.deadline, "");
    assert.equal(offer.status, "DRAFT");
    assert.equal(offer.applicationsCount, 0);
    assert.equal(offer.publiclyVisible, false);
    assert.equal(offer.companyId, undefined);
  });

  it("produit le même affichage que les données locales (toJobView inchangé)", () => {
    const published = companyOfferFromApi({
      ...apiOffer,
      status: "PUBLISHED",
      deadline: "2027-01-18",
      publishedAt: "2026-11-01T12:00:00.000Z",
    });
    const job = toJobView(published, { name: "Kamsar Solutions", logoColor: "blue" });
    assert.equal(job.id, apiOffer.id);
    assert.equal(job.city, "Kindia");
    assert.equal(job.contract, "CDD · 12 mois · Temps plein");
    assert.equal(job.deadline, "18 janv. 2027");
  });

  it.each([
    ["ville", { city: { id: "mamou", name: "Mamou" } }, /la ville « Mamou »/],
    ["domaine", { domain: { id: "sante", name: "Santé" } }, /le domaine « Santé »/],
    ["statut", { status: "ARCHIVED" }, /le statut « ARCHIVED »/],
    ["type", { type: "FREELANCE" }, /le type d’offre « FREELANCE »/],
    ["contrat", { contractType: "INTERIM" }, /le type de contrat « INTERIM »/],
  ])(
    "valeur inconnue (%s) : erreur explicite, jamais une valeur inventée",
    (_label, override, expected) => {
      assert.throws(
        () => companyOfferFromApi({ ...apiOffer, ...override } as CompanyOfferApi),
        (error: unknown) => error instanceof UnexpectedApiDataError && expected.test(error.message),
      );
    },
  );
});

describe("toCreateOfferPayload", () => {
  const references: ReferenceLists = {
    cities: [
      { id: "conakry", name: "Conakry" },
      { id: "labe", name: "Labé" },
    ],
    domains: [{ id: "ressources-humaines", name: "Ressources humaines" }],
  };
  const input: OfferInput = {
    title: "Assistant RH",
    type: "JOB",
    city: "Labé",
    domain: "Ressources humaines",
    description: "Description.",
    deadline: "",
    skills: ["Excel"],
  };

  it("remplace les libellés par les identifiants de l'API, date vide → null", () => {
    assert.deepEqual(toCreateOfferPayload(input, "DRAFT", references), {
      ok: true,
      payload: {
        status: "DRAFT",
        title: "Assistant RH",
        type: "JOB",
        cityId: "labe",
        domainId: "ressources-humaines",
        description: "Description.",
        deadline: null,
        skills: ["Excel"],
      },
    });
  });

  it("libellé absent des référentiels : erreur sur le champ, aucun identifiant inventé", () => {
    const result = toCreateOfferPayload({ ...input, city: "Boké" }, "PUBLISHED", references);
    assert.deepEqual(result, {
      ok: false,
      errors: { city: "Choisissez une ville dans la liste." },
    });
  });

  it("référentiels pas encore chargés : message d'attente sur les deux champs", () => {
    const result = toCreateOfferPayload(input, "DRAFT", { cities: [], domains: [] });
    assert.equal(result.ok, false);
    assert.ok(!result.ok);
    assert.match(result.errors.city ?? "", /pas encore chargée/);
    assert.match(result.errors.domain ?? "", /pas encore chargée/);
  });
});

describe("offerErrorFromApi", () => {
  const apiError = (
    status: number | null,
    code?: string,
    details: { field: string; message: string }[] = [],
  ) => new ApiError("Message de l’API.", status, code, details);

  it("400 : erreurs rattachées aux champs du formulaire (cityId → city…)", () => {
    const result = offerErrorFromApi(
      apiError(400, "VALIDATION_FAILED", [
        { field: "cityId", message: "Choisissez une ville dans la liste." },
        { field: "deadline", message: "La date limite n’est pas valide." },
        { field: "deadline", message: "Deuxième message ignoré." },
        { field: "duration", message: "Pas de champ affiché." },
      ]),
    );
    assert.equal(result.kind, "validation");
    assert.equal(result.code, "VALIDATION_FAILED");
    assert.deepEqual(result.fieldErrors, {
      city: "Choisissez une ville dans la liste.",
      deadline: "La date limite n’est pas valide.",
    });
  });

  it("409 : distingue une transition interdite d'une offre non publiable", () => {
    const transition = offerErrorFromApi(apiError(409, "INVALID_STATUS_TRANSITION"));
    assert.equal(transition.kind, "transition");
    assert.deepEqual(transition.fieldErrors, {});

    const incomplete = offerErrorFromApi(
      apiError(409, "OFFER_NOT_PUBLISHABLE", [
        { field: "description", message: "Description trop courte." },
      ]),
    );
    assert.equal(incomplete.kind, "notPublishable");
    assert.deepEqual(incomplete.fieldErrors, { description: "Description trop courte." });
  });

  it.each([
    [401, undefined, "session"],
    [403, "COMPANY_NOT_APPROVED", "forbidden"],
    [404, "OFFER_NOT_FOUND", "notFound"],
    [null, undefined, "network"],
    [500, undefined, "server"],
  ] as const)("%s %s → %s", (status, code, kind) => {
    const result = offerErrorFromApi(apiError(status, code));
    assert.equal(result.kind, kind);
    assert.equal(result.code, code);
  });

  it("401 : message de reconnexion, quel que soit le texte reçu", () => {
    assert.equal(offerErrorFromApi(apiError(401)).message, SESSION_EXPIRED_MESSAGE);
  });

  it("donnée inattendue de l'API : erreur serveur lisible", () => {
    const result = offerErrorFromApi(new UnexpectedApiDataError("Ville inconnue."));
    assert.deepEqual(result, { kind: "server", message: "Ville inconnue.", fieldErrors: {} });
  });

  it("ne masque pas une erreur de programmation", () => {
    assert.throws(() => offerErrorFromApi(new TypeError("bug")), TypeError);
  });
});
