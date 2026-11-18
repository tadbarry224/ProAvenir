// @vitest-environment jsdom
/**
 * Tests fonctionnels : ils reproduisent les parcours d'un utilisateur
 * (clics, saisies) à travers toute l'application. Les snapshots vérifient
 * l'apparence ; ces tests vérifient que les fonctionnalités marchent.
 */
import assert from "node:assert/strict";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import {
  goTo,
  loginWithForm,
  openTab,
  renderApp,
  settle,
  setupAppTest,
  statValue,
  type,
} from "./test/appTestUtils";
import { FAKE_USERS, installFakeApi, TEST_PASSWORD } from "./test/fakeApi";

/** Titre « N offre(s) disponible(s) » de la liste publique, une fois le chargement terminé. */
async function offersCount() {
  await settle();
  return screen.getByRole("heading", { level: 2 }).textContent;
}

/** Paramètres de la dernière requête GET /api/offers (filtres envoyés au serveur). */
const lastOffersQuery = (requests: URL[]) =>
  Object.fromEntries(requests.filter((url) => url.pathname === "/api/offers").at(-1)!.searchParams);

/** Ouvre la fenêtre de publication depuis l'espace entreprise. */
async function openPublishModal() {
  await goTo("Espace entreprise");
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

  it("affiche les 6 offres de l'API et la date du serveur", async () => {
    await renderApp();
    await goTo("Offres");
    assert.equal(await offersCount(), "6 offres disponibles");
    screen.getByText("Offres ouvertes au 13 nov. 2026");
  });

  it("affiche le contrat, la durée et les dates venant de l'API dans le détail", async () => {
    await renderApp();
    await goTo("Offres");
    fireEvent.click(screen.getByText("Stagiaire comptable"));
    screen.getByRole("heading", { level: 1, name: "Stagiaire comptable" });
    screen.getByText("Stage · 3 mois"); // contractType INTERNSHIP + duration
    screen.getByText("Publiée le 28 nov. 2026"); // publishedAt
    screen.getByText("15 janv. 2027"); // deadline

    await goTo("Offres");
    fireEvent.click(screen.getByText("Agent·e logistique"));
    screen.getByText("CDI · Temps plein"); // contractType CDI + workSchedule
  });

  it("filtre par ville via l'API (Boké comprise)", async () => {
    const { requests } = installFakeApi();
    await renderApp();
    await goTo("Offres");
    type(screen.getAllByDisplayValue("Toutes les villes")[0], "Boké");
    assert.equal(await offersCount(), "1 offre disponible");
    screen.getByText("Agent·e logistique");
    assert.deepEqual(lastOffersQuery(requests), { city: "boke" });
  });

  it("combine domaine, type et recherche dans la requête envoyée", async () => {
    const { requests } = installFakeApi();
    await renderApp();
    await goTo("Offres");
    type(screen.getAllByDisplayValue("Tous les domaines")[0], "Finance");
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Stage/ })[0]);
    type(screen.getByPlaceholderText("Poste, compétence ou entreprise..."), "  excel ");
    fireEvent.submit(
      screen.getByPlaceholderText("Poste, compétence ou entreprise...").closest("form")!,
    );
    assert.equal(await offersCount(), "1 offre disponible");
    screen.getByText("Stagiaire comptable");
    assert.deepEqual(lastOffersQuery(requests), {
      domain: "finance",
      type: "INTERNSHIP",
      q: "excel",
    });
  });

  it("affiche un état vide quand aucune offre ne correspond", async () => {
    await renderApp();
    await goTo("Offres");
    type(screen.getAllByDisplayValue("Toutes les villes")[0], "Boké");
    fireEvent.click(screen.getAllByRole("checkbox", { name: /Stage/ })[0]);
    assert.equal(await offersCount(), "0 offres disponibles");
    screen.getByText("Aucune offre trouvée");
  });

  it("affiche un état de chargement pendant la requête", async () => {
    await renderApp();
    await goTo("Accueil");
    const header = within(document.querySelector("header") as HTMLElement);
    fireEvent.click(header.getByRole("button", { name: "Ouvrir le menu" }));
    const buttons = header.getAllByRole("button", { name: "Offres" });
    fireEvent.click(buttons[buttons.length - 1]);
    // Avant la réponse du serveur :
    screen.getByRole("heading", { level: 2, name: "Chargement des offres…" });
    screen.getByRole("status");
    await settle();
    screen.getByRole("heading", { level: 2, name: "6 offres disponibles" });
  });

  it("affiche un message clair si l'API est injoignable, sans données fictives", async () => {
    installFakeApi({ down: true });
    await renderApp();
    await goTo("Offres");
    assert.equal(await offersCount(), "Offres indisponibles");
    assert.match(screen.getByRole("alert").textContent ?? "", /Impossible de joindre le serveur/);
    assert.equal(screen.queryByText("Développeur·se web junior"), null);
    // Accueil : aucune offre fictive non plus.
    await goTo("Accueil");
    assert.equal(screen.queryByText("Développeur·se web junior"), null);
  });

  it("affiche l'erreur serveur puis recharge avec « Réessayer »", async () => {
    installFakeApi({ offersStatus: 500 });
    await renderApp();
    await goTo("Offres");
    assert.match(screen.getByRole("alert").textContent ?? "", /Le serveur rencontre un problème/);

    installFakeApi(); // le serveur répond de nouveau
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    assert.equal(await offersCount(), "6 offres disponibles");
  });

  it("permet de consulter une offre et d'y postuler", async () => {
    await renderApp();
    await goTo("Offres");
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

  it("refuse une publication incomplète et affiche les erreurs", async () => {
    await renderApp({ as: "COMPANY" });
    await openPublishModal();
    const draftButton = screen.getByRole("button", { name: "Enregistrer en brouillon" });
    assert.equal((draftButton as HTMLButtonElement).disabled, true);

    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    screen.getByText("L’intitulé du poste est obligatoire.");
    screen.getByText("La description est obligatoire pour publier.");
    screen.getByText("La date limite est obligatoire pour publier.");
  });

  // Jusqu'à l'étape B4, l'espace entreprise travaille sur des données locales :
  // ses actions ne modifient pas la liste publique, qui vient de PostgreSQL.
  it("publie une offre complète, conservée pendant la navigation (pas encore envoyée à l'API)", async () => {
    await renderApp({ as: "COMPANY" });
    await goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "1");

    await openPublishModal();
    fillCompleteOffer("Comptable junior");
    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    screen.getByText("Votre offre a été publiée avec succès.");
    screen.getByText("Comptable junior");

    await goTo("Offres");
    assert.equal(await offersCount(), "6 offres disponibles");
    assert.equal(screen.queryByText("Comptable junior"), null);

    await goTo("Accueil");
    await goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "2");
    openTab("Mes offres");
    screen.getByText("Comptable junior");
  });

  it("garde un brouillon hors de la liste publique", async () => {
    await renderApp({ as: "COMPANY" });
    await openPublishModal();
    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon secret");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));
    screen.getByText("Le brouillon fictif a été enregistré dans vos offres.");
    screen.getByText("Brouillon");

    await goTo("Offres");
    assert.equal(await offersCount(), "6 offres disponibles");
    assert.equal(screen.queryByText("Brouillon secret"), null);
  });

  it("refuse de publier un brouillon incomplet depuis « Mes offres »", async () => {
    await renderApp({ as: "COMPANY" });
    await openPublishModal();
    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon incomplet");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));

    fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    assert.match(screen.getByRole("alert").textContent ?? "", /ne peut pas être publiée/);
    screen.getByText("Brouillon");
  });

  it("clôture une offre dans l'espace entreprise (liste publique inchangée avant B4)", async () => {
    await renderApp({ as: "COMPANY" });
    await goTo("Espace entreprise");
    openTab("Mes offres");
    fireEvent.click(screen.getByRole("button", { name: "Clôturer" }));
    screen.getByText("Clôturée");

    await goTo("Offres");
    assert.equal(await offersCount(), "6 offres disponibles");
    screen.getByText("Assistant·e marketing digital");
  });

  it("n'affiche que les offres de l'entreprise connectée", async () => {
    await renderApp({ as: "COMPANY" });
    await goTo("Espace entreprise");
    openTab("Mes offres");
    screen.getByText("Assistant·e marketing digital");
    assert.equal(screen.queryByText("Développeur·se web junior"), null);
  });
});

describe("Suivi des candidatures", () => {
  setupAppTest();

  it("le statut changé par l'entreprise est visible par la candidate (deux sessions)", async () => {
    await renderApp();
    await loginWithForm("CANDIDATE");
    assert.equal(statValue("Présélections"), "1");
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await settle();

    await loginWithForm("COMPANY");
    openTab("Candidatures");
    type(screen.getByDisplayValue("En examen"), "Présélectionnée");
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await settle();

    await loginWithForm("CANDIDATE");
    assert.equal(statValue("Présélections"), "2");
  });
});

describe("Authentification", () => {
  setupAppTest();

  /** Remplit le formulaire d'inscription (page déjà ouverte). */
  function fillRegister(values: {
    fullName: string;
    email: string;
    password: string;
    company?: string;
  }) {
    type(screen.getByLabelText("Nom complet"), values.fullName);
    if (values.company) type(screen.getByLabelText("Nom de l’entreprise"), values.company);
    type(screen.getByLabelText("Adresse e-mail"), values.email);
    type(screen.getByLabelText("Mot de passe"), values.password);
    type(screen.getByLabelText("Confirmer le mot de passe"), values.password);
  }

  it("signale deux mots de passe différents à l'inscription", async () => {
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un compte" })[0]);
    type(screen.getByLabelText("Nom complet"), "Mariama Diallo");
    type(screen.getByLabelText("Adresse e-mail"), "mariama@exemple.com");
    type(screen.getByLabelText("Mot de passe"), "motdepasse1");
    type(screen.getByLabelText("Confirmer le mot de passe"), "motdepasse2");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    screen.getByText("Les deux mots de passe doivent être identiques.");
  });

  it("inscrit un candidat et ouvre son espace", async () => {
    const api = installFakeApi();
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un compte" })[0]);
    fillRegister({
      fullName: "Aïssatou Camara",
      email: "aissatou@exemple.com",
      password: "motdepasse-123",
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await settle();
    assert.equal(api.session?.role, "CANDIDATE");
    assert.equal(api.session?.email, "aissatou@exemple.com");
    // L'espace affiche la personne connectée, pas le compte de démonstration…
    screen.getByText("Bonjour, Aïssatou");
    screen.getAllByText("Aïssatou Camara");
    assert.equal(screen.queryByText("Bonjour, Mariama"), null);
    assert.equal(screen.queryByText("Mariama Diallo"), null);
    // …et aucune candidature fictive : elle n'en a encore envoyé aucune.
    assert.equal(statValue("Candidatures envoyées"), "0");
    assert.equal(screen.queryByText("Kamsar Solutions"), null);
  });

  it("inscrit une entreprise (en attente de validation) et ouvre son espace", async () => {
    const api = installFakeApi();
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un compte" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Entreprise" }));
    fillRegister({
      fullName: "Ibrahima Camara",
      company: "Labé Transport",
      email: "rh@labe-transport.example",
      password: "motdepasse-123",
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await settle();
    assert.equal(api.session?.role, "COMPANY");
    assert.equal(api.session?.company?.status, "PENDING");
    // Sa propre entreprise et son vrai statut, pas « Kamsar Solutions · Compte vérifié »…
    screen.getByText("Labé Transport · En attente de validation");
    assert.equal(screen.queryByText(/Kamsar Solutions/), null);
    // …et aucune offre ni candidature fictive de Kamsar.
    assert.equal(statValue("Offres actives"), "0");
    openTab("Mes offres");
    assert.equal(screen.queryByText("Assistant·e marketing digital"), null);
  });

  it("affiche l'erreur de l'API si l'e-mail est déjà utilisé", async () => {
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un compte" })[0]);
    fillRegister({
      fullName: "Mariama",
      email: FAKE_USERS.CANDIDATE.email,
      password: "motdepasse-123",
    });
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await settle();
    assert.match(screen.getByRole("alert").textContent ?? "", /existe déjà/);
  });

  it("la connexion mène à l'espace du rôle renvoyé par le serveur", async () => {
    await renderApp();
    await loginWithForm("COMPANY");
    screen.getByText("Kamsar Solutions · Compte vérifié");
  });

  it("refuse des identifiants invalides avec un message clair", async () => {
    await renderApp();
    await loginWithForm("CANDIDATE", "mauvais-mot-de-passe");
    assert.equal(screen.getByRole("alert").textContent, "E-mail ou mot de passe incorrect.");
    screen.getByRole("heading", { level: 2, name: "Connexion" });
  });

  it("envoie l'en-tête CSRF, les cookies et « Se souvenir de moi »", async () => {
    const api = installFakeApi();
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Se connecter" })[0]);
    type(screen.getByLabelText("Adresse e-mail"), FAKE_USERS.ADMIN.email);
    type(screen.getByLabelText("Mot de passe"), TEST_PASSWORD);
    fireEvent.click(screen.getByLabelText("Se souvenir de moi"));
    fireEvent.click(screen.getByRole("button", { name: /^Se connecter/ }));
    await settle();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).endsWith("/auth/login")) as [string, RequestInit];
    assert.equal(call[1].credentials, "include");
    assert.equal((call[1].headers as Record<string, string>)["X-ProAvenir-CSRF"], "1");
    assert.deepEqual(JSON.parse(String(call[1].body)), {
      email: FAKE_USERS.ADMIN.email,
      password: TEST_PASSWORD,
      rememberMe: true,
    });
    assert.equal(api.session?.role, "ADMIN");
    screen.getAllByText("Entreprises à vérifier");
  });

  it("ne stocke aucun jeton dans localStorage ni sessionStorage", async () => {
    await renderApp();
    await loginWithForm("CANDIDATE");
    assert.equal(localStorage.length, 0);
    assert.equal(sessionStorage.length, 0);
  });

  it("restaure la session après un rechargement de la page (F5)", async () => {
    const api = installFakeApi();
    const { unmount } = await renderApp();
    await loginWithForm("CANDIDATE");
    unmount(); // fermeture de la page : la mémoire (jeton d'accès) est perdue…
    await renderApp(); // …mais le cookie de session restaure la connexion
    assert.ok(api.session);
    await goTo("Espace candidat");
    screen.getByText("Bonjour, Mariama");
  });

  it("protège les espaces : sans session, redirection vers la connexion", async () => {
    for (const space of ["Espace candidat", "Espace entreprise", "Administration"] as const) {
      const { unmount } = await renderApp();
      await goTo(space);
      screen.getByRole("heading", { level: 2, name: "Connexion" });
      assert.equal(screen.queryByText("Bonjour, Mariama"), null);
      assert.equal(screen.queryByText("Entreprises à vérifier"), null);
      unmount();
    }
  });

  it("protège les espaces par rôle : un candidat ne voit ni l'administration ni l'entreprise", async () => {
    await renderApp({ as: "CANDIDATE" });
    await goTo("Administration");
    assert.equal(screen.queryByText("Entreprises à vérifier"), null);
    screen.getByText("Bonjour, Mariama"); // renvoyé vers son propre espace
    await goTo("Espace entreprise");
    assert.equal(screen.queryByText("Kamsar Solutions · Compte vérifié"), null);
    screen.getByText("Bonjour, Mariama");
  });

  it("la déconnexion révoque la session côté serveur", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await goTo("Espace entreprise");
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await settle();
    assert.equal(api.session, null);
    await goTo("Espace entreprise");
    screen.getByRole("heading", { level: 2, name: "Connexion" });
  });

  it("« Mot de passe oublié » indique honnêtement que ce n'est pas disponible", async () => {
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Se connecter" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    screen.getByText(/pas encore disponible\. Aucun e-mail n’a\s+été envoyé/);
  });

  it("l'accès rapide de démonstration préremplit l'e-mail sans contourner la connexion", async () => {
    const api = installFakeApi();
    await renderApp();
    fireEvent.click(screen.getAllByRole("button", { name: "Se connecter" })[0]);
    const demo = within(document.querySelector(".demo-access") as HTMLElement);
    fireEvent.click(demo.getByRole("button", { name: "Admin" }));
    await settle();
    // Toujours sur la page de connexion, sans session :
    screen.getByRole("heading", { level: 2, name: "Connexion" });
    assert.equal(api.session, null);
    assert.equal(
      (screen.getByLabelText("Adresse e-mail") as HTMLInputElement).value,
      FAKE_USERS.ADMIN.email,
    );
    screen.getByText(/saisissez son mot de passe/);
  });
});

describe("Administration", () => {
  setupAppTest();

  it("approuver une entreprise met à jour le compteur", async () => {
    await renderApp({ as: "ADMIN" });
    await goTo("Administration");
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

  it("la navigation principale de l'en-tête mène aux bonnes pages", async () => {
    await renderApp({ as: "COMPANY" });
    const nav = within(document.querySelector("header nav") as HTMLElement);
    fireEvent.click(nav.getByRole("button", { name: "Offres" }));
    assert.equal(await offersCount(), "6 offres disponibles");

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
    await settle();
    screen.getByText("Kamsar Solutions · Compte vérifié");
  });

  it("le logo ramène à l'accueil", async () => {
    await renderApp();
    await goTo("Offres");
    assert.equal(isHome(), false);
    fireEvent.click(header().getByRole("button", { name: "Retour à l'accueil" }));
    assert.equal(isHome(), true);
  });

  it("le menu mobile s'ouvre et se referme", async () => {
    await renderApp();
    assert.equal(header().queryByRole("button", { name: "Espace candidat" }), null);
    fireEvent.click(header().getByRole("button", { name: "Ouvrir le menu" }));
    header().getByRole("button", { name: "Espace candidat" });
    fireEvent.click(header().getByRole("button", { name: "Ouvrir le menu" }));
    assert.equal(header().queryByRole("button", { name: "Espace candidat" }), null);
  });

  it("le pied de page mène à la liste des offres", async () => {
    await renderApp();
    const footer = within(document.querySelector("footer") as HTMLElement);
    fireEvent.click(footer.getByRole("button", { name: "Toutes les offres" }));
    assert.equal(await offersCount(), "6 offres disponibles");
  });

  it("« Découvrir les offres » et « Déconnexion » quittent l'espace candidat", async () => {
    await renderApp({ as: "CANDIDATE" });
    await goTo("Espace candidat");
    openTab("Découvrir les offres");
    assert.equal(await offersCount(), "6 offres disponibles");

    await goTo("Espace candidat");
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await settle();
    assert.equal(isHome(), true);
    // Session fermée : l'espace n'est plus accessible.
    await goTo("Espace candidat");
    screen.getByRole("heading", { level: 2, name: "Connexion" });
  });
});
