// @vitest-environment jsdom
/**
 * Snapshots de rendu : le HTML de chaque écran est enregistré dans
 * src/__snapshots__/pages/*.html. Après chaque étape de réorganisation,
 * le HTML doit rester IDENTIQUE au caractère près : c'est la preuve que
 * le design n'a pas changé.
 *
 * Si un changement de rendu est VOULU, on met à jour les snapshots avec :
 *   npm test -- -u
 * puis on relit la différence avec `git diff` avant de valider.
 */
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatHtml, goTo, openTab, renderApp, setupAppTest } from "./test/appTestUtils";

/** Compare le rendu actuel au snapshot enregistré pour cet écran. */
async function expectScreen(container: HTMLElement, name: string) {
  await expect(formatHtml(container)).toMatchFileSnapshot(`./__snapshots__/pages/${name}.html`);
}

const headerButton = (name: string) =>
  within(document.querySelector("header") as HTMLElement).getByRole("button", { name });

describe("Rendu des pages publiques", () => {
  setupAppTest();

  it("accueil", async () => {
    const { container } = await renderApp();
    await expectScreen(container, "accueil");
  });

  it("liste des offres", async () => {
    const { container } = await renderApp();
    await goTo("Offres");
    await expectScreen(container, "offres");
  });

  it("détail d'une offre", async () => {
    const { container } = await renderApp();
    await goTo("Offres");
    fireEvent.click(screen.getByText("Développeur·se web junior"));
    await expectScreen(container, "offre-detail");
  });

  it("fenêtre de candidature", async () => {
    const { container } = await renderApp();
    await goTo("Offres");
    fireEvent.click(screen.getByText("Développeur·se web junior"));
    fireEvent.click(screen.getByRole("button", { name: "Postuler maintenant" }));
    await expectScreen(container, "offre-candidature");
  });

  it("connexion", async () => {
    const { container } = await renderApp();
    fireEvent.click(headerButton("Se connecter"));
    await expectScreen(container, "connexion");
  });

  it("inscription", async () => {
    const { container } = await renderApp();
    fireEvent.click(headerButton("Créer un compte"));
    await expectScreen(container, "inscription");
  });
});

describe("Rendu de l'espace candidat", () => {
  setupAppTest();

  it.each([
    ["Aperçu", "candidat-apercu"],
    ["Mon profil", "candidat-profil"],
    ["Mes candidatures", "candidat-candidatures"],
  ])("onglet %s", async (tab, name) => {
    const { container } = await renderApp();
    await goTo("Espace candidat");
    openTab(tab);
    await expectScreen(container, name);
  });
});

describe("Rendu de l'espace entreprise", () => {
  setupAppTest();

  it.each([
    ["Aperçu", "entreprise-apercu"],
    ["Profil entreprise", "entreprise-profil"],
    ["Mes offres", "entreprise-offres"],
    ["Candidatures", "entreprise-candidatures"],
  ])("onglet %s", async (tab, name) => {
    const { container } = await renderApp();
    await goTo("Espace entreprise");
    openTab(tab);
    await expectScreen(container, name);
  });

  it("fenêtre de publication d'une offre", async () => {
    const { container } = await renderApp();
    await goTo("Espace entreprise");
    fireEvent.click(screen.getAllByRole("button", { name: "Publier une offre" })[0]);
    await expectScreen(container, "entreprise-publication");
  });
});

describe("Rendu de l'administration", () => {
  setupAppTest();

  it.each([
    ["Vue générale", "admin-vue-generale"],
    ["Entreprises", "admin-entreprises"],
    ["Modération", "admin-moderation"],
  ])("onglet %s", async (tab, name) => {
    const { container } = await renderApp();
    await goTo("Administration");
    openTab(tab);
    await expectScreen(container, name);
  });
});
