import { authorizedRequest, type AccessTokenSource } from "./apiClient";
import type { CompanyStatus } from "./companyOffersService";
import type { ReferenceItem } from "./referenceService";

export type CompanyProfileApi = {
  name: string;
  sector: string | null;
  city: ReferenceItem | null;
  description: string | null;
  contactEmail: string | null;
  phone: string | null;
  status: CompanyStatus;
};

export type CompanyProfileForm = Record<
  "name" | "sector" | "cityId" | "description" | "contactEmail" | "phone",
  string
>;

const path = "/companies/me/profile";

export function fetchCompanyProfile(session: AccessTokenSource, signal: AbortSignal) {
  return authorizedRequest<CompanyProfileApi>(session, path, { signal });
}

export function updateCompanyProfile(
  session: AccessTokenSource,
  body: Partial<CompanyProfileForm>,
) {
  return authorizedRequest<CompanyProfileApi>(session, path, { method: "PATCH", body });
}
