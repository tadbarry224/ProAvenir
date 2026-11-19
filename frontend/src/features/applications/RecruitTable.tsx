import type { RecruitApplication } from "../../types/application";
import { statusStyle } from "./applicationStatusStyle";

export function RecruitTable({
  items,
  updateStatus,
}: {
  items: RecruitApplication[];
  updateStatus: (id: string, status: string) => void;
}) {
  const nextStatuses = (status: string) => {
    if (status === "Envoyée") return ["Envoyée", "En examen"];
    if (status === "En examen") return ["En examen", "Présélectionnée", "Refusée"];
    if (status === "Présélectionnée") return ["Présélectionnée", "Retenue", "Refusée"];
    return [status];
  };
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
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-blue-50 text-[10px] font-bold text-blue-700">
                    {item.initials}
                  </span>
                  <b>{item.name}</b>
                </span>
              </td>
              <td>{item.role}</td>
              <td>{item.date}</td>
              <td>
                <select
                  className={`status border-0 outline-none ${statusStyle[item.status]}`}
                  value={item.status}
                  onChange={(e) => updateStatus(item.id, e.target.value)}
                >
                  {nextStatuses(item.status).map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
