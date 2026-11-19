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
import type { RecruitApplication } from "../../types/application";
import type { CreationStatus } from "../../services/companyOffersService";
import {
  creationBlockedReason,
  getDisplayStatus,
  publicationBlockedReason,
  statusActionBlockedReason,
} from "../../features/offers/offerRules";
import type { CompanyOffersState } from "../../features/offers/useOffers";
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
import { PublishModal } from "../../features/offers/PublishModal";
import { CompanyProfile } from "./CompanyProfile";

/** Les tableaux de candidatures restent fictifs jusqu'à l'étape « candidatures » (B5). */
const DEMO_APPLICATIONS_NOTICE =
  "Démonstration : ces candidatures sont fictives. Le suivi réel des candidatures arrive prochainement.";

/** Message à afficher pour une action refusée sur une offre. */
function actionErrorMessage(offer: Offer, error: OfferActionError): string {
  return error.kind === "notPublishable"
    ? `« ${offer.title} » ne peut pas être publiée : ${error.message}`
    : error.message;
}

export function CompanyDashboard({
  go,
  company,
  identity,
  companyOffers,
  applications,
  updateStatus,
}: {
  go: (p: Page) => void;
  /** Affichage du logo et du nom (issus de la session). */
  company: Pick<Company, "name" | "initials" | "logoColor">;
  /** Entreprise connectée (nom, statut de validation) issue de la session. */
  identity: DashboardIdentity;
  /** Offres RÉELLES de l'entreprise connectée (API), actions et états de chargement. */
  companyOffers: CompanyOffersState;
  /** Candidatures de démonstration (fictives jusqu'à B5). */
  applications: RecruitApplication[];
  updateStatus: (id: string, status: string) => void;
}) {
  const { offers, today, status: offersStatus, companyStatus, pending } = companyOffers;
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
              {/* Statut réel des candidatures disponible à l'étape « candidatures » (B5). */}
              <StatCard icon={Eye} value="—" label="À examiner" tone="amber" />
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="content-card overflow-hidden">
                <CardHeading
                  title="Candidatures récentes"
                  action="Tout voir"
                  onAction={() => setActive("Candidatures")}
                />
                {applications.length > 0 && (
                  <p className="px-5 pt-4 text-xs text-slate-400">{DEMO_APPLICATIONS_NOTICE}</p>
                )}
                <RecruitTable items={applications} updateStatus={updateStatus} />
              </div>
              <div className="content-card p-6">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <ShieldCheck size={17} /> ENTREPRISE VÉRIFIÉE
                </span>
                <h3 className="mt-4 font-bold text-[#0c2340]">{company.name}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Services professionnels · Conakry
                </p>
                <div className="mt-5 border-t border-slate-100 pt-5 text-xs text-slate-500">
                  <p className="flex justify-between">
                    <span>Profil complété</span>
                    <b className="text-[#0c2340]">100%</b>
                  </p>
                </div>
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
            {applications.length > 0 && (
              <p className="px-5 pt-4 text-xs text-slate-400">{DEMO_APPLICATIONS_NOTICE}</p>
            )}
            <RecruitTable items={applications} updateStatus={updateStatus} />
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
                const view = toJobView(offer, company);
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
        {active === "Profil entreprise" && <CompanyProfile companyName={identity.name} />}
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
