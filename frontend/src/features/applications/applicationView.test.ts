/**
 * Tests de la conversion des candidatures (API → affichage) et des messages d'erreur.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { ApiError, SESSION_EXPIRED_MESSAGE } from "../../services/apiClient";
import type {
  CandidateApplicationApi,
  ReceivedApplicationApi,
} from "../../services/applicationsService";
import {
  applicationErrorFromApi,
  toCandidateApplicationView,
  toRecruitApplicationView,
} from "./applicationView";

const base = {
  id: "50000000-0000-4000-8000-000000000001",
  status: "IN_REVIEW" as const,
  message: "Bonjour",
  createdAt: "2026-12-12T12:00:00.000Z",
  updatedAt: "2026-12-13T12:00:00.000Z",
};

describe("toCandidateApplicationView", () => {
  const application: CandidateApplicationApi = {
    ...base,
    offer: {
      id: "30000000-0000-4000-8000-000000000001",
      title: "Assistant·e marketing digital",
      type: "JOB",
      city: { id: "conakry", name: "Conakry" },
      company: { name: "Kamsar Solutions", logoColor: "blue" },
      publiclyVisible: false,
    },
  };

  it("garde l'offre, la date et le statut en français", () => {
    assert.deepEqual(toCandidateApplicationView(application), {
      id: base.id,
      offerId: "30000000-0000-4000-8000-000000000001",
      title: "Assistant·e marketing digital",
      company: "Kamsar Solutions",
      date: "12 déc. 2026",
      status: "IN_REVIEW",
      statusLabel: "En examen",
      offerOnline: false,
    });
  });
});

describe("toRecruitApplicationView", () => {
  const application: ReceivedApplicationApi = {
    ...base,
    cvFileName: null,
    offer: { id: "o1", title: "Stagiaire comptable" },
    candidate: {
      fullName: "Fatou Camara",
      email: "fatou@exemple.gn",
      city: null,
      education: null,
      skills: [],
    },
  };

  it("montre le candidat, son e-mail, l'offre et son message", () => {
    assert.deepEqual(toRecruitApplicationView(application), {
      id: base.id,
      name: "Fatou Camara",
      initials: "FC",
      email: "fatou@exemple.gn",
      role: "Stagiaire comptable",
      date: "12 déc. 2026",
      status: "IN_REVIEW",
      statusLabel: "En examen",
      message: "Bonjour",
      cvFileName: null,
    });
  });
});

describe("applicationErrorFromApi", () => {
  it("session expirée (401)", () => {
    assert.deepEqual(applicationErrorFromApi(new ApiError("x", 401)), {
      kind: "session",
      message: SESSION_EXPIRED_MESSAGE,
    });
  });

  it("déjà postulé ou statut déjà changé : la liste est relue", () => {
    for (const code of [
      "ALREADY_APPLIED",
      "INVALID_APPLICATION_TRANSITION",
      "APPLICATION_NOT_FOUND",
    ]) {
      assert.equal(applicationErrorFromApi(new ApiError("x", 409, code)).kind, "stale");
    }
  });

  it("offre plus disponible : message du serveur", () => {
    const error = applicationErrorFromApi(
      new ApiError("Cette offre n’est plus disponible.", 404, "OFFER_NOT_AVAILABLE"),
    );
    assert.deepEqual(error, { kind: "other", message: "Cette offre n’est plus disponible." });
  });
});
