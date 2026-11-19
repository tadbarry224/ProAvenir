import type { ComponentProps } from "react";
import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import type { Job } from "../types/offer";
import { usePublicOffer } from "../features/offers/usePublicOffers";
import { JobDetails } from "./JobDetails";

/**
 * Page /offres/:id : charge l'offre depuis l'API puis affiche `JobDetails`.
 *
 * `preview` : l'offre sur laquelle on vient de cliquer (déjà chargée par la liste).
 * Elle s'affiche tout de suite, sans écran de chargement, pendant que le serveur
 * confirme qu'elle est toujours publique.
 */
export function JobDetailsPage({
  id,
  preview,
  ...detailsProps
}: { id: string; preview: Job | null } & Omit<ComponentProps<typeof JobDetails>, "job">) {
  const offer = usePublicOffer(id);
  const job = offer.job ?? (offer.status === "loading" && preview?.id === id ? preview : null);

  if (job) return <JobDetails job={job} {...detailsProps} />;

  const backToJobs = () => detailsProps.go("jobs");
  return (
    <main className="min-h-screen bg-[#f6f8fb] pb-16">
      <div className="page-shell py-6">
        <button onClick={backToJobs} className="text-link">
          <ArrowLeft size={16} /> Retour aux offres
        </button>
      </div>
      <div className="page-shell">
        {offer.notFound ? (
          <div className="empty-state" role="alert">
            <CircleAlert size={28} />
            <h3>Offre introuvable</h3>
            <p>
              Cette offre n’existe pas ou n’est plus en ligne (clôturée ou date limite dépassée).
            </p>
            <button onClick={backToJobs} className="btn-secondary mx-auto mt-4">
              Voir les offres disponibles
            </button>
          </div>
        ) : offer.status === "error" ? (
          <div className="empty-state" role="alert">
            <CircleAlert size={28} />
            <h3>Impossible de charger l’offre</h3>
            <p>{offer.error}</p>
            <button onClick={offer.reload} className="btn-secondary mx-auto mt-4">
              Réessayer
            </button>
          </div>
        ) : (
          <div className="empty-state" role="status">
            <LoaderCircle size={28} className="animate-spin" />
            <h3>Chargement de l’offre…</h3>
            <p>Connexion au serveur ProAvenir.</p>
          </div>
        )}
      </div>
    </main>
  );
}
