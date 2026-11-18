import { useState } from "react";
import { X } from "lucide-react";
import {
  OFFER_CITIES,
  OFFER_DOMAINS,
  OFFER_TYPE_LABELS,
  OFFER_TYPES,
  type OfferField,
  type OfferFormValues,
  type OfferInput,
} from "../../types/offer";
import { validateOffer, type OfferErrors, type ValidationMode } from "./validateOffer";
import { todayIsoDate } from "../../lib/dates";
import { FieldError } from "../../components/ui/FieldError";
import { emptyOfferForm } from "./emptyOfferForm";

export function PublishModal({
  onClose,
  onPublish,
  onDraft,
}: {
  onClose: () => void;
  onPublish: (offer: OfferInput) => void;
  onDraft: (offer: OfferInput) => void;
}) {
  // Un seul état regroupe tous les champs : React connaît en permanence chaque valeur.
  const [values, setValues] = useState<OfferFormValues>(emptyOfferForm);
  const [errors, setErrors] = useState<OfferErrors>({});
  const today = todayIsoDate();

  /** Met à jour un champ et efface son erreur dès que l'utilisateur le corrige. */
  const update = <K extends OfferField>(field: K, value: OfferFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  /** Valide selon le mode, puis transmet l'objet complet au parent si tout est correct. */
  const submit = (mode: ValidationMode, form: HTMLFormElement | null) => {
    const result = validateOffer(values, mode, today);
    if (!result.ok) {
      setErrors(result.errors);
      // Place le curseur sur le premier champ en erreur (les erreurs suivent l'ordre du formulaire).
      const firstField = Object.keys(result.errors)[0];
      const element = firstField ? form?.elements.namedItem(firstField) : null;
      if (element instanceof HTMLElement) element.focus();
      return;
    }
    setErrors({});
    if (mode === "publish") onPublish(result.data);
    else onDraft(result.data);
  };

  /** Attributs d'accessibilité communs : signale le champ invalide aux lecteurs d'écran. */
  const fieldState = (field: OfferField) => ({
    name: field,
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `offer-${field}-error` : undefined,
    className: errors[field] ? "border-red-300" : undefined,
  });

  return (
    <div className="modal-backdrop">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit("publish", e.currentTarget);
        }}
        className="modal-card max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="section-kicker">Nouvelle opportunité</span>
            <h2 className="mt-1 text-xl font-extrabold text-[#0c2340]">Publier une offre</h2>
          </div>
          <button type="button" onClick={onClose} className="icon-button">
            <X size={19} />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="form-label sm:col-span-2">
            Intitulé du poste
            <input
              required
              {...fieldState("title")}
              value={values.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Ex. Assistant·e administratif·ve"
            />
            <FieldError id="offer-title-error" message={errors.title} />
          </label>
          <label className="form-label">
            Type
            <select
              {...fieldState("type")}
              value={values.type}
              onChange={(event) => update("type", event.target.value as OfferFormValues["type"])}
            >
              {OFFER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OFFER_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <FieldError id="offer-type-error" message={errors.type} />
          </label>
          <label className="form-label">
            Ville
            <select
              {...fieldState("city")}
              value={values.city}
              onChange={(event) => update("city", event.target.value as OfferFormValues["city"])}
            >
              {OFFER_CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
            <FieldError id="offer-city-error" message={errors.city} />
          </label>
          <label className="form-label sm:col-span-2">
            Domaine
            <select
              {...fieldState("domain")}
              value={values.domain}
              onChange={(event) =>
                update("domain", event.target.value as OfferFormValues["domain"])
              }
            >
              {OFFER_DOMAINS.map((domain) => (
                <option key={domain}>{domain}</option>
              ))}
            </select>
            <FieldError id="offer-domain-error" message={errors.domain} />
          </label>
          <label className="form-label sm:col-span-2">
            Description
            <textarea
              required
              rows={5}
              {...fieldState("description")}
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Décrivez les missions et le profil recherché..."
            />
            <FieldError id="offer-description-error" message={errors.description} />
          </label>
          <label className="form-label">
            Date limite
            <input
              required
              min={today}
              type="date"
              {...fieldState("deadline")}
              value={values.deadline}
              onChange={(event) => update("deadline", event.target.value)}
            />
            <FieldError id="offer-deadline-error" message={errors.deadline} />
          </label>
          <label className="form-label">
            Compétences
            <input
              {...fieldState("skills")}
              value={values.skills}
              onChange={(event) => update("skills", event.target.value)}
              placeholder="Excel, communication..."
            />
            <FieldError id="offer-skills-error" message={errors.skills} />
          </label>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={!values.title.trim()}
            onClick={(event) => submit("draft", event.currentTarget.form)}
            className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer en brouillon
          </button>
          <button className="btn-primary flex-1">Publier l’offre</button>
        </div>
      </form>
    </div>
  );
}
