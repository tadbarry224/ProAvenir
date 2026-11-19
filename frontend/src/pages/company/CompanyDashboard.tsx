import { useState } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  FileCheck2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  OFFER_DISPLAY_STATUS_LABELS,
  type Company,
  type Offer,
  type OfferInput,
} from "../../types/offer";
import type { Page } from "../../types/navigation";
import type { DashboardIdentity } from "../../types/auth";
import type { CreationStatus } from "../../services/companyOffersService";
import {
  creationBlockedReason,
  getDisplayStatus,
  publicationBlockedReason,
  statusActionBlockedReason,
} from "../../features/offers/offerRules";
import type { CompanyOffersState } from "../../features/offers/useOffers";
import { COMPANY_STATUS_LABELS, initialsOfName } from "../../features/auth/identity";
import type { OfferActionError } from "../../features/offers/companyOfferMapping";
import { toJobView } from "../../features/offers/toJobView";
import { formatShortDate } from "../../lib/dates";
import { StatCard } from "../../components/ui/StatCard";
import { CardHeading } from "../../components/ui/CardHeading";
import { JobLogo } from "../../components/jobs/JobLogo";
import { DashboardLayout } from "../../components/layout/DashboardLayout";
import { DashboardTop } from "../../components/layout/DashboardTop";
import { offerStatusStyle } from "../../features/offers/offerStatusStyle";
import { RecruitTable } from "../../features/applications/RecruitTable";
import type { ReceivedApplicationsState } from "../../features/applications/useApplications";
import type { ApplicationStatusTarget } from "../../services/applicationsService";
import { PublishModal } from "../../features/offers/PublishModal";
import { CompanyProfile } from "./CompanyProfile";

/** Message à afficher pour une action refusée sur une offre. */
function actionErrorMessage(offer: Offer, error: OfferActionError): string {
  return error.kind === "notPublishable"
    ? `« ${offer.title} » ne peut pas être publiée : ${error.message}`
    : error.message;
}

export function CompanyDashboard({
  go,
  logoColor,
  identity: sessionIdentity,
  companyOffers,
  applications: received,
  onProfileSaved,
}: {
  go: (p: Page) => void;
  logoColor: Company["logoColor"];
  /** Entreprise connectée (nom, statut de validation) issue de la session. */
  identity: DashboardIdentity;
  /** Offres RÉELLES de l'entreprise connectée (API), actions et états de chargement. */
  companyOffers: CompanyOffersState;
  /** Candidatures de démonstration (fictives jusqu'à B5). */
  applications: ReceivedApplicationsState;
  onProfileSaved: () => void;
}) {
  const {
    offers,
    today,
    status: offersStatus,
    companyStatus,
    companyName,
    pending,
  } = companyOffers;
  // Statut relu par l'API à chaque ouverture de l'espace : il remplace celui de la
  // session, qui peut dater de la connexion (ex. entreprise approuvée depuis).
  const identity = companyStatus
    ? {
        ...sessionIdentity,
        name: companyName ?? sessionIdentity.name,
        initials: companyName ? initialsOfName(companyName) : sessionIdentity.initials,
        statusLabel: COMPANY_STATUS_LABELS[companyStatus],
      }
    : sessionIdentity;
  const [active, setActive] = useState("Aperçu");
  const [publish, setPublish] = useState(false);
  const [published, setPublished] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  // Message affiché quand une action est refusée (offre incomplète ou expirée, droits, réseau…).
  const [statusError, setStatusError] = useState("");
  const showApplications = active === "Candidatures";
  const loaded = offersStatus === "success";
  // « Offres actives » = offres réellement visibles par le public (règle du serveur).
  const activeOffersCount = offers.filter((offer) => offer.publiclyVisible).length;
  // Nombre RÉEL de candidatures reçues sur l'ensemble des offres (PostgreSQL).
  const receivedApplications = offers.reduce(
    (total, offer) => total + (offer.applicationsCount ?? 0),
    0,
  );

  const resetMessages = () => {
    setPublished(false);
    setDraftSaved(false);
    setStatusError("");
  };

  /** Bouton « Publier une offre » : une entreprise refusée ne peut pas créer d'offre. */
  const openPublish = () => {
    const blocked = creationBlockedReason(companyStatus);
    resetMessages();
    if (blocked) setStatusError(blocked);
    else setPublish(true);
  };

  /** Envoie l'offre de la modale ; en cas d'échec, l'erreur est affichée dans la modale. */
  const addOffer = async (input: OfferInput, status: CreationStatus) => {
    const failure = await companyOffers.createOffer(input, status);
    if (failure) return failure;
    setPublish(false);
    resetMessages();
    setPublished(status === "PUBLISHED");
    setDraftSaved(status === "DRAFT");
    setActive("Mes offres");
    return null;
  };

  /** Bouton « Publier / Clôturer / Réouvrir » : la règle est appliquée par le serveur. */
  const changeOfferStatus = async (offer: Offer) => {
    resetMessages();
    const failure = await companyOffers.changeOfferStatus(offer);
    if (failure) setStatusError(actionErrorMessage(offer, failure));
  };

  /** Le statut d'une candidature a changé : en cas de refus du serveur, on l'affiche. */
  const updateApplicationStatus = async (id: string, status: ApplicationStatusTarget) => {
    resetMessages();
    const failure = await received.changeStatus(id, status);
    if (failure) setStatusError(failure.message);
  };

  /** Candidatures reçues (les `limit` plus récentes), ou l'état du chargement. */
  const applicationsList = (limit?: number) => {
    if (received.status === "error") {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm">
          <span className="text-red-700">{received.error}</span>
          <button onClick={received.reload} className="btn-secondary px-3 py-1.5 text-xs">
            Réessayer
          </button>
        </div>
      );
    }
    if (received.status !== "success") {
      return <p className="p-5 text-sm text-slate-400">Chargement des candidatures…</p>;
    }
    if (received.applications.length === 0) {
      return <p className="p-5 text-sm text-slate-500">Aucune candidature reçue pour le moment.</p>;
    }
    return (
      <RecruitTable
        items={received.applications.slice(0, limit)}
        updateStatus={updateApplicationStatus}
        pending={received.pending}
        readOnly={companyStatus === "REJECTED"}
        onDownloadCv={(id, fileName) => {
          resetMessages();
          void received.downloadCv(id, fileName).then((failure) => {
            if (failure) setStatusError(failure.message);
          });
        }}
      />
    );
  };

  /** Valeur d'une carte de statistique : « … » tant que les offres ne sont pas chargées. */
  const stat = (value: number) => (loaded ? String(value) : "…");

  return (
    <DashboardLayout
      area="company"
      identity={identity}
      go={go}
      active={active}
      setActive={setActive}
    >
      <DashboardTop
        title={active === "Aperçu" ? "Espace entreprise" : active}
        subtitle={`${identity.name} · ${identity.statusLabel}`}
        action="Publier une offre"
        onAction={openPublish}
        avatar={identity.initials}
      />
      <div className="dashboard-content">
        {companyStatus === "PENDING" && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
            <ShieldCheck size={19} className="mt-0.5 shrink-0" />
            <p>
              <b>Votre entreprise est en attente de validation.</b> Vous pouvez déjà préparer vos
              offres en brouillon : vous pourrez les publier dès que l’administration aura validé
              votre entreprise.
            </p>
          </div>
        )}
        {companyStatus === "REJECTED" && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
            <ShieldCheck size={19} className="mt-0.5 shrink-0" />
            <div>
              <p>
                <b>Votre entreprise a été refusée par l’administration.</b> Vos offres restent
                consultables mais ne peuvent plus être publiées.
              </p>
              {companyOffers.rejectionReason && (
                <p className="mt-1">Motif : {companyOffers.rejectionReason}</p>
              )}
            </div>
          </div>
        )}
        {published && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={19} />
            Votre offre a été publiée avec succès.
          </div>
        )}
        {draftSaved && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
            <FileCheck2 size={19} />
            Le brouillon a été enregistré dans vos offres.
          </div>
        )}
        {statusError && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
          >
            <FileCheck2 size={19} className="shrink-0" />
            {statusError}
          </div>
        )}
        {active === "Aperçu" && (
          <>
            <div className="stats-grid">
              <StatCard
                icon={BriefcaseBusiness}
                value={stat(activeOffersCount)}
                label="Offres actives"
                tone="blue"
              />
              <StatCard
                icon={UsersRound}
                value={stat(receivedApplications)}
                label="Candidatures reçues"
                tone="green"
              />
              <StatCard
                icon={Eye}
                value={
                  received.status === "success"
                    ? String(
                        received.applications.filter((item) =>
                          ["SENT", "IN_REVIEW"].includes(item.status),
                        ).length,
                      )
                    : "…"
                }
                label="À examiner"
                tone="amber"
              />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="content-card overflow-hidden">
                <CardHeading
                  title="Candidatures récentes"
                  action="Tout voir"
                  onAction={() => setActive("Candidatures")}
                />
                {applicationsList(5)}
              </div>
              <div className="content-card p-6">
                {companyStatus && (
                  <span
                    className={`flex items-center gap-2 text-xs font-bold uppercase ${companyStatus === "APPROVED" ? "text-emerald-700" : companyStatus === "REJECTED" ? "text-red-700" : "text-amber-700"}`}
                  >
                    <ShieldCheck size={17} /> {COMPANY_STATUS_LABELS[companyStatus]}
                  </span>
                )}
                <h3 className="mt-4 font-bold text-[#0c2340]">{identity.name}</h3>
                <button
                  onClick={() => setActive("Profil entreprise")}
                  className="btn-secondary mt-5 w-full"
                >
                  Voir le profil
                </button>
              </div>
            </div>
          </>
        )}
        {showApplications && (
          <div className="content-card overflow-hidden">
            <CardHeading title="Candidatures reçues" />
            {applicationsList()}
          </div>
        )}
        {active === "Mes offres" && (
          <div className="content-card overflow-hidden">
            <CardHeading
              title="Mes offres publiées"
              action="Nouvelle offre"
              onAction={openPublish}
            />
            <div className="divide-y divide-slate-100">
              {offers.map((offer) => {
                const view = toJobView(offer, {
                  logoColor,
                  name: identity.name,
                  initials: identity.initials,
                });
                const displayStatus = getDisplayStatus(offer, today);
                const blockedReason = statusActionBlockedReason(companyStatus, offer.status);
                return (
                  <div key={offer.id} className="flex flex-wrap items-center gap-4 p-5">
                    <JobLogo job={view} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0c2340]">{offer.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {offer.publishedAt
                          ? `${offer.applicationsCount ?? 0} candidature(s) · ${view.posted}`
                          : `Créée le ${formatShortDate(offer.createdAt)}`}
                      </p>
                    </div>
                    <span className={`status ${offerStatusStyle[displayStatus]}`}>
                      {OFFER_DISPLAY_STATUS_LABELS[displayStatus]}
                    </span>
                    <button
                      onClick={() => void changeOfferStatus(offer)}
                      disabled={pending !== null || blockedReason !== null}
                      title={blockedReason ?? undefined}
                      className={`offer-toggle${blockedReason || pending !== null ? " cursor-not-allowed opacity-50" : ""}`}
                    >
                      {offer.status === "DRAFT"
                        ? "Publier"
                        : offer.status === "PUBLISHED"
                          ? "Clôturer"
                          : "Réouvrir"}
                    </button>
                  </div>
                );
              })}
              {offersStatus === "loading" && (
                <p role="status" className="p-5 text-sm text-slate-400">
                  Chargement de vos offres…
                </p>
              )}
              {offersStatus === "error" && (
                <div role="alert" className="flex flex-wrap items-center gap-3 p-5 text-sm">
                  <p className="flex-1 text-red-700">{companyOffers.error}</p>
                  <button onClick={companyOffers.reload} className="btn-secondary">
                    Réessayer
                  </button>
                </div>
              )}
              {loaded && !offers.length && (
                <p className="p-5 text-sm text-slate-400">
                  Vous n’avez encore publié aucune offre.
                </p>
              )}
            </div>
          </div>
        )}
        {active === "Profil entreprise" && <CompanyProfile onSaved={onProfileSaved} />}
      </div>
      {publish && (
        <PublishModal
          onClose={() => setPublish(false)}
          onPublish={(offer) => addOffer(offer, "PUBLISHED")}
          onDraft={(offer) => addOffer(offer, "DRAFT")}
          cities={companyOffers.cityOptions}
          domains={companyOffers.domainOptions}
          submitting={pending === "create"}
          publishBlockedReason={publicationBlockedReason(companyStatus) ?? undefined}
        />
      )}
    </DashboardLayout>
  );
}
