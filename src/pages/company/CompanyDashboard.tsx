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
  type OfferStatus,
} from "../../types/offer";
import type { Page } from "../../types/navigation";
import type { RecruitApplication } from "../../types/application";
import { getDisplayStatus, isPubliclyVisible } from "../../features/offers/offerRules";
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

export function CompanyDashboard({
  go,
  company,
  offers,
  today,
  applications,
  updateStatus,
  onCreateOffer,
  onChangeOfferStatus,
}: {
  go: (p: Page) => void;
  company: Company;
  offers: Offer[]; // uniquement les offres de cette entreprise
  today: string;
  applications: RecruitApplication[];
  updateStatus: (name: string, status: string) => void;
  onCreateOffer: (input: OfferInput, status: OfferStatus) => void;
  /** Renvoie null si le changement a réussi, sinon le message d'erreur. */
  onChangeOfferStatus: (offerId: number) => string | null;
}) {
  const [active, setActive] = useState("Aperçu");
  const [publish, setPublish] = useState(false);
  const [published, setPublished] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  // Message affiché quand une offre ne peut pas être (re)mise en ligne car incomplète ou expirée.
  const [statusError, setStatusError] = useState("");
  const showApplications = active === "Candidatures";
  // « Offres actives » = offres réellement visibles par le public.
  const activeOffersCount = offers.filter((offer) => isPubliclyVisible(offer, today)).length;

  /** Enregistre l'offre complète créée depuis la modale, avec le statut demandé. */
  const addOffer = (input: OfferInput, status: OfferStatus) => {
    onCreateOffer(input, status);
    setPublish(false);
    setPublished(status === "PUBLISHED");
    setDraftSaved(status === "DRAFT");
    setStatusError("");
    setActive("Mes offres");
  };

  /** Bouton « Publier / Clôturer / Réouvrir » : la règle est appliquée par useOffers. */
  const changeOfferStatus = (offer: Offer) => {
    const error = onChangeOfferStatus(offer.id);
    setStatusError(error ?? "");
    if (error) {
      setPublished(false);
      setDraftSaved(false);
    }
  };
  return (
    <DashboardLayout area="company" go={go} active={active} setActive={setActive}>
      <DashboardTop
        title={active === "Aperçu" ? "Espace entreprise" : active}
        subtitle={`${company.name} · Compte vérifié`}
        action="Publier une offre"
        onAction={() => setPublish(true)}
        avatar={company.initials}
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
            Le brouillon fictif a été enregistré dans vos offres.
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
                value={String(activeOffersCount)}
                label="Offres actives"
                tone="blue"
              />
              <StatCard
                icon={UsersRound}
                value={String(applications.length)}
                label="Candidatures reçues"
                tone="green"
              />
              <StatCard
                icon={Eye}
                value={String(
                  applications.filter((item) => ["Envoyée", "En examen"].includes(item.status))
                    .length,
                )}
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
            <RecruitTable items={applications} updateStatus={updateStatus} />
          </div>
        )}
        {active === "Mes offres" && (
          <div className="content-card overflow-hidden">
            <CardHeading
              title="Mes offres publiées"
              action="Nouvelle offre"
              onAction={() => setPublish(true)}
            />
            <div className="divide-y divide-slate-100">
              {offers.map((offer) => {
                const view = toJobView(offer, company);
                const displayStatus = getDisplayStatus(offer, today);
                // TEMPORAIRE : les candidatures fictives sont reliées à l'offre par son titre.
                // Elles le seront par un identifiant lors de l'étape « candidatures ».
                const applicationsCount = applications.filter(
                  (item) => item.role === offer.title,
                ).length;
                return (
                  <div key={offer.id} className="flex flex-wrap items-center gap-4 p-5">
                    <JobLogo job={view} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#0c2340]">{offer.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {offer.publishedAt
                          ? `${applicationsCount} candidature(s) · ${view.posted}`
                          : `Créée le ${formatShortDate(offer.createdAt)}`}
                      </p>
                    </div>
                    <span className={`status ${offerStatusStyle[displayStatus]}`}>
                      {OFFER_DISPLAY_STATUS_LABELS[displayStatus]}
                    </span>
                    <button onClick={() => changeOfferStatus(offer)} className="offer-toggle">
                      {offer.status === "DRAFT"
                        ? "Publier"
                        : offer.status === "PUBLISHED"
                          ? "Clôturer"
                          : "Réouvrir"}
                    </button>
                  </div>
                );
              })}
              {!offers.length && (
                <p className="p-5 text-sm text-slate-400">
                  Vous n’avez encore publié aucune offre.
                </p>
              )}
            </div>
          </div>
        )}
        {active === "Profil entreprise" && <CompanyProfile />}
      </div>
      {publish && (
        <PublishModal
          onClose={() => setPublish(false)}
          onPublish={(offer) => addOffer(offer, "PUBLISHED")}
          onDraft={(offer) => addOffer(offer, "DRAFT")}
        />
      )}
    </DashboardLayout>
  );
}
