/**
 * Tests des règles de visibilité et de statut des offres.
 * Lancement : npm test (Vitest)
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { Offer } from "../../types/offer";
import { getDisplayStatus, isExpired, isPubliclyVisible, nextStatus } from "./offerRules";

const TODAY = "2026-11-12";

const baseOffer: Offer = {
  id: "100",
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
