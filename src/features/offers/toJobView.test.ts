/**
 * Tests de la conversion Offer → Job (modèle d'affichage).
 * Lancement : npm test (Vitest)
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { Company, Offer } from "../../types/offer.ts";
import { formatShortDate, toJobView } from "./toJobView.ts";

const company: Company = { id: 4, name: "Fouta Conseil", initials: "FC", logoColor: "violet" };

const offer: Offer = {
  id: 7,
  companyId: 4,
  status: "PUBLISHED",
  title: "Stagiaire comptable",
  type: "INTERNSHIP",
  city: "Labé",
  domain: "Finance",
  description: "Saisie des pièces comptables et préparation des états de rapprochement mensuels.",
  deadline: "2027-01-15",
  skills: ["Comptabilité", "Excel"],
  createdAt: "2026-11-28T12:00:00.000Z",
  publishedAt: "2026-11-28T12:00:00.000Z",
};

describe("formatShortDate", () => {
  it("formate une date seule en français, sans décalage de fuseau", () => {
    assert.equal(formatShortDate("2026-12-28"), "28 déc. 2026");
  });

  it("formate une date ISO complète", () => {
    assert.equal(formatShortDate("2026-11-28T12:00:00.000Z"), "28 nov. 2026");
  });

  it("renvoie une chaîne vide pour une date invalide", () => {
    assert.equal(formatShortDate("pas une date"), "");
  });
});

describe("toJobView", () => {
  it("convertit une offre au format attendu par les composants publics", () => {
    const job = toJobView(offer, company);
    assert.equal(job.id, 7);
    assert.equal(job.company, "Fouta Conseil");
    assert.equal(job.initials, "FC");
    assert.equal(job.color, "violet");
    assert.equal(job.type, "Stage");
    assert.equal(job.contract, "Stage"); // pas encore de champ contrat dans le formulaire
    assert.equal(job.posted, "Publiée le 28 nov. 2026");
    assert.equal(job.deadline, "15 janv. 2027");
    assert.deepEqual(job.skills, ["Comptabilité", "Excel"]);
  });

  it("utilise le libellé de contrat s'il existe (offres fictives)", () => {
    const job = toJobView({ ...offer, contract: "Stage · 3 mois" }, company);
    assert.equal(job.contract, "Stage · 3 mois");
  });

  it("reste utilisable si l'entreprise est inconnue", () => {
    const job = toJobView(offer, undefined);
    assert.equal(job.company, "Entreprise");
    assert.equal(job.initials, "E");
    assert.equal(job.color, "blue");
  });
});
