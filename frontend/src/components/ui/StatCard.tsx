import { FileText } from "lucide-react";

export function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof FileText;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <div className="stat-card">
      <span className={`stat-icon stat-${tone}`}>
        <Icon size={21} />
      </span>
      <div>
        <p className="text-2xl font-extrabold text-[#0c2340]">{value}</p>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}
