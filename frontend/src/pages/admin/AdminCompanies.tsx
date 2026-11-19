import { useState } from "react";
import { Check, CircleAlert, LoaderCircle, XCircle } from "lucide-react";
import type { AdminCompaniesState } from "../../features/admin/useAdminCompanies";
import { REJECTION_REASON } from "../../services/adminCompaniesService";
import { CardHeading } from "../../components/ui/CardHeading";

/**
 * « Entreprises à vérifier » : vraies entreprises de l'API.
 * `compact` (vue générale) : seulement les 3 premières en attente.
 */
export function AdminCompanies({
  state,
  compact,
}: {
  state: AdminCompaniesState;
  compact?: boolean;
}) {
  const [rejecting, setRejecting] = useState("");
  const [reason, setReason] = useState("");
  // Erreur de la dernière décision, affichée sous l'entreprise concernée.
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);

  const closeRejection = () => {
    setRejecting("");
    setReason("");
  };
  const decide = async (id: string, review: Parameters<AdminCompaniesState["review"]>[1]) => {
    setFailure(null);
    const error = await state.review(id, review);
    if (error) setFailure({ id, message: error.message });
    else closeRejection();
  };

  const companies = compact
    ? state.companies.filter((c) => c.status === "PENDING").slice(0, 3)
    : state.companies;
  const reasonTooShort = reason.trim().length < REJECTION_REASON.min;

  return (
    <div className="content-card overflow-hidden">
      <CardHeading title="Entreprises à vérifier" />
      {state.status === "error" ? (
        <div className="empty-state" role="alert">
          <CircleAlert size={28} />
          <h3>Impossible de charger les entreprises</h3>
          <p>{state.error}</p>
          <button onClick={state.reload} className="btn-secondary mx-auto mt-4">
            Réessayer
          </button>
        </div>
      ) : state.status !== "success" ? (
        <div className="empty-state" role="status">
          <LoaderCircle size={28} className="animate-spin" />
          <h3>Chargement des entreprises…</h3>
        </div>
      ) : companies.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">
          {compact
            ? "Aucune entreprise en attente de vérification."
            : "Aucune entreprise inscrite."}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {companies.map((c) => {
            const busy = state.pending === c.id;
            return (
              <div key={c.id} className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-blue-50 font-bold text-blue-700">
                    {c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#0c2340]">{c.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {c.sector} · {c.city} · {c.date}
                    </p>
                    {c.status === "REJECTED" && c.rejectionReason && (
                      <p className="mt-2 text-xs text-red-700">Motif : {c.rejectionReason}</p>
                    )}
                  </div>
                  <span
                    className={`status ${c.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : c.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {c.statusLabel}
                  </span>
                </div>
                {failure?.id === c.id && (
                  <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">
                    {failure.message}
                  </p>
                )}
                {c.status === "PENDING" && (
                  <>
                    {rejecting === c.id && (
                      <div className="mt-4 rounded-xl bg-red-50 p-3">
                        <label className="text-xs font-bold text-red-800">
                          Motif du refus
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={2}
                            maxLength={REJECTION_REASON.max}
                            className="mt-2 w-full rounded-lg border border-red-200 bg-white p-2 font-normal text-slate-700 outline-none focus:border-red-400"
                            placeholder="Précisez les informations manquantes ou non conformes…"
                          />
                        </label>
                        <p className="mt-1 text-xs text-red-700">
                          Ce motif sera communiqué à l’entreprise ({REJECTION_REASON.min} caractères
                          minimum).
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            onClick={closeRejection}
                            disabled={busy}
                            className="btn-secondary px-3 py-1.5 text-xs"
                          >
                            Annuler
                          </button>
                          <button
                            disabled={reasonTooShort || busy}
                            onClick={() => decide(c.id, { status: "REJECTED", reason })}
                            className="btn-danger disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Confirmer le refus
                          </button>
                        </div>
                      </div>
                    )}
                    {rejecting !== c.id && (
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setRejecting(c.id);
                            setReason("");
                          }}
                          disabled={busy}
                          className="btn-danger"
                        >
                          <XCircle size={15} /> Refuser
                        </button>
                        <button
                          onClick={() => decide(c.id, { status: "APPROVED" })}
                          disabled={busy}
                          className="btn-success"
                        >
                          <Check size={15} /> Approuver
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
