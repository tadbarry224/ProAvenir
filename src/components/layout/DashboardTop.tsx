import { Plus } from "lucide-react";

export function DashboardTop({
  title,
  subtitle,
  action,
  onAction,
  avatar,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
  avatar: string;
}) {
  return (
    <div className="dashboard-top">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1>{title}</h1>
          <span className="demo-chip">Données fictives</span>
        </div>
        <p>{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        {action && (
          <button onClick={onAction} className="dashboard-action btn-primary">
            <Plus size={17} />
            <span>{action}</span>
          </button>
        )}
        <span className="grid size-10 place-items-center rounded-full bg-[#0c2340] text-xs font-bold text-white md:hidden">
          {avatar}
        </span>
      </div>
    </div>
  );
}
