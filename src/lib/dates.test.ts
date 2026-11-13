/**
 * Tests des fonctions utilitaires sur les dates.
 * Lancement : npm test (Vitest)
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { formatShortDate, isValidIsoDate, todayIsoDate } from "./dates.ts";

describe("isValidIsoDate", () => {
  it("reconnaît les dates réelles", () => {
    assert.equal(isValidIsoDate("2028-02-29"), true); // année bissextile
    assert.equal(isValidIsoDate("2027-02-29"), false);
    assert.equal(isValidIsoDate("2027-1-5"), false);
  });
});

describe("todayIsoDate", () => {
  it("utilise la date locale", () => {
    assert.equal(todayIsoDate(new Date(2027, 0, 5, 23, 30)), "2027-01-05");
  });
});

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
