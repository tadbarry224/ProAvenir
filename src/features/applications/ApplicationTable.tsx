import type { CandidateApplication } from "../../types/application";
import { statusStyle } from "./applicationStatusStyle";

export function ApplicationTable({ items }: { items: CandidateApplication[] }) {
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
            <tr key={item.title}>
              <td>
                <b>{item.title}</b>
                <small>{item.company}</small>
              </td>
              <td>{item.date}</td>
              <td>
                <span className={`status ${statusStyle[item.status]}`}>{item.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
