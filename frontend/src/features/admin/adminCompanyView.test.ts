/**
 * Tests de la conversion des entreprises (API → affichage) et des messages d'erreur
 * des décisions de l'administration.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { ApiError, SESSION_EXPIRED_MESSAGE } from "../../services/apiClient";
import type { AdminCompanyApi } from "../../services/adminCompaniesService";
import { adminErrorFromApi, toAdminCompanyView } from "./adminCompanyView";

const company: AdminCompanyApi = {
  id: "20000000-0000-4000-8000-000000000008",
  name: "Kindia Agro Services",
  sector: "Agriculture",
  city: { id: "kindia", name: "Kindia" },
  status: "PENDING",
  rejectionReason: null,
  createdAt: "2026-12-14T12:00:00.000Z",
  reviewedAt: null,
  offersCount: 0,
};

describe("toAdminCompanyView", () => {
  it("garde les vraies valeurs et traduit le statut", () => {
    assert.deepEqual(toAdminCompanyView(company), {
      id: company.id,
      name: "Kindia Agro Services",
      sector: "Agriculture",
      city: "Kindia",
      date: "14 déc. 2026",
      status: "PENDING",
      statusLabel: "En attente",
      rejectionReason: null,
    });
  });

  it("signale un profil incomplet au lieu d'inventer des valeurs", () => {
    const view = toAdminCompanyView({ ...company, sector: "  ", city: null });
    assert.equal(view.sector, "Secteur non renseigné");
    assert.equal(view.city, "Ville non renseignée");
  });

  it("conserve le motif d'un refus", () => {
    const view = toAdminCompanyView({
      ...company,
      status: "REJECTED",
      rejectionReason: "RCCM manquant",
    });
    assert.equal(view.statusLabel, "Refusée");
    assert.equal(view.rejectionReason, "RCCM manquant");
  });
});

describe("adminErrorFromApi", () => {
  it("session expirée (401)", () => {
    assert.deepEqual(adminErrorFromApi(new ApiError("x", 401)), {
      kind: "session",
      message: SESSION_EXPIRED_MESSAGE,
    });
  });

  it("décision déjà prise ou entreprise disparue : la liste est périmée", () => {
    const already = adminErrorFromApi(
      new ApiError("Cette entreprise est déjà approuvée.", 409, "COMPANY_ALREADY_IN_STATUS"),
    );
    assert.equal(already.kind, "stale");
    assert.match(already.message, /déjà approuvée\. La liste a été mise à jour\./);
    assert.equal(adminErrorFromApi(new ApiError("x", 404, "COMPANY_NOT_FOUND")).kind, "stale");
  });

  it("motif refusé par le serveur : message du serveur", () => {
    const error = adminErrorFromApi(
      new ApiError("Le motif du refus est obligatoire.", 400, "VALIDATION_FAILED"),
    );
    assert.deepEqual(error, { kind: "validation", message: "Le motif du refus est obligatoire." });
  });

  it("accès refusé (403) et erreur inattendue", () => {
    assert.match(adminErrorFromApi(new ApiError("x", 403)).message, /réservée aux administrateurs/);
    assert.equal(
      adminErrorFromApi(new Error("boom")).message,
      "Une erreur inattendue est survenue.",
    );
  });
});
