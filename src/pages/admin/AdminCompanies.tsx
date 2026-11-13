import { useState } from "react";
import { Check, XCircle } from "lucide-react";
import type { PendingCompany } from "../../types/admin";
import { CardHeading } from "../../components/ui/CardHeading";

export function AdminCompanies({
  companies,
  verify,
  compact,
}: {
  companies: PendingCompany[];
  verify: (n: string, s: string) => void;
  compact?: boolean;
}) {
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="content-card overflow-hidden">
      <CardHeading title="Entreprises à vérifier" />
      <div className="divide-y divide-slate-100">
        {companies.slice(0, compact ? 3 : companies.length).map((c) => (
          <div key={c.name} className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 font-bold text-blue-700">
                {c.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0c2340]">{c.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {c.sector} · {c.city} · {c.date}
                </p>
              </div>
              <span
                className={`status ${c.status === "Approuvée" ? "bg-emerald-50 text-emerald-700" : c.status === "Refusée" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
              >
                {c.status}
              </span>
            </div>
            {c.status === "En attente" && (
              <>
                {rejecting === c.name && (
                  <div className="mt-4 rounded-xl bg-red-50 p-3">
                    <label className="text-xs font-bold text-red-800">
                      Motif du refus
                      <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-red-200 bg-white p-2 font-normal text-slate-700 outline-none focus:border-red-400"
                        placeholder="Précisez les informations manquantes ou non conformes…"
                      />
                    </label>
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setRejecting("");
                          setReason("");
                        }}
                        className="btn-secondary px-3 py-1.5 text-xs"
                      >
                        Annuler
                      </button>
                      <button
                        disabled={!reason.trim()}
                        onClick={() => {
                          verify(c.name, "Refusée");
                          setRejecting("");
                          setReason("");
                        }}
                        className="btn-danger disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Confirmer le refus
                      </button>
                    </div>
                  </div>
                )}
                {rejecting !== c.name && (
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => setRejecting(c.name)} className="btn-danger">
                      <XCircle size={15} /> Refuser
                    </button>
                    <button onClick={() => verify(c.name, "Approuvée")} className="btn-success">
                      <Check size={15} /> Approuver
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
