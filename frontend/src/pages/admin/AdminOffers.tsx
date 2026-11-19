import { FileCheck2 } from "lucide-react";
import { CardHeading } from "../../components/ui/CardHeading";

/**
 * Modération des offres : pas encore de signalements en base (fonctionnalité à venir).
 * Aucune donnée fictive n'est affichée.
 */
export function AdminOffers() {
  return (
    <div className="content-card overflow-hidden">
      <CardHeading title="Modération des offres" />
      <div className="flex items-start gap-3 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-400">
          <FileCheck2 size={19} />
        </span>
        <p className="text-sm text-slate-500">
          Aucun signalement. Le signalement des offres par les utilisateurs arrive prochainement.
        </p>
      </div>
    </div>
  );
}
