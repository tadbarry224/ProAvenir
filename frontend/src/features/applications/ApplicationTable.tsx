import type { CandidateApplicationView } from "../../types/application";
import { statusStyle } from "./applicationStatusStyle";

/** « Mes candidatures » du candidat (données réelles). */
export function ApplicationTable({ items }: { items: CandidateApplicationView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Offre</th>
            <th>Date</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <b>{item.title}</b>
                <small>
                  {item.company}
                  {!item.offerOnline && " · offre plus en ligne"}
                </small>
              </td>
              <td>{item.date}</td>
              <td>
                <span className={`status ${statusStyle[item.status]}`}>{item.statusLabel}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
