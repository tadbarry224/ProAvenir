import { ArrowRight } from "lucide-react";

export function CardHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <h2 className="font-bold text-[#0c2340]">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-link text-xs">
          {action} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
