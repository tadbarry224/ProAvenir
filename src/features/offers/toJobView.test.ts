/**
 * Tests de la conversion Offer → Job (modèle d'affichage).
 * Lancement : npm test (Vitest)
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import type { Company, Offer } from "../../types/offer";
import { contractLabel, toJobView } from "./toJobView";

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

describe("toJobView", () => {
  it("convertit une offre au format attendu par les composants publics", () => {
    const job = toJobView(offer, company);
    assert.equal(job.id, 7);
    assert.equal(job.company, "Fouta Conseil");
    assert.equal(job.initials, "FC");
    assert.equal(job.color, "violet");
    assert.equal(job.type, "Stage");
    assert.equal(job.contract, "Stage"); // sans détail de contrat : le type seul
    assert.equal(job.posted, "Publiée le 28 nov. 2026");
    assert.equal(job.deadline, "15 janv. 2027");
    assert.deepEqual(job.skills, ["Comptabilité", "Excel"]);
  });

  it("compose le libellé de contrat à partir des champs structurés", () => {
    const job = toJobView({ ...offer, contractType: "INTERNSHIP", duration: "3 mois" }, company);
    assert.equal(job.contract, "Stage · 3 mois");
  });

  it("contractLabel reproduit les libellés des offres fictives", () => {
    const job = { type: "JOB" as const };
    assert.equal(
      contractLabel({ ...job, contractType: "CDI", workSchedule: "FULL_TIME" }),
      "CDI · Temps plein",
    );
    assert.equal(
      contractLabel({ ...job, contractType: "CDD", duration: "12 mois" }),
      "CDD · 12 mois",
    );
    assert.equal(
      contractLabel({ type: "INTERNSHIP", contractType: "INTERNSHIP", duration: "6 mois" }),
      "Stage · 6 mois",
    );
  });

  it("contractLabel gère les autres combinaisons", () => {
    assert.equal(contractLabel({ type: "JOB" }), "Emploi");
    assert.equal(
      contractLabel({
        type: "JOB",
        contractType: "CDD",
        duration: "6 mois",
        workSchedule: "PART_TIME",
      }),
      "CDD · 6 mois · Temps partiel",
    );
    assert.equal(
      contractLabel({ type: "JOB", contractType: "OTHER", duration: "  " }),
      "Autre contrat",
    );
    assert.equal(
      contractLabel({ type: "INTERNSHIP", workSchedule: "FULL_TIME" }),
      "Stage · Temps plein",
    );
  });

  it("reste utilisable si l'entreprise est inconnue", () => {
    const job = toJobView(offer, undefined);
    assert.equal(job.company, "Entreprise");
    assert.equal(job.initials, "E");
    assert.equal(job.color, "blue");
  });
});
