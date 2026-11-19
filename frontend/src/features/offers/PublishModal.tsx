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
import type { OfferActionError } from "./companyOfferMapping";

/** Réponse du parent après l'envoi : null si tout s'est bien passé, sinon l'erreur. */
type SubmitResult = Promise<OfferActionError | null> | void;

export function PublishModal({
  onClose,
  onPublish,
  onDraft,
  cities = OFFER_CITIES,
  domains = OFFER_DOMAINS,
  submitting = false,
  publishBlockedReason,
}: {
  onClose: () => void;
  onPublish: (offer: OfferInput) => SubmitResult;
  onDraft: (offer: OfferInput) => SubmitResult;
  /** Villes et domaines proposés (ceux acceptés par l'API). */
  cities?: readonly string[];
  domains?: readonly string[];
  /** Vrai pendant l'envoi : les deux boutons sont désactivés (pas de double envoi). */
  submitting?: boolean;
  /** Si renseigné, la publication est impossible (ex. entreprise en attente) : explication affichée. */
  publishBlockedReason?: string;
}) {
  // Un seul état regroupe tous les champs : React connaît en permanence chaque valeur.
  const [values, setValues] = useState<OfferFormValues>(emptyOfferForm);
  const [errors, setErrors] = useState<OfferErrors>({});
  // Erreur du serveur qui ne concerne pas un champ précis (droits, réseau, session…).
  const [formError, setFormError] = useState("");
  const today = todayIsoDate();
  const publishDisabled = submitting || Boolean(publishBlockedReason);

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

  /** Affiche des erreurs par champ et place le curseur sur le premier champ concerné. */
  const showErrors = (fieldErrors: OfferErrors, form: HTMLFormElement | null) => {
    setErrors(fieldErrors);
    // Les erreurs suivent l'ordre du formulaire.
    const firstField = Object.keys(fieldErrors)[0];
    const element = firstField ? form?.elements.namedItem(firstField) : null;
    if (element instanceof HTMLElement) element.focus();
  };

  /**
   * Valide selon le mode (vérification immédiate dans le navigateur), puis transmet
   * l'offre au parent. Le SERVEUR revérifie tout : ses erreurs sont affichées
   * sous les champs concernés, ou au-dessus des boutons.
   */
  const submit = async (mode: ValidationMode, form: HTMLFormElement | null) => {
    if (submitting || (mode === "publish" && publishBlockedReason)) return;
    const result = validateOffer(values, mode, today);
    if (!result.ok) {
      showErrors(result.errors, form);
      return;
    }
    setErrors({});
    setFormError("");
    const failure = await (mode === "publish" ? onPublish(result.data) : onDraft(result.data));
    if (!failure) return;
    if (Object.keys(failure.fieldErrors).length > 0) showErrors(failure.fieldErrors, form);
    else setFormError(failure.message);
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
          void submit("publish", e.currentTarget);
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
              {cities.map((city) => (
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
              {domains.map((domain) => (
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
        {publishBlockedReason && (
          <p className="mt-5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs leading-5 text-slate-600">
            {publishBlockedReason}
          </p>
        )}
        {formError && (
          <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">
            {formError}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            disabled={!values.title.trim() || submitting}
            onClick={(event) => void submit("draft", event.currentTarget.form)}
            className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enregistrer en brouillon
          </button>
          <button
            disabled={publishDisabled}
            className={`btn-primary flex-1${publishDisabled ? " cursor-not-allowed opacity-50" : ""}`}
          >
            Publier l’offre
          </button>
        </div>
      </form>
    </div>
  );
}
