/**
 * Outils communs aux tests d'interface de ProAvenir.
 *
 * Principe : les tests n'importent QUE le composant racine `App` et naviguent
 * comme un utilisateur (clics sur les vrais boutons). Ainsi, pendant la
 * réorganisation (déplacement des composants dans d'autres fichiers),
 * ces tests n'ont pas besoin d'être modifiés : s'ils restent verts et que
 * les snapshots sont identiques, le comportement et le rendu n'ont pas changé.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import App from "../App";

/** Date figée : les offres visibles et les dates affichées ne dépendent pas du jour du test. */
export const FIXED_NOW = new Date("2026-11-12T10:00:00.000Z");

/** À appeler dans chaque `describe` de test d'interface. */
export function setupAppTest() {
  beforeEach(() => {
    // On ne simule que `Date` ; les minuteurs (setTimeout…) restent réels.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
    // jsdom n'implémente pas le défilement ; `go()` l'appelle à chaque navigation.
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });
  afterEach(() => {
    cleanup(); // retire l'application du faux document entre deux tests
    vi.useRealTimers();
  });
}

export function renderApp() {
  return render(<App />);
}

export type MenuLabel =
  | "Accueil"
  | "Offres"
  | "Espace candidat"
  | "Espace entreprise"
  | "Administration";

/**
 * Navigue via le menu mobile de l'en-tête, présent sur toutes les pages
 * sauf connexion/inscription (jsdom n'applique pas le CSS, il est donc cliquable).
 */
export function goTo(label: MenuLabel) {
  const header = within(document.querySelector("header") as HTMLElement);
  fireEvent.click(header.getByRole("button", { name: "Ouvrir le menu" }));
  // Le menu mobile est affiché après la navigation principale : on prend le dernier bouton.
  const buttons = header.getAllByRole("button", { name: label });
  fireEvent.click(buttons[buttons.length - 1]);
}

/** Clique sur un onglet d'un espace (le menu existe en double : barre latérale et mobile). */
export function openTab(label: string) {
  fireEvent.click(screen.getAllByRole("button", { name: label })[0]);
}

/** Lit la valeur d'une carte de statistique à partir de son libellé (« Offres actives »…). */
export function statValue(label: string): string {
  // Le même texte peut aussi servir de titre de section : on ne garde que celui d'une carte.
  const labelElement = screen
    .getAllByText(label)
    .find((element) => element.closest(".stat-card") !== null);
  if (!labelElement) throw new Error(`Carte de statistique introuvable : « ${label} »`);
  return labelElement.previousElementSibling?.textContent ?? "";
}

/** Saisit une valeur dans un champ contrôlé par React. */
export function type(element: HTMLElement, value: string) {
  fireEvent.change(element, { target: { value } });
}

/** HTML indenté sur plusieurs lignes, pour des snapshots lisibles et des différences claires. */
export function formatHtml(container: HTMLElement): string {
  return container.innerHTML.replace(/></g, ">\n<") + "\n";
}
