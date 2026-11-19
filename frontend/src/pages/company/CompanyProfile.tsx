import { useRef, useState, type FormEvent } from "react";
import { FieldError } from "../../components/ui/FieldError";
import { useAuth } from "../../features/auth/authContext";
import { useApiData } from "../../lib/useApiData";
import { ApiError } from "../../services/apiClient";
import {
  fetchCompanyProfile,
  updateCompanyProfile,
  type CompanyProfileApi,
  type CompanyProfileForm,
} from "../../services/companyProfileService";
import { fetchCities, type ReferenceItem } from "../../services/referenceService";

function toForm(profile: CompanyProfileApi): CompanyProfileForm {
  return {
    name: profile.name,
    sector: profile.sector ?? "",
    cityId: profile.city?.id ?? "",
    description: profile.description ?? "",
    contactEmail: profile.contactEmail ?? "",
    phone: profile.phone ?? "",
  };
}

function ProfileForm({
  profile,
  cities,
  onSaved,
}: {
  profile: CompanyProfileApi;
  cities: ReferenceItem[];
  onSaved: () => void;
}) {
  const auth = useAuth();
  const [saved, setSaved] = useState(profile);
  const [values, setValues] = useState(() => toForm(profile));
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function field(name: keyof CompanyProfileForm) {
    return {
      id: name,
      value: values[name],
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${name}-error` : undefined,
      onChange: (event: { target: { value: string } }) => {
        const { value } = event.target;
        setValues((current) => ({ ...current, [name]: value }));
        setFeedback("");
        setErrors((current) => ({ ...current, [name]: "" }));
      },
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setFeedback("");
    setError("");
    setErrors({});
    const previous = toForm(saved);
    const normalized = { ...values, name: values.name.trim().replace(/\s+/g, " ") };
    const changes: Partial<CompanyProfileForm> = {};
    for (const key of Object.keys(previous) as (keyof CompanyProfileForm)[]) {
      const value = normalized[key].trim();
      if (values[key] !== previous[key] && value !== previous[key]) changes[key] = value;
    }
    if (Object.keys(changes).length === 0) {
      setValues(previous);
      setFeedback("Aucune modification à enregistrer.");
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      const updated = await updateCompanyProfile(auth, changes);
      setSaved(updated);
      setValues(toForm(updated));
      setFeedback(
        updated.status === "PENDING" && updated.name !== saved.name
          ? "Profil enregistré. Le nouveau nom est en attente de validation."
          : "Profil enregistré.",
      );
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Impossible d’enregistrer le profil.");
      if (failure instanceof ApiError) {
        setErrors(
          Object.fromEntries(failure.details.map(({ field, message }) => [field, message])),
        );
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="content-card max-w-3xl p-6 sm:p-8">
      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">
          Nom de l’entreprise
          <input {...field("name")} required minLength={2} maxLength={120} />
          <FieldError id="name-error" message={errors.name} />
          <small className="mt-1 block text-sm font-normal text-slate-600">
            Un changement de nom déclenche une vérification. La publication et la visibilité des
            offres sont suspendues jusqu’à l’approbation.
          </small>
        </label>
        <label className="form-label">
          Secteur
          <input {...field("sector")} maxLength={120} placeholder="Ex. Services professionnels" />
          <FieldError id="sector-error" message={errors.sector} />
        </label>
        <label className="form-label">
          Ville
          <select {...field("cityId")}>
            <option value="">Choisir une ville</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
          <FieldError id="cityId-error" message={errors.cityId} />
        </label>
        <label className="form-label sm:col-span-2">
          Description
          <textarea
            {...field("description")}
            rows={5}
            maxLength={2000}
            placeholder="Présentez votre entreprise et ses activités."
          />
          <FieldError id="description-error" message={errors.description} />
        </label>
        <label className="form-label">
          E-mail de contact
          <input
            {...field("contactEmail")}
            type="email"
            maxLength={254}
            placeholder="recrutement@votre-entreprise.gn"
          />
          <FieldError id="contactEmail-error" message={errors.contactEmail} />
        </label>
        <label className="form-label">
          Téléphone
          <input {...field("phone")} type="tel" maxLength={32} placeholder="+224 …" />
          <FieldError id="phone-error" message={errors.phone} />
        </label>
      </fieldset>
      {feedback && (
        <p role="status" className="mt-5 text-sm text-emerald-800">
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-5 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary mt-6">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}

export function CompanyProfile({ onSaved }: { onSaved: () => void }) {
  const auth = useAuth();
  const result = useApiData(
    async (signal) => {
      const [profile, cities] = await Promise.all([
        fetchCompanyProfile(auth, signal),
        fetchCities(signal),
      ]);
      return { profile, cities };
    },
    [auth.user?.id],
  );
  if (result.status === "loading") return <p role="status">Chargement du profil…</p>;
  if (result.status === "error") {
    return (
      <div className="content-card max-w-3xl p-6 sm:p-8">
        <p role="alert">{result.error}</p>
        <button type="button" className="btn-secondary mt-4" onClick={result.reload}>
          Réessayer
        </button>
      </div>
    );
  }
  return <ProfileForm {...result.data} onSaved={onSaved} />;
}
