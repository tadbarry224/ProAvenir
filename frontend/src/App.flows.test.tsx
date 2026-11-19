// @vitest-environment jsdom
/**
 * Tests fonctionnels : ils reproduisent les parcours d'un utilisateur
 * (clics, saisies) à travers toute l'application. Les snapshots vérifient
 * l'apparence ; ces tests vérifient que les fonctionnalités marchent.
 */
import assert from "node:assert/strict";
import { act, fireEvent, screen, within } from "@testing-library/react";
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
import { FAKE_USERS, installFakeApi, TEST_PASSWORD, type FakeApi } from "./test/fakeApi";

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

  /** Ouvre le détail de l'offre « Développeur·se web junior » depuis la liste publique. */
  async function openJobDetails() {
    await goTo("Offres");
    fireEvent.click(screen.getByText("Développeur·se web junior"));
    screen.getByRole("heading", { level: 1, name: "Développeur·se web junior" });
  }

  it("permet à un candidat de consulter une offre et d'y postuler", async () => {
    await renderApp({ as: "CANDIDATE" });
    await openJobDetails();

    fireEvent.click(screen.getByRole("button", { name: "Postuler maintenant" }));
    // Aucun CV ni nom d'une autre personne : le CV est celui du profil connecté.
    screen.getByText("CV de votre profil");
    assert.equal(screen.queryByText(/CV_Mariama_Diallo/), null);
    screen.getByText(/la candidature n'est pas encore enregistrée/);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer ma candidature" }));
    screen.getByText("Candidature envoyée");
  });

  it("affiche le vrai contenu de l'offre, sans badge ni texte fictif", async () => {
    await renderApp();
    await openJobDetails();
    assert.equal(screen.queryByText("Donnée fictive"), null);
    assert.equal(screen.queryByRole("heading", { name: "Vos missions" }), null);
    assert.equal(screen.queryByRole("heading", { name: "Profil recherché" }), null);
  });

  it("demande à un visiteur de se connecter pour postuler", async () => {
    await renderApp();
    await openJobDetails();
    assert.equal(screen.queryByRole("button", { name: "Postuler maintenant" }), null);
    assert.equal(screen.queryByRole("button", { name: "Voir mon profil" }), null);

    fireEvent.click(screen.getByRole("button", { name: "Se connecter pour postuler" }));
    await settle();
    screen.getByLabelText("Adresse e-mail");
  });

  it("ne propose pas de postuler à une entreprise ni à un administrateur", async () => {
    for (const role of ["COMPANY", "ADMIN"] as const) {
      const { unmount } = await renderApp({ as: role });
      await openJobDetails();
      screen.getByText("Les candidatures sont réservées aux comptes candidats.");
      assert.equal(screen.queryByRole("button", { name: "Postuler maintenant" }), null);
      unmount();
    }
  });
});

describe("Offres de l'entreprise (API réelle)", () => {
  setupAppTest();

  const KAMSAR = FAKE_USERS.COMPANY.company!.id;
  const KAMSAR_OFFER = "Assistant·e marketing digital";
  const companyCalls = (api: FakeApi, method?: string) =>
    api.calls.filter(
      (call) => call.path.startsWith("/companies/me/offers") && (!method || call.method === method),
    );
  /** Ouvre l'onglet « Mes offres » de l'espace entreprise (déjà affiché). */
  async function myOffers() {
    openTab("Mes offres");
    await settle();
  }
  /** Bouton d'action (« Publier », « Clôturer », « Réouvrir ») d'une offre de la liste. */
  const offerButton = (title: string, name: string) => {
    const row = screen.getByText(title).closest(".p-5") as HTMLElement;
    return within(row).getByRole("button", { name }) as HTMLButtonElement;
  };
  const offerStatus = (title: string) =>
    (screen.getByText(title).closest(".p-5") as HTMLElement).querySelector(".status")?.textContent;

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

  it("charge les offres réelles de l'entreprise avec son jeton, sans identifiant d'entreprise", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "1");
    // Compteur RÉEL (PostgreSQL) : 2 candidatures sur l'offre de Kamsar.
    assert.equal(statValue("Candidatures reçues"), "2");
    assert.equal(statValue("À examiner"), "—");

    await myOffers();
    screen.getByText(KAMSAR_OFFER);
    screen.getByText(/^2 candidature\(s\)/);
    const [load] = companyCalls(api, "GET");
    assert.equal(load.path, "/companies/me/offers");
    assert.match(load.authorization ?? "", /^Bearer jeton-\d+$/);
    assert.ok(!api.requests.some((url) => url.search.includes("company")));
  });

  it("n'affiche que les offres de l'entreprise connectée", async () => {
    await renderApp({ as: "COMPANY" });
    await goTo("Espace entreprise");
    await myOffers();
    screen.getByText(KAMSAR_OFFER);
    assert.equal(screen.queryByText("Développeur·se web junior"), null);
  });

  it("enregistre un brouillon via l'API, invisible publiquement, conservé après F5", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    const { unmount } = await renderApp();
    await openPublishModal();
    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon secret");
    type(screen.getByLabelText("Ville"), "Labé");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));
    await settle();
    screen.getByText("Le brouillon a été enregistré dans vos offres.");
    assert.equal(offerStatus("Brouillon secret"), "Brouillon");

    // Corps envoyé : identifiants de l'API, jamais d'entreprise choisie par le navigateur.
    const [created] = companyCalls(api, "POST");
    assert.deepEqual(created.body, {
      status: "DRAFT",
      title: "Brouillon secret",
      type: "JOB",
      cityId: "labe",
      domainId: "marketing",
      description: "",
      deadline: null,
      skills: [],
    });
    assert.equal(api.companyOffers(KAMSAR).length, 2);

    await goTo("Offres");
    assert.equal(await offersCount(), "6 offres disponibles");
    assert.equal(screen.queryByText("Brouillon secret"), null);

    // F5 : la page est rechargée, les données viennent de nouveau de l'API.
    unmount();
    await renderApp();
    await goTo("Espace entreprise");
    await myOffers();
    assert.equal(offerStatus("Brouillon secret"), "Brouillon");
  });

  it("publie une offre : visible dans la liste publique, compteurs mis à jour", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await openPublishModal();
    fillCompleteOffer("Comptable junior");
    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    await settle();
    screen.getByText("Votre offre a été publiée avec succès.");
    assert.equal(offerStatus("Comptable junior"), "Active");
    assert.equal(companyCalls(api, "POST")[0].body.cityId, "kindia");

    await goTo("Offres");
    assert.equal(await offersCount(), "7 offres disponibles");
    screen.getByText("Comptable junior");

    await goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "2");
  });

  it("clôture puis rouvre une offre : liste publique et compteur synchronisés", async () => {
    await renderApp({ as: "COMPANY" });
    await goTo("Espace entreprise");
    await myOffers();
    fireEvent.click(offerButton(KAMSAR_OFFER, "Clôturer"));
    await settle();
    assert.equal(offerStatus(KAMSAR_OFFER), "Clôturée");

    await goTo("Offres");
    assert.equal(await offersCount(), "5 offres disponibles");
    assert.equal(screen.queryByText(KAMSAR_OFFER), null);

    await goTo("Espace entreprise");
    assert.equal(statValue("Offres actives"), "0");
    await myOffers();
    fireEvent.click(offerButton(KAMSAR_OFFER, "Réouvrir"));
    await settle();
    assert.equal(offerStatus(KAMSAR_OFFER), "Active");

    await goTo("Offres");
    assert.equal(await offersCount(), "6 offres disponibles");
    screen.getByText(KAMSAR_OFFER);
  });

  it("refuse de publier un brouillon incomplet (409) avec un message clair", async () => {
    await renderApp({ as: "COMPANY" });
    await openPublishModal();
    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon incomplet");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));
    await settle();

    fireEvent.click(offerButton("Brouillon incomplet", "Publier"));
    await settle();
    const alert = screen.getByRole("alert").textContent ?? "";
    assert.match(alert, /« Brouillon incomplet » ne peut pas être publiée/);
    assert.match(alert, /La date limite est obligatoire pour publier/);
    assert.equal(offerStatus("Brouillon incomplet"), "Brouillon");
  });

  it("entreprise en attente : brouillon possible, publication et réouverture impossibles", async () => {
    const api = installFakeApi({ session: "COMPANY", companyStatus: "PENDING" });
    await renderApp();
    await openPublishModal();
    const publishButton = screen.getByRole("button", { name: /Publier l.offre/ });
    assert.equal((publishButton as HTMLButtonElement).disabled, true);
    screen.getByText(/en attente de validation : vous pouvez enregistrer un brouillon/);

    type(screen.getByPlaceholderText("Ex. Assistant·e administratif·ve"), "Brouillon en attente");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer en brouillon" }));
    await settle();
    screen.getByText("Le brouillon a été enregistré dans vos offres.");
    assert.equal(offerButton("Brouillon en attente", "Publier").disabled, true);
    // Clôturer une offre existante reste possible.
    assert.equal(offerButton(KAMSAR_OFFER, "Clôturer").disabled, false);
    assert.equal(companyCalls(api, "PATCH").length, 0);
  });

  it("entreprise refusée : lecture seule, aucune création ni modification", async () => {
    const api = installFakeApi({ session: "COMPANY", companyStatus: "REJECTED" });
    await renderApp();
    await goTo("Espace entreprise");
    fireEvent.click(screen.getAllByRole("button", { name: "Publier une offre" })[0]);
    assert.match(screen.getByRole("alert").textContent ?? "", /refusée par l’administration/);
    assert.equal(screen.queryByRole("button", { name: /Publier l.offre/ }), null);

    await myOffers();
    assert.equal(offerButton(KAMSAR_OFFER, "Clôturer").disabled, true);
    assert.equal(companyCalls(api, "POST").length + companyCalls(api, "PATCH").length, 0);
  });

  it("affiche sous le champ concerné une erreur de validation du serveur (400)", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await openPublishModal();
    fillCompleteOffer("Offre refusée");
    api.failNext("POST", "/companies/me/offers", {
      status: 400,
      body: {
        statusCode: 400,
        code: "VALIDATION_FAILED",
        message: ["La date limite ne peut pas être dans le passé."],
        details: [{ field: "deadline", message: "La date limite ne peut pas être dans le passé." }],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    await settle();
    // La fenêtre reste ouverte, l'erreur est sous « Date limite ».
    // Le libellé contient maintenant aussi le message d'erreur : recherche par son début.
    const deadline = screen.getByLabelText(/^Date limite/);
    assert.equal(deadline.getAttribute("aria-invalid"), "true");
    screen.getByText("La date limite ne peut pas être dans le passé.");
    assert.equal(screen.queryByText("Votre offre a été publiée avec succès."), null);
  });

  it("affiche dans la fenêtre un refus de droits du serveur (403)", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await openPublishModal();
    fillCompleteOffer("Offre interdite");
    api.failNext("POST", "/companies/me/offers", {
      status: 403,
      body: {
        statusCode: 403,
        code: "COMPANY_NOT_APPROVED",
        message:
          "Votre entreprise doit être validée par l’administration avant de publier une offre.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publier l.offre/ }));
    await settle();
    assert.match(screen.getByRole("alert").textContent ?? "", /doit être validée/);
  });

  it.each([
    [404, "OFFER_NOT_FOUND", "Offre introuvable."],
    [409, "INVALID_STATUS_TRANSITION", "Cette offre est déjà clôturée."],
  ])(
    "affiche une erreur %i (%s) sur une action, sans changer l'affichage",
    async (status, code, message) => {
      const api = installFakeApi({ session: "COMPANY" });
      await renderApp();
      await goTo("Espace entreprise");
      await myOffers();
      api.failNext("PATCH", "/companies/me/offers/", {
        status,
        body: { statusCode: status, code, message },
      });
      fireEvent.click(offerButton(KAMSAR_OFFER, "Clôturer"));
      await settle();
      assert.equal(screen.getByRole("alert").textContent, message);
      assert.equal(offerStatus(KAMSAR_OFFER), "Active");
    },
  );

  it("session expirée (401) : retour à la connexion avec un message clair", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await goTo("Espace entreprise");
    await myOffers();
    api.revokeSession(); // la session a expiré côté serveur
    fireEvent.click(offerButton(KAMSAR_OFFER, "Clôturer"));
    await settle();
    screen.getByRole("heading", { level: 2, name: "Connexion" });
    screen.getByText("Votre session a expiré. Reconnectez-vous pour continuer.");
    assert.equal(api.companyOffers(KAMSAR)[0].status, "PUBLISHED");
  });

  it("affiche le chargement, puis une erreur réseau, puis recharge avec « Réessayer »", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    api.failNext("GET", "/companies/me/offers", "network");
    const header = within(document.querySelector("header") as HTMLElement);
    fireEvent.click(header.getByRole("button", { name: "Ouvrir le menu" }));
    const buttons = header.getAllByRole("button", { name: "Espace entreprise" });
    fireEvent.click(buttons[buttons.length - 1]);
    openTab("Mes offres");
    // Avant la réponse du serveur :
    screen.getByText("Chargement de vos offres…");
    assert.equal(statValueOrNull("Offres actives"), null);
    await settle();
    assert.match(screen.getByRole("alert").textContent ?? "", /Impossible de joindre le serveur/);
    // Aucune offre fictive à la place de l'erreur.
    assert.equal(screen.queryByText(KAMSAR_OFFER), null);

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await settle();
    screen.getByText(KAMSAR_OFFER);
  });

  it("un double clic n'envoie qu'une seule création", async () => {
    const api = installFakeApi({ session: "COMPANY" });
    await renderApp();
    await openPublishModal();
    fillCompleteOffer("Offre unique");
    const publishButton = screen.getByRole("button", { name: /Publier l.offre/ });
    fireEvent.click(publishButton);
    fireEvent.click(publishButton);
    await settle();
    assert.equal(companyCalls(api, "POST").length, 1);
    assert.equal(api.companyOffers(KAMSAR).length, 2);
  });

  it("aucune fuite entre entreprises : un autre compte ne voit jamais les offres de Kamsar", async () => {
    const api = installFakeApi();
    await renderApp();
    await loginWithForm("COMPANY");
    await myOffers();
    screen.getByText(KAMSAR_OFFER);
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await settle();

    // Nouvelle entreprise (en attente) : liste vide, sans aucune offre de Kamsar.
    fireEvent.click(screen.getAllByRole("button", { name: "Créer un compte" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Entreprise" }));
    type(screen.getByLabelText("Nom complet"), "Ibrahima Camara");
    type(screen.getByLabelText("Nom de l’entreprise"), "Labé Transport");
    type(screen.getByLabelText("Adresse e-mail"), "rh@labe-transport.example");
    type(screen.getByLabelText("Mot de passe"), "motdepasse-123");
    type(screen.getByLabelText("Confirmer le mot de passe"), "motdepasse-123");
    fireEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
    await settle();
    await myOffers();
    screen.getByText("Vous n’avez encore publié aucune offre.");
    assert.equal(screen.queryByText(KAMSAR_OFFER), null);
    assert.equal(statValueOrNull("Offres actives"), null); // onglet « Mes offres » affiché
    // Aucun appel n'a jamais transmis d'identifiant d'entreprise.
    assert.ok(companyCalls(api).every((call) => !("companyId" in call.body)));
  });
});

/** Valeur d'une carte de statistique, ou null si elle n'est pas affichée. */
function statValueOrNull(label: string) {
  try {
    const value = statValue(label);
    return value === "…" ? null : value;
  } catch {
    return null;
  }
}

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
      window.history.replaceState(null, "", "/"); // chaque tour repart de l'accueil
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

  const HOROYA = "20000000-0000-4000-8000-000000000007"; // « Horoya Conseil », en attente
  const reviewCalls = (api: FakeApi) =>
    api.calls.filter((call) => call.method === "PATCH" && call.path.startsWith("/admin/"));
  /** Ligne d'une entreprise dans la liste (pour cliquer sur SES boutons). */
  const companyRow = (name: string) =>
    within(screen.getByText(name).closest(".p-5") as HTMLElement);

  it("affiche les vraies entreprises en attente ; approuver met à jour le compteur", async () => {
    const api = installFakeApi({ session: "ADMIN" });
    await renderApp();
    await goTo("Administration");
    assert.equal(statValue("Entreprises à vérifier"), "3");
    screen.getByText("Horoya Conseil");
    screen.getByText("Conseil · Conakry · 15 déc. 2026");

    fireEvent.click(companyRow("Horoya Conseil").getByRole("button", { name: "Approuver" }));
    await settle();
    assert.equal(statValue("Entreprises à vérifier"), "2");
    // L'API a reçu la décision, avec le jeton de l'administrateur.
    const [call] = reviewCalls(api);
    assert.equal(call.path, `/admin/companies/${HOROYA}/status`);
    assert.deepEqual(call.body, { status: "APPROVED" });
    assert.match(call.authorization ?? "", /^Bearer /);
    // Vue générale : seulement les entreprises en attente.
    assert.equal(screen.queryByText("Horoya Conseil"), null);

    openTab("Entreprises");
    within(screen.getByText("Horoya Conseil").closest(".p-5") as HTMLElement).getByText(
      "Approuvée",
    );
  });

  it("refuser exige un motif, montré ensuite avec l'entreprise", async () => {
    const api = installFakeApi({ session: "ADMIN" });
    await renderApp();
    await goTo("Administration");
    openTab("Entreprises");
    fireEvent.click(companyRow("Horoya Conseil").getByRole("button", { name: "Refuser" }));
    const confirm = () =>
      screen.getByRole<HTMLButtonElement>("button", { name: "Confirmer le refus" });
    assert.equal(confirm().disabled, true);
    type(screen.getByLabelText("Motif du refus"), "abc");
    assert.equal(confirm().disabled, true); // 5 caractères minimum
    type(screen.getByLabelText("Motif du refus"), "Numéro RCCM manquant");
    assert.equal(confirm().disabled, false);

    fireEvent.click(confirm());
    await settle();
    assert.deepEqual(reviewCalls(api)[0].body, {
      status: "REJECTED",
      reason: "Numéro RCCM manquant",
    });
    screen.getByText("Motif : Numéro RCCM manquant");
    companyRow("Horoya Conseil").getByText("Refusée");
    assert.equal(api.adminCompanies().find((c) => c.id === HOROYA)?.status, "REJECTED");
  });

  it("une entreprise déjà vérifiée ne propose plus de décision", async () => {
    await renderApp({ as: "ADMIN" });
    await goTo("Administration");
    openTab("Entreprises");
    const kamsar = companyRow("Kamsar Solutions");
    kamsar.getByText("Approuvée");
    assert.equal(kamsar.queryByRole("button", { name: "Approuver" }), null);
    assert.equal(kamsar.queryByRole("button", { name: "Refuser" }), null);
  });

  it("une décision déjà prise ailleurs affiche l'erreur et relit la liste", async () => {
    const api = installFakeApi({ session: "ADMIN" });
    await renderApp();
    await goTo("Administration");
    // Un autre administrateur vient d'approuver Horoya Conseil.
    api.adminCompanies().find((c) => c.id === HOROYA)!.status = "APPROVED";
    fireEvent.click(companyRow("Horoya Conseil").getByRole("button", { name: "Approuver" }));
    await settle();
    // Erreur affichée puis liste relue : Horoya n'est plus « en attente ».
    assert.equal(statValue("Entreprises à vérifier"), "2");
    assert.equal(screen.queryByText("Horoya Conseil"), null);
    openTab("Entreprises");
    companyRow("Horoya Conseil").getByText("Approuvée");
  });

  it("affiche l'erreur du serveur sur l'entreprise concernée", async () => {
    const api = installFakeApi({ session: "ADMIN" });
    await renderApp();
    await goTo("Administration");
    api.failNext("PATCH", "/admin/companies", 500);
    fireEvent.click(companyRow("Horoya Conseil").getByRole("button", { name: "Approuver" }));
    await settle();
    assert.match(companyRow("Horoya Conseil").getByRole("alert").textContent ?? "", /\S/);
    assert.equal(statValue("Entreprises à vérifier"), "3");
  });

  it("un échec du chargement propose « Réessayer »", async () => {
    const api = installFakeApi({ session: "ADMIN" });
    api.failNext("GET", "/admin/companies", 500);
    await renderApp();
    await goTo("Administration");
    screen.getByRole("heading", { name: "Impossible de charger les entreprises" });
    assert.equal(statValue("Entreprises à vérifier"), "–");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await settle();
    screen.getByText("Horoya Conseil");
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

describe("Adresses des pages (React Router)", () => {
  setupAppTest();

  const DEV_JOB_ID = "30000000-0000-4000-8000-000000000002"; // « Développeur·se web junior »
  const path = () => window.location.pathname;
  /** Ouvre l'application directement à une adresse (lien partagé, favori, F5). */
  const openAt = async (url: string, as?: "CANDIDATE" | "COMPANY" | "ADMIN") => {
    window.history.replaceState(null, "", url);
    return renderApp(as ? { as } : {});
  };
  /** Bouton « Retour » du navigateur. */
  const browserBack = async () => {
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    });
    await settle();
  };

  it("chaque page a sa propre adresse", async () => {
    await renderApp();
    assert.equal(path(), "/");
    await goTo("Offres");
    assert.equal(path(), "/offres");
    fireEvent.click(screen.getByText("Développeur·se web junior"));
    await settle();
    assert.equal(path(), `/offres/${DEV_JOB_ID}`);
  });

  it("un lien partagé ouvre directement l'offre, lue sur le serveur", async () => {
    const api = installFakeApi();
    await openAt(`/offres/${DEV_JOB_ID}`);
    screen.getByRole("heading", { level: 1, name: "Développeur·se web junior" });
    assert.ok(api.calls.some((call) => call.path === `/offers/${DEV_JOB_ID}`));
  });

  it("une offre inconnue ou une adresse mal formée affiche « Offre introuvable »", async () => {
    for (const url of ["/offres/30000000-0000-4000-8000-000000000999", "/offres/abc"]) {
      const { unmount } = await openAt(url);
      screen.getByRole("heading", { name: "Offre introuvable" });
      fireEvent.click(screen.getByRole("button", { name: "Voir les offres disponibles" }));
      await settle();
      assert.equal(path(), "/offres");
      unmount();
    }
  });

  it("une erreur du serveur propose « Réessayer »", async () => {
    const api = installFakeApi();
    api.failNext("GET", "/offers/", 500);
    await openAt(`/offres/${DEV_JOB_ID}`);
    screen.getByRole("heading", { name: "Impossible de charger l’offre" });
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await settle();
    screen.getByRole("heading", { level: 1, name: "Développeur·se web junior" });
  });

  it("le bouton « Retour » du navigateur revient à la page précédente", async () => {
    await renderApp();
    await goTo("Offres");
    fireEvent.click(screen.getByText("Développeur·se web junior"));
    await settle();
    await browserBack();
    assert.equal(path(), "/offres");
    assert.equal(await offersCount(), "6 offres disponibles");
  });

  it("F5 dans un espace garde la même page", async () => {
    await openAt("/espace-entreprise", "COMPANY");
    screen.getByText("Kamsar Solutions · Compte vérifié");
    assert.equal(path(), "/espace-entreprise");
  });

  it("une adresse inconnue renvoie à l'accueil", async () => {
    await openAt("/page-qui-n-existe-pas");
    assert.equal(path(), "/");
  });

  it("après la connexion, le visiteur revient sur l'offre qu'il voulait", async () => {
    await openAt(`/offres/${DEV_JOB_ID}`);
    fireEvent.click(screen.getByRole("button", { name: "Se connecter pour postuler" }));
    await settle();
    assert.equal(path(), "/connexion");
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), {
      target: { value: FAKE_USERS.CANDIDATE.email },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: TEST_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: /^Se connecter/ }));
    await settle();
    assert.equal(path(), `/offres/${DEV_JOB_ID}`);
    screen.getByRole("button", { name: "Postuler maintenant" });
  });

  it("un espace protégé ouvert sans session y revient après la connexion", async () => {
    await openAt("/espace-entreprise");
    assert.equal(path(), "/connexion");
    fireEvent.change(screen.getByLabelText("Adresse e-mail"), {
      target: { value: FAKE_USERS.COMPANY.email },
    });
    fireEvent.change(screen.getByLabelText("Mot de passe"), { target: { value: TEST_PASSWORD } });
    fireEvent.click(screen.getByRole("button", { name: /^Se connecter/ }));
    await settle();
    assert.equal(path(), "/espace-entreprise");
    screen.getByText("Kamsar Solutions · Compte vérifié");
  });
});

describe("Statut de l'entreprise (vu par l'entreprise)", () => {
  setupAppTest();

  const PENDING_BANNER = /Votre entreprise est en attente de validation\./;
  const REJECTED_BANNER = /Votre entreprise a été refusée par l’administration\./;

  it("en attente : un bandeau explique qu'on peut préparer des brouillons", async () => {
    installFakeApi({ session: "COMPANY", companyStatus: "PENDING" });
    await renderApp();
    await goTo("Espace entreprise");
    screen.getByText(PENDING_BANNER);
    screen.getByText("Kamsar Solutions · En attente de validation");
  });

  it("refusée : le motif de l'administration est affiché", async () => {
    installFakeApi({
      session: "COMPANY",
      companyStatus: "REJECTED",
      rejectionReason: "Numéro RCCM manquant.",
    });
    await renderApp();
    await goTo("Espace entreprise");
    screen.getByText(REJECTED_BANNER);
    screen.getByText("Motif : Numéro RCCM manquant.");
  });

  it("validée : aucun bandeau", async () => {
    await renderApp({ as: "COMPANY" });
    await goTo("Espace entreprise");
    assert.equal(screen.queryByText(PENDING_BANNER), null);
    assert.equal(screen.queryByText(REJECTED_BANNER), null);
  });

  it("une validation pendant la session s'affiche à la réouverture de l'espace", async () => {
    const api = installFakeApi({ session: "COMPANY", companyStatus: "PENDING" });
    await renderApp();
    await goTo("Espace entreprise");
    screen.getByText("Kamsar Solutions · En attente de validation");

    api.setCompanyStatus("APPROVED"); // l'administration valide l'entreprise
    await goTo("Offres");
    await goTo("Espace entreprise");
    // La session date de la connexion (« en attente »), mais l'API dit « validée ».
    screen.getByText("Kamsar Solutions · Compte vérifié");
    assert.equal(screen.queryByText(PENDING_BANNER), null);
  });
});
