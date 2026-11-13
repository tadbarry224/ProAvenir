import type { OfferFormValues } from "../../types/offer";

/** Valeurs de départ du formulaire (identiques aux premières options affichées auparavant). */
export const emptyOfferForm: OfferFormValues = {
  title: "",
  type: "JOB",
  city: "Conakry",
  domain: "Marketing",
  description: "",
  deadline: "",
  skills: "",
};
