import { ArrowRight } from "lucide-react";
import type { Job } from "../../types/offer";
import { JobLogo } from "./JobLogo";

export function MiniJob({ job, go }: { job: Job; go: () => void }) {
  return (
    <button
      onClick={go}
      className="flex items-center gap-3 rounded-xl border border-slate-100 p-4 text-left hover:border-blue-200 hover:bg-blue-50/30"
    >
      <JobLogo job={job} />
      <span className="min-w-0 flex-1">
        <b className="block truncate text-sm text-[#0c2340]">{job.title}</b>
        <small className="mt-1 block text-slate-400">
          {job.company} · {job.city}
        </small>
      </span>
      <ArrowRight size={16} className="text-slate-300" />
    </button>
  );
}
