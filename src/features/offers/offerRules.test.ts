/**
 * Tests des règles de visibilité et de changement de statut des offres.
 * Lancement : npm test
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Offer } from "../../types/offer.ts";
import { mockOffers } from "../../data/mockOffers.ts";
import { mockCompanies } from "../../data/mockCompanies.ts";
import {
  buildOffer,
  changeStatus,
  getDisplayStatus,
  isExpired,
  isPubliclyVisible,
  nextStatus,
} from "./offerRules.ts";
import { toOfferFormValues, validateOffer } from "./validateOffer.ts";

const TODAY = "2026-11-12";
const NOW = new Date("2026-11-12T10:00:00.000Z");

const baseOffer: Offer = {
  id: 100,
  companyId: 1,
  status: "PUBLISHED",
  title: "Assistant·e administratif·ve",
  type: "JOB",
  city: "Conakry",
  domain: "Commerce",
  description:
    "Vous assurez l’accueil, la gestion du courrier et le suivi administratif des dossiers clients.",
  deadline: "2026-12-31",
  skills: ["Excel"],
  createdAt: "2026-11-01T12:00:00.000Z",
  publishedAt: "2026-11-01T12:00:00.000Z",
};

const offerWith = (changes: Partial<Offer>): Offer => ({ ...baseOffer, ...changes });

describe("isPubliclyVisible", () => {
  it("affiche une offre publiée dont la date limite n'est pas dépassée", () => {
    assert.equal(isPubliclyVisible(baseOffer, TODAY), true);
  });

  it("n'affiche jamais un brouillon", () => {
    assert.equal(
      isPubliclyVisible(offerWith({ status: "DRAFT", publishedAt: null }), TODAY),
      false,
    );
  });

  it("n'affiche pas une offre clôturée", () => {
    assert.equal(isPubliclyVisible(offerWith({ status: "CLOSED" }), TODAY), false);
  });

  it("n'affiche pas une offre expirée, mais l'affiche encore le jour de la date limite", () => {
    assert.equal(isPubliclyVisible(offerWith({ deadline: "2026-11-11" }), TODAY), false);
    assert.equal(isPubliclyVisible(offerWith({ deadline: TODAY }), TODAY), true);
  });

  it("n'affiche pas une offre publiée sans date limite (donnée incohérente)", () => {
    assert.equal(isPubliclyVisible(offerWith({ deadline: "" }), TODAY), false);
  });
});

describe("isExpired et getDisplayStatus", () => {
  it("signale « EXPIRED » pour une offre publiée dont la date est dépassée", () => {
    const expired = offerWith({ deadline: "2026-10-01" });
    assert.equal(isExpired(expired, TODAY), true);
    assert.equal(getDisplayStatus(expired, TODAY), "EXPIRED");
  });

  it("garde le statut réel dans les autres cas", () => {
    assert.equal(getDisplayStatus(baseOffer, TODAY), "PUBLISHED");
    assert.equal(
      getDisplayStatus(offerWith({ status: "CLOSED", deadline: "2026-10-01" }), TODAY),
      "CLOSED",
    );
    assert.equal(getDisplayStatus(offerWith({ status: "DRAFT", deadline: "" }), TODAY), "DRAFT");
  });
});

describe("nextStatus", () => {
  it("suit le cycle Brouillon → Active → Clôturée → Active", () => {
    assert.equal(nextStatus("DRAFT"), "PUBLISHED");
    assert.equal(nextStatus("PUBLISHED"), "CLOSED");
    assert.equal(nextStatus("CLOSED"), "PUBLISHED");
  });
});

describe("buildOffer", () => {
  const input = { ...toOfferFormValues(baseOffer), skills: ["Excel"] };

  it("une offre publiée reçoit une date de publication", () => {
    const offer = buildOffer(input, { id: 1, companyId: 3, status: "PUBLISHED", now: NOW });
    assert.equal(offer.companyId, 3);
    assert.equal(offer.publishedAt, NOW.toISOString());
  });

  it("un brouillon n'a pas de date de publication", () => {
    const offer = buildOffer(input, { id: 1, companyId: 3, status: "DRAFT", now: NOW });
    assert.equal(offer.publishedAt, null);
    assert.equal(offer.createdAt, NOW.toISOString());
  });
});

describe("changeStatus", () => {
  it("clôture une offre publiée sans validation", () => {
    const result = changeStatus(baseOffer, TODAY, NOW);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.offer.status, "CLOSED");
  });

  it("publie un brouillon complet et lui donne une date de publication", () => {
    const result = changeStatus(offerWith({ status: "DRAFT", publishedAt: null }), TODAY, NOW);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.offer.status, "PUBLISHED");
    assert.equal(result.offer.publishedAt, NOW.toISOString());
  });

  it("refuse de publier un brouillon incomplet", () => {
    const result = changeStatus(
      offerWith({ status: "DRAFT", publishedAt: null, description: "" }),
      TODAY,
      NOW,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /description est obligatoire/);
  });

  it("refuse de réouvrir une offre dont la date limite est dépassée", () => {
    const result = changeStatus(
      offerWith({ status: "CLOSED", deadline: "2026-11-01" }),
      TODAY,
      NOW,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /passé/);
  });

  it("conserve la date de première publication lors d'une réouverture", () => {
    const result = changeStatus(offerWith({ status: "CLOSED" }), TODAY, NOW);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.offer.publishedAt, baseOffer.publishedAt);
  });

  it("ne modifie pas l'offre d'origine (immutabilité attendue par React)", () => {
    const original = offerWith({});
    changeStatus(original, TODAY, NOW);
    assert.equal(original.status, "PUBLISHED");
  });
});

describe("cohérence des données fictives", () => {
  it("chaque offre fictive appartient à une entreprise existante", () => {
    const companyIds = new Set(mockCompanies.map((company) => company.id));
    for (const offer of mockOffers) assert.ok(companyIds.has(offer.companyId), offer.title);
  });

  it("les identifiants des offres sont uniques", () => {
    const ids = mockOffers.map((offer) => offer.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("chaque offre fictive respecte les règles de publication", () => {
    for (const offer of mockOffers) {
      const result = validateOffer(toOfferFormValues(offer), "publish", TODAY);
      assert.equal(result.ok, true, offer.title);
    }
  });

  it("Kamsar Solutions (entreprise de démonstration) ne possède que sa propre offre", () => {
    const kamsarOffers = mockOffers.filter((offer) => offer.companyId === 1);
    assert.deepEqual(
      kamsarOffers.map((offer) => offer.title),
      ["Assistant·e marketing digital"],
    );
  });
});
