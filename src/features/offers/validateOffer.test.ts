/**
 * Tests de la validation des offres.
 * Lancement : npm test
 * Outil : node:test, intégré à Node (aucune dépendance supplémentaire).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { OfferFormValues } from "../../types/offer.ts";
import {
  isValidIsoDate,
  parseSkills,
  todayIsoDate,
  toOfferFormValues,
  validateOffer,
} from "./validateOffer.ts";

// Date fixe pour que les tests donnent toujours le même résultat.
const TODAY = "2026-11-12";

const validValues: OfferFormValues = {
  title: "Assistant·e administratif·ve",
  type: "JOB",
  city: "Conakry",
  domain: "Commerce",
  description:
    "Vous assurez l’accueil, la gestion du courrier et le suivi administratif des dossiers clients.",
  deadline: "2026-12-31",
  skills: "Excel, Organisation",
};

/** Crée une copie des valeurs valides en remplaçant certains champs. */
const withValues = (changes: Partial<OfferFormValues>): OfferFormValues => ({
  ...validValues,
  ...changes,
});

describe("validateOffer — publication", () => {
  it("accepte une offre complète et renvoie des données nettoyées", () => {
    const result = validateOffer(
      withValues({ title: "  Assistant   comptable  ", skills: " Excel ,, excel, Rigueur " }),
      "publish",
      TODAY,
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.title, "Assistant comptable");
    assert.deepEqual(result.data.skills, ["Excel", "Rigueur"]);
    assert.equal(result.data.type, "JOB");
    assert.equal(result.data.deadline, "2026-12-31");
  });

  it("refuse un formulaire vide et signale chaque champ obligatoire", () => {
    const result = validateOffer(
      withValues({ title: "", description: "", deadline: "", skills: "" }),
      "publish",
      TODAY,
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(Object.keys(result.errors).sort(), ["deadline", "description", "title"]);
  });

  it("refuse une description trop courte", () => {
    const result = validateOffer(withValues({ description: "Trop court." }), "publish", TODAY);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.errors.description ?? "", /au moins 50 caractères/);
  });

  it("refuse une date limite passée mais accepte la date du jour", () => {
    const past = validateOffer(withValues({ deadline: "2026-11-11" }), "publish", TODAY);
    assert.equal(past.ok, false);
    if (!past.ok) assert.match(past.errors.deadline ?? "", /passé/);

    const today = validateOffer(withValues({ deadline: TODAY }), "publish", TODAY);
    assert.equal(today.ok, true);
  });

  it("refuse une date inexistante", () => {
    const result = validateOffer(withValues({ deadline: "2027-02-30" }), "publish", TODAY);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.errors.deadline ?? "", /pas valide/);
  });

  it("refuse un titre trop court ou trop long", () => {
    const short = validateOffer(withValues({ title: "Ab" }), "publish", TODAY);
    const long = validateOffer(withValues({ title: "a".repeat(121) }), "publish", TODAY);
    assert.equal(short.ok, false);
    assert.equal(long.ok, false);
  });

  it("refuse une valeur de liste déroulante inconnue", () => {
    const result = validateOffer(
      { ...validValues, city: "Paris" } as unknown as OfferFormValues,
      "publish",
      TODAY,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.city);
  });

  it("limite le nombre de compétences", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `Compétence ${i + 1}`).join(", ");
    const result = validateOffer(withValues({ skills: eleven }), "publish", TODAY);
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.skills);
  });

  it("accepte une offre sans compétences (champ facultatif)", () => {
    const result = validateOffer(withValues({ skills: "" }), "publish", TODAY);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data.skills, []);
  });
});

describe("validateOffer — brouillon", () => {
  it("accepte un brouillon avec seulement un titre", () => {
    const result = validateOffer(
      withValues({ description: "", deadline: "", skills: "" }),
      "draft",
      TODAY,
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.description, "");
  });

  it("refuse un brouillon sans titre", () => {
    const result = validateOffer(withValues({ title: "   " }), "draft", TODAY);
    assert.equal(result.ok, false);
    if (!result.ok) assert.deepEqual(Object.keys(result.errors), ["title"]);
  });

  it("accepte une date passée dans un brouillon, mais pas une date invalide", () => {
    assert.equal(validateOffer(withValues({ deadline: "2026-01-01" }), "draft", TODAY).ok, true);
    assert.equal(validateOffer(withValues({ deadline: "31/12/2026" }), "draft", TODAY).ok, false);
  });

  it("un brouillon incomplet ne passe pas la validation de publication", () => {
    const draft = validateOffer(withValues({ description: "" }), "draft", TODAY);
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    const publish = validateOffer(toOfferFormValues(draft.data), "publish", TODAY);
    assert.equal(publish.ok, false);
  });
});

describe("fonctions utilitaires", () => {
  it("parseSkills nettoie et dédoublonne", () => {
    assert.deepEqual(parseSkills(""), []);
    assert.deepEqual(parseSkills("React,  react , TypeScript,"), ["React", "TypeScript"]);
  });

  it("isValidIsoDate reconnaît les dates réelles", () => {
    assert.equal(isValidIsoDate("2028-02-29"), true); // année bissextile
    assert.equal(isValidIsoDate("2027-02-29"), false);
    assert.equal(isValidIsoDate("2027-1-5"), false);
  });

  it("todayIsoDate utilise la date locale", () => {
    assert.equal(todayIsoDate(new Date(2027, 0, 5, 23, 30)), "2027-01-05");
  });
});
