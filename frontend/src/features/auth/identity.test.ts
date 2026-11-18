/**
 * Tests de l'identité affichée dans les espaces.
 * Lancement : npm test (Vitest)
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import type { SessionUser } from "../../services/authService";
import { identityOf, initialsOfName, ownsDemoData } from "./identity";

const candidate: SessionUser = {
  id: "u1",
  email: "ibrahima@exemple.com",
  fullName: "Ibrahima Sow",
  role: "CANDIDATE",
  company: null,
};

describe("identité des espaces", () => {
  it("calcule les initiales", () => {
    assert.equal(initialsOfName("Mariama Diallo"), "MD");
    assert.equal(initialsOfName("  aïssatou   camara bah "), "AC");
    assert.equal(initialsOfName("Administrateur"), "AD");
    assert.equal(initialsOfName(""), "?");
  });

  it("affiche le candidat connecté", () => {
    assert.deepEqual(identityOf(candidate), {
      name: "Ibrahima Sow",
      initials: "IS",
      firstName: "Ibrahima",
      statusLabel: "Compte vérifié",
    });
  });

  it("affiche l'entreprise connectée et son vrai statut", () => {
    const identity = identityOf({
      ...candidate,
      role: "COMPANY",
      fullName: "Fatou Camara",
      company: { id: "c1", name: "Soumba Services", status: "PENDING" },
    });
    assert.equal(identity.name, "Soumba Services");
    assert.equal(identity.initials, "SS");
    assert.equal(identity.statusLabel, "En attente de validation");
  });

  it("réserve les données fictives aux comptes de démonstration", () => {
    assert.equal(ownsDemoData(candidate), false);
    assert.equal(ownsDemoData(null), false);
    assert.equal(ownsDemoData({ ...candidate, email: "mariama.diallo@proavenir.test" }), true);
    // Même e-mail mais autre rôle : non.
    assert.equal(
      ownsDemoData({ ...candidate, email: "mariama.diallo@proavenir.test", role: "ADMIN" }),
      false,
    );
  });
});
