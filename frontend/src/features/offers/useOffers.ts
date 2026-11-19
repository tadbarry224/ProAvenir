/**
 * Offres de l'ESPACE ENTREPRISE, lues et modifiées via l'API (PostgreSQL) :
 *   GET   /api/companies/me/offers              (liste + date du jour + statut de l'entreprise)
 *   POST  /api/companies/me/offers              (brouillon ou publication)
 *   PATCH /api/companies/me/offers/:id/status   (publier, clôturer, rouvrir)
 *
 * - L'entreprise est celle de la SESSION : aucun identifiant d'entreprise n'est
 *   choisi ni envoyé par le navigateur.
 * - Les données sont propres à l'utilisateur connecté : si le compte change, la
 *   liste précédente est effacée avant tout nouvel affichage (aucune fuite).
 * - Après une création ou un changement de statut réussi, la liste est relue
 *   (compteurs à jour) sans revenir à l'écran de chargement, et `onChanged`
 *   permet de rafraîchir la liste publique.
 * - Une erreur n'est jamais remplacée par des données fictives.
 * - Les règles sont appliquées par le serveur ; l'interface se contente de ne pas
 *   proposer une action que le serveur refusera (statut de l'entreprise).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { AccessTokenSource } from "../../services/apiClient";
import {
  changeCompanyOfferStatus,
  createCompanyOffer,
  fetchCompanyOffers,
  type CompanyStatus,
  type CreationStatus,
} from "../../services/companyOffersService";
import { OFFER_CITIES, OFFER_DOMAINS, type Offer, type OfferInput } from "../../types/offer";
import { todayIsoDate } from "../../lib/dates";
import {
  companyOfferFromApi,
  offerErrorFromApi,
  toCreateOfferPayload,
  type OfferActionError,
} from "./companyOfferMapping";
import { nextStatus } from "./offerRules";
import { useReferenceLists } from "./usePublicOffers";

type LoadState =
  | { status: "idle" | "loading"; userId: string | null; error?: undefined }
  | { status: "error"; userId: string | null; error: string }
  | {
      status: "success";
      userId: string | null;
      offers: Offer[];
      today: string;
      companyStatus: CompanyStatus;
      rejectionReason: string | null;
      error?: undefined;
    };

export type CompanyOffersState = {
  /** "idle" : espace entreprise non affiché ; "loading" : premier chargement. */
  status: LoadState["status"];
  /** Message de l'échec du chargement (réseau, session, serveur). */
  error: string;
  offers: Offer[];
  /** Date du jour à Conakry renvoyée par l'API (date du navigateur avant le chargement). */
  today: string;
  /** Statut de l'entreprise selon l'API, null tant qu'il n'est pas connu. */
  companyStatus: CompanyStatus | null;
  /** Motif du refus de l.administration (entreprise refusée), sinon null. */
  rejectionReason: string | null;
  /** Villes et domaines proposés : ceux de l'API, dans l'ordre et avec les libellés actuels. */
  cityOptions: readonly string[];
  domainOptions: readonly string[];
  /** Opération en cours : "create", l'identifiant d'une offre, ou null. */
  pending: string | null;
  reload: () => void;
  /** null si l'offre a été créée, sinon l'erreur à afficher. */
  createOffer: (input: OfferInput, status: CreationStatus) => Promise<OfferActionError | null>;
  /** Publier / Clôturer / Réouvrir. null si le changement a réussi, sinon l'erreur. */
  changeOfferStatus: (offer: Offer) => Promise<OfferActionError | null>;
};

const BUSY: OfferActionError = {
  kind: "transition",
  message: "Une opération est déjà en cours. Patientez un instant.",
  fieldErrors: {},
};

export function useOffers({
  session,
  userId,
  enabled,
  onChanged,
  onSessionExpired,
}: {
  /** Session de \`useAuth()\` : jeton en mémoire, renouvelé si besoin. */
  session: AccessTokenSource;
  /** Utilisateur connecté : les données sont rattachées à cet identifiant. */
  userId: string | null;
  /** Faux tant que l'espace entreprise n'est pas affiché (aucune requête). */
  enabled: boolean;
  /** Appelé après chaque modification réussie (ex. rafraîchir la liste publique). */
  onChanged?: () => void;
  /** Appelé quand la session a expiré pendant une action. */
  onSessionExpired?: () => void;
}): CompanyOffersState {
  const [state, setState] = useState<LoadState>({ status: "idle", userId });
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  // La session (objet recréé à chaque rendu) est lue au moment de l'appel.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const references = useReferenceLists(enabled);

  useEffect(() => {
    if (!enabled || !userId) {
      setState({ status: "idle", userId });
      return;
    }
    // Même utilisateur et données déjà affichées : relecture silencieuse.
    // Autre utilisateur : on efface tout de suite l'ancienne liste.
    setState((current) =>
      current.status === "success" && current.userId === userId
        ? current
        : { status: "loading", userId },
    );
    const controller = new AbortController();
    fetchCompanyOffers(sessionRef.current, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setState({
          status: "success",
          userId,
          offers: result.offers.map(companyOfferFromApi),
          today: result.today,
          companyStatus: result.company.status,
          rejectionReason: result.company.rejectionReason ?? null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const failure = offerErrorFromApi(error);
        if (failure.kind === "session") onSessionExpired?.();
        setState({ status: "error", userId, error: failure.message });
      });
    return () => controller.abort();
    // `onSessionExpired` est une fonction recréée à chaque rendu : volontairement absente.
  }, [enabled, userId, attempt]);

  /** Exécute une modification : une seule à la fois, puis relecture de la liste. */
  const run = async (
    key: string,
    action: () => Promise<unknown>,
  ): Promise<OfferActionError | null> => {
    if (busy.current) return BUSY;
    busy.current = true;
    setPending(key);
    try {
      await action();
      setAttempt((n) => n + 1);
      onChanged?.();
      return null;
    } catch (error) {
      const failure = offerErrorFromApi(error);
      if (failure.kind === "session") onSessionExpired?.();
      return failure;
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const loaded = references.status === "success" ? references.data : null;
  const cityOptions = useMemo(
    () =>
      loaded ? OFFER_CITIES.filter((c) => loaded.cities.some((r) => r.name === c)) : OFFER_CITIES,
    [loaded],
  );
  const domainOptions = useMemo(
    () =>
      loaded
        ? OFFER_DOMAINS.filter((d) => loaded.domains.some((r) => r.name === d))
        : OFFER_DOMAINS,
    [loaded],
  );

  const success = state.status === "success" && state.userId === userId ? state : null;
  return {
    status: state.userId === userId ? state.status : "loading",
    error: state.status === "error" && state.userId === userId ? state.error : "",
    offers: success?.offers ?? [],
    today: success?.today ?? todayIsoDate(),
    companyStatus: success?.companyStatus ?? null,
    rejectionReason: success?.rejectionReason ?? null,
    cityOptions,
    domainOptions,
    pending,
    reload: () => setAttempt((n) => n + 1),
    createOffer: async (input, status) => {
      // Libellés du formulaire → identifiants de l'API (référentiels chargés).
      const built = toCreateOfferPayload(input, status, loaded ?? { cities: [], domains: [] });
      if (!built.ok) {
        return {
          kind: "validation",
          message: Object.values(built.errors)[0] ?? "",
          fieldErrors: built.errors,
        };
      }
      return run("create", () => createCompanyOffer(sessionRef.current, built.payload));
    },
    changeOfferStatus: (offer) =>
      run(offer.id, () =>
        changeCompanyOfferStatus(
          sessionRef.current,
          offer.id,
          nextStatus(offer.status) === "PUBLISHED" ? "PUBLISHED" : "CLOSED",
        ),
      ),
  };
}
