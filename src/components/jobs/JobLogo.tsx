import type { Job } from "../../types/offer";

export function JobLogo({ job, large = false }: { job: Job; large?: boolean }) {
  return (
    <span className={`job-logo logo-${job.color} ${large ? "size-16 text-lg" : "size-12 text-sm"}`}>
      {job.initials}
    </span>
  );
}
