import { FileCheck2 } from "lucide-react";
import type { ModeratedOffer } from "../../types/admin";
import { CardHeading } from "../../components/ui/CardHeading";

export function AdminOffers({
  offers,
  moderate,
  compact,
}: {
  offers: ModeratedOffer[];
  moderate: (t: string, s: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="content-card overflow-hidden">
      <CardHeading title="Modération des offres" />
      <div className="divide-y divide-slate-100">
        {offers.slice(0, compact ? 2 : offers.length).map((o) => (
          <div key={o.title} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600">
                <FileCheck2 size={19} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0c2340]">{o.title}</p>
                <p className="mt-1 text-xs text-slate-400">{o.company}</p>
                <p className="mt-2 text-xs font-semibold text-amber-700">{o.reason}</p>
              </div>
            </div>
            {o.status === "À examiner" ? (
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => moderate(o.title, "Suspendue")} className="btn-danger">
                  Suspendre
                </button>
                <button onClick={() => moderate(o.title, "Maintenue")} className="btn-success">
                  Maintenir
                </button>
              </div>
            ) : (
              <div className="mt-3 text-right">
                <span
                  className={`status ${o.status === "Suspendue" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  {o.status}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
