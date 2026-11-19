/**
 * Tests du formulaire de profil candidat : conversion, contrôles et fichier du CV.
 */
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import {
  cvFileProblem,
  formatFileSize,
  parseSkills,
  profileFormFromApi,
  validateProfileForm,
} from "./candidateProfileForm";

const form = {
  fullName: "  Aïssatou   Bah ",
  cityId: "kindia",
  education: " BTS ",
  bio: "",
  skills: "Excel, , excel , Sage",
};

describe("profileFormFromApi", () => {
  it("remplit le formulaire avec les valeurs du serveur (vides si absentes)", () => {
    assert.deepEqual(
      profileFormFromApi({
        fullName: "Aïssatou Bah",
        email: "a@exemple.gn",
        city: null,
        education: null,
        bio: "Motivée",
        skills: ["Excel", "Sage"],
        cv: null,
      }),
      {
        fullName: "Aïssatou Bah",
        cityId: "",
        education: "",
        bio: "Motivée",
        skills: "Excel, Sage",
      },
    );
  });
});

describe("parseSkills", () => {
  it("retire les vides et les doublons (sans tenir compte des majuscules)", () => {
    assert.deepEqual(parseSkills(form.skills), ["Excel", "Sage"]);
    assert.deepEqual(parseSkills(""), []);
  });
});

describe("validateProfileForm", () => {
  it("nettoie les textes et prépare la requête", () => {
    assert.deepEqual(validateProfileForm(form), {
      ok: true,
      payload: {
        fullName: "Aïssatou Bah",
        cityId: "kindia",
        education: "BTS",
        bio: "",
        skills: ["Excel", "Sage"],
      },
    });
  });

  it("refuse un nom trop court et trop de compétences", () => {
    const result = validateProfileForm({
      ...form,
      fullName: "A",
      skills: Array.from({ length: 21 }, (_, i) => `c${i}`).join(","),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.errors.fullName ?? "", /entre 2 et 100 caractères/);
      assert.match(result.errors.skills ?? "", /au maximum 20/);
    }
  });
});

describe("cvFileProblem", () => {
  const file = (name: string, size: number, type = "application/pdf") =>
    new File([new Uint8Array(size)], name, { type });

  it("accepte un PDF de 5 Mo au plus", () => {
    assert.equal(cvFileProblem(file("cv.pdf", 1000)), null);
    assert.equal(cvFileProblem(file("cv.pdf", 5 * 1024 * 1024)), null);
  });

  it("refuse un autre format, un fichier vide ou trop lourd", () => {
    assert.match(cvFileProblem(file("cv.docx", 10, "application/msword")) ?? "", /PDF/);
    assert.match(cvFileProblem(file("cv.pdf", 0)) ?? "", /vide/);
    assert.match(cvFileProblem(file("cv.pdf", 5 * 1024 * 1024 + 1)) ?? "", /5 Mo/);
  });
});

describe("formatFileSize", () => {
  it("affiche des Ko ou des Mo", () => {
    assert.equal(formatFileSize(45_678), "45 Ko");
    assert.equal(formatFileSize(300), "1 Ko");
    assert.equal(formatFileSize(1_258_291), "1,2 Mo");
  });
});
