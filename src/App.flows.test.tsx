// @vitest-environment jsdom
/**
 * Tests fonctionnels : ils reproduisent les parcours d'un utilisateur
 * (clics, saisies) à travers toute l'application. Les snapshots vérifient
 * l'apparence ; ces tests vérifient que les fonctionnalités marchent.
 */
import assert from "node:assert/strict";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, it } from "vitest";
import { goTo, openTab, renderApp, setupAppTest, statValue, type } from "./test/appTestUtils";

/** Titre « N offre(s) disponible(s) » de la liste publique. */
const offersCount = () => screen.getByRole("heading", { level: 2, name: /disponible/ }).textContent;

/** Ouvre la fenêtre de publication depuis l'espace entreprise. */
function openPublishModal() {
  goTo("Espace entreprise");
  fireEvent.click(screen.getAllByRole("button", { name: "Publier une offre" })[0]);
}

/** Remplit le formulaire de publication avec une offre complète et valide. */
function fillCompleteOffer(title: string) {
  type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), title);
  type(screen.getByLabelText("Type"), "INTERNSHIP");
  type(screen.getByLabelText("Ville"), "Kindia");
  type(screen.getByLabelText("Domaine"), "Finance");
  type(
    screen.getByLabelText("Description"),
    "Vous participerez à la saisie comptable, au classement des pièces et aux rapprochements bancaires.",
  );
  type(screen.getByLabelText("Date limite"), "2026-12-20");
  type(screen.getByLabelText("Compétences"), "Excel, Rigueur");
}

describe("Liste publique des offres", () => {
  setupAppTest();

  it("affiche les 6 offres fictives et la date réellement utilisée", () => {
    renderApp();
    goTo("Offres");
    assert.equal(offersCount(), "6 offres disponibles");
    screen.getByText("Données fictives — offres ouvertes au 12 nov. 2026");
  });

  it("filtre par ville (liste centralisée, Boké comprise)", () => {
    renderApp();
    goTo("Offres");
    type(screen.getAllByDisplayValue("Toutes les villes")[0], "Boké");
    assert.equal(offersCount(), "1 offre disponible");
    screen.getByText("Agent·e logistique");
  });

  it("permet de consulter une offre et d'y postuler", () => {
    renderApp();
    goTo("Offres");
    fireEvent.click(screen.getByText("Développeur·se web junior"));
    screen.getByRole("heading", { level: 1, name: "Développeur·se web junior" });

    fireEvent.click(screen.getByRole("button", { name: "Postuler maintenant" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    screen.getByText("Candidature envoyée");
  });
});

describe("Publication d'offres par une entreprise", () => {
  setupAppTest();

  it("refuse une publication incomplète et affiche les erreurs", () => {
    renderApp();
    openPublishModal();
    const draftButton = screen.getByRole("button", { name: "Enregistrer en brouillon" });
    assert.equal((draftButton as HTMLButtonElement).disabled, true);

    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    screen.getByText("L’intitulé du poste est obligatoire.");
    screen.getByText("La description est obligatoire pour publier.");
    screen.getByText("La date limite est obligatoire pour publier.");
  });

  it("publie une offre complète, visible publiquement et conservée pendant la navigation", () => {
    renderApp();
    goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "1");

    openPublishModal();
    fillCompleteOffer("Comptable junior");
    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    screen.getByText("Votre offre a été publiée avec succès.");
    screen.getByText("Comptable junior");

    goTo("Offres");
    assert.equal(offersCount(), "7 offres disponibles");
    screen.getByText("Comptable junior");

    goTo("Accueil");
    goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "2");
    openTab("Mes offres");
    screen.getByText("Comptable junior");
  });

  it("garde un brouillon hors de la liste publique", () => {
    renderApp();
    openPublishModal();
    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon secret");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));
    screen.getByText("Le brouillon fictif a été enregistré dans vos offres.");
    screen.getByText("Brouillon");

    goTo("Offres");
    assert.equal(offersCount(), "6 offres disponibles");
    assert.equal(screen.queryByText("Brouillon secret"), null);
  });

  it("refuse de publier un brouillon incomplet depuis « Mes offres »", () => {
    renderApp();
    openPublishModal();
    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon incomplet");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));

    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    assert.match(screen.getByRole("alert").textContent ?? "", /ne peut pas être publiée/);
    screen.getByText("Brouillon");
  });

  it("retire une offre clôturée de la liste publique", () => {
    renderApp();
    goTo("Espace entreprise");
    openTab("Mes offres");
    fireEvent.click(screen.getByRole("button", { name: "Clôturer" }));
    screen.getByText("Clôturée");

    goTo("Offres");
    assert.equal(offersCount(), "5 offres disponibles");
    assert.equal(screen.queryByText("Assistant·e marketing digital"), null);
  });

  it("n'affiche que les offres de l'entreprise connectée", () => {
    renderApp();
    goTo("Espace entreprise");
    openTab("Mes offres");
    screen.getByText("Assistant·e marketing digital");
    assert.equal(screen.queryByText("Développeur·se web junior"), null);
  });
});

describe("Suivi des candidatures", () => {
  setupAppTest();

  it("le statut changé par l'entreprise est visible par la candidate", () => {
    renderApp();
    goTo("Espace candidat");
    assert.equal(statValue("Présélections"), "1");

    goTo("Espace entreprise");
    openTab("Candidatures");
    type(screen.getByDisplayValue("En examen"), "Présélectionnée");

    goTo("Espace candidat");
    assert.equal(statValue("Présélections"), "2");
  });
});

describe("Authentification (simulée)", () => {
  setupAppTest();

  it("signale deux mots de passe différents à l'inscription", () => {
    renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un compte" })[0]);
    type(screen.getByLabelText("Nom complet"), "Mariama Diallo");
    type(screen.getByLabelText("Adresse e-mail"), "mariama@exemple.com");
    type(screen.getByLabelText("Mot de passe"), "motdepasse1");
    type(screen.getByLabelText("Confirmer le mot de passe"), "motdepasse2");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    screen.getByText("Les deux mots de passe doivent être identiques.");
  });

  it("la connexion mène à l'espace du rôle choisi", () => {
    renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Se connecter" })[0]);
    type(screen.getByLabelText("Adresse e-mail"), "mariama@exemple.com");
    type(screen.getByLabelText("Mot de passe"), "motdepasse1");
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    screen.getByText("Bonjour, Mariama");
  });
});

describe("Administration", () => {
  setupAppTest();

  it("approuver une entreprise met à jour le compteur", () => {
    renderApp();
    goTo("Administration");
    assert.equal(statValue("Entreprises à vérifier"), "3");
    fireEvent.click(screen.getAllByRole("button", { name: "Approuver" })[0]);
    assert.equal(statValue("Entreprises à vérifier"), "2");
    screen.getByText("Approuvée");
  });
});

describe("Navigation (en-tête, pied de page, espaces)", () => {
  setupAppTest();

  const header = () => within(document.querySelector("header") as HTMLElement);
  const isHome = () => screen.queryByText("Dernières opportunités") !== null;

  it("la navigation principale de l'en-tête mène aux bonnes pages", () => {
    renderApp();
    const nav = within(document.querySelector("header nav") as HTMLElement);
    fireEvent.click(nav.getByRole("button", { name: "Offres" }));
    assert.equal(offersCount(), "6 offres disponibles");

    fireEvent.click(
      within(document.querySelector("header nav") as HTMLElement).getByRole("button", {
        name: "Accueil",
      }),
    );
    assert.equal(isHome(), true);

    fireEvent.click(
      within(document.querySelector("header nav") as HTMLElement).getByRole("button", {
        name: "Espace entreprise",
      }),
    );
    screen.getByText("Kamsar Solutions · Compte vérifié");
  });

  it("le logo ramène à l'accueil", () => {
    renderApp();
    goTo("Offres");
    assert.equal(isHome(), false);
    fireEvent.click(header().getByRole("button", { name: "Retour à l'accueil" }));
    assert.equal(isHome(), true);
  });

  it("le menu mobile s'ouvre et se referme", () => {
    renderApp();
    assert.equal(header().queryByRole("button", { name: "Espace candidat" }), null);
    fireEvent.click(header().getByRole("button", { name: "Ouvrir le menu" }));
    header().getByRole("button", { name: "Espace candidat" });
    fireEvent.click(header().getByRole("button", { name: "Ouvrir le menu" }));
    assert.equal(header().queryByRole("button", { name: "Espace candidat" }), null);
  });

  it("le pied de page mène à la liste des offres", () => {
    renderApp();
    const footer = within(document.querySelector("footer") as HTMLElement);
    fireEvent.click(footer.getByRole("button", { name: "Toutes les offres" }));
    assert.equal(offersCount(), "6 offres disponibles");
  });

  it("« Découvrir les offres » et « Déconnexion » quittent l'espace candidat", () => {
    renderApp();
    goTo("Espace candidat");
    openTab("Découvrir les offres");
    assert.equal(offersCount(), "6 offres disponibles");

    goTo("Espace candidat");
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    assert.equal(isHome(), true);
  });
});
