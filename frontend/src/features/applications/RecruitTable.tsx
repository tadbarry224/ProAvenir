import {
  NEXT_APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  type RecruitApplicationView,
} from "../../types/application";
import type { ApplicationStatusTarget } from "../../services/applicationsService";
import { statusStyle } from "./applicationStatusStyle";

/**
 * Candidatures reçues par l'entreprise (données réelles).
 * Le menu ne propose que les étapes suivantes autorisées par le serveur ; une
 * réponse définitive (retenue, refusée) s'affiche sans menu.
 */
export function RecruitTable({
  items,
  updateStatus,
  pending,
  readOnly,
}: {
  items: RecruitApplicationView[];
  updateStatus: (id: string, status: ApplicationStatusTarget) => void;
  /** Candidature en cours de mise à jour (menu désactivé). */
  pending?: string | null;
  /** Entreprise refusée : suivi en lecture seule. */
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Candidat</th>
            <th>Offre</th>
            <th>Date</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const next = NEXT_APPLICATION_STATUSES[item.status];
            return (
              <tr key={item.id}>
                <td>
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">
                      {item.initials}
                    </span>
                    <span>
                      <b>{item.name}</b>
                      <small>
                        <a href={`mailto:${item.email}`} className="hover:underline">
                          {item.email}
                        </a>
                      </small>
                    </span>
                  </span>
                </td>
                <td>
                  {item.role}
                  {item.message && <small className="italic">« {item.message} »</small>}
                </td>
                <td>{item.date}</td>
                <td>
                  {next.length === 0 || readOnly ? (
                    <span className={`status ${statusStyle[item.status]}`}>{item.statusLabel}</span>
                  ) : (
                    <select
                      aria-label={`Statut de la candidature de ${item.name}`}
                      className={`status border-0 outline-none ${statusStyle[item.status]}`}
                      value={item.status}
                      disabled={pending === item.id}
                      onChange={(e) =>
                        updateStatus(item.id, e.target.value as ApplicationStatusTarget)
                      }
                    >
                      <option value={item.status}>{item.statusLabel}</option>
                      {next.map((status) => (
                        <option key={status} value={status}>
                          {APPLICATION_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
