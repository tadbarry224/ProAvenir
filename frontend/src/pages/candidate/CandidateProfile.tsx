import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Download, FileText, Trash2, Upload } from "lucide-react";
import type { CandidateProfileState } from "../../features/candidate/useCandidateProfile";
import {
  formatFileSize,
  profileFormFromApi,
  type CandidateProfileForm,
  type ProfileField,
} from "../../features/candidate/candidateProfileForm";
import { useReferenceLists } from "../../features/offers/usePublicOffers";
import { PROFILE_LIMITS } from "../../services/candidateProfileService";
import { formatShortDate } from "../../lib/dates";
import { FieldError } from "../../components/ui/FieldError";

const EMPTY_FORM: CandidateProfileForm = {
  fullName: "",
  cityId: "",
  education: "",
  bio: "",
  skills: "",
};

/** Profil du candidat et son CV : données réelles (API), enregistrées en base. */
export function CandidateProfile({ state }: { state: CandidateProfileState }) {
  const { profile } = state;
  const references = useReferenceLists();
  const cities = references.status === "success" ? references.data.cities : [];
  const [form, setForm] = useState<CandidateProfileForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [cvMessage, setCvMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Le formulaire reprend le profil du serveur dès qu'il est chargé.
  const loaded = profile !== null;
  useEffect(() => {
    if (profile) setForm(profileFormFromApi(profile));
    // Seulement au premier chargement : une saisie en cours n'est pas écrasée.
  }, [loaded]);

  if (state.status === "error") {
    return (
      <div role="alert" className="content-card flex flex-wrap items-center gap-3 p-6 text-sm">
        <span className="text-red-700">{state.error}</span>
        <button onClick={state.reload} className="btn-secondary px-3 py-1.5 text-xs">
          Réessayer
        </button>
      </div>
    );
  }
  if (!profile) {
    return <p className="content-card p-6 text-sm text-slate-400">Chargement du profil…</p>;
  }

  const change = (field: ProfileField) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage(null);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const error = await state.save(form);
    setFieldErrors(error?.fieldErrors ?? {});
    setSaveMessage(
      error
        ? { ok: false, text: error.message }
        : { ok: true, text: "Modifications enregistrées." },
    );
  };
  const cvAction = async (action: () => Promise<string | null>, success: string) => {
    setCvMessage(null);
    const error = await action();
    setCvMessage(error ? { ok: false, text: error } : { ok: true, text: success });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form onSubmit={submit} noValidate className="content-card p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-label">
            Nom complet
            <input
              value={form.fullName}
              onChange={(e) => change("fullName")(e.target.value)}
              maxLength={PROFILE_LIMITS.fullNameMax}
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
            <FieldError id="profile-fullName-error" message={fieldErrors.fullName} />
          </label>
          <label className="form-label">
            Ville
            <select value={form.cityId} onChange={(e) => change("cityId")(e.target.value)}>
              <option value="">Choisir une ville</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <FieldError id="profile-cityId-error" message={fieldErrors.cityId} />
          </label>
          <label className="form-label sm:col-span-2">
            Formation
            <input
              value={form.education}
              onChange={(e) => change("education")(e.target.value)}
              maxLength={PROFILE_LIMITS.educationMax}
              placeholder="Ex. Licence en gestion — Université de Conakry"
            />
            <FieldError id="profile-education-error" message={fieldErrors.education} />
          </label>
          <label className="form-label sm:col-span-2">
            Présentation
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => change("bio")(e.target.value)}
              maxLength={PROFILE_LIMITS.bioMax}
              placeholder="Présentez-vous en quelques lignes."
            />
            <FieldError id="profile-bio-error" message={fieldErrors.bio} />
          </label>
          <label className="form-label sm:col-span-2">
            Compétences <span>(séparées par des virgules)</span>
            <input
              value={form.skills}
              onChange={(e) => change("skills")(e.target.value)}
              placeholder="Ex. Excel, communication, comptabilité"
            />
            <FieldError id="profile-skills-error" message={fieldErrors.skills} />
          </label>
        </div>
        {saveMessage && (
          <p
            role={saveMessage.ok ? "status" : "alert"}
            className={`mt-5 rounded-lg p-3 text-sm ${saveMessage.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          >
            {saveMessage.text}
          </p>
        )}
        <button
          disabled={state.pending === "save"}
          className="btn-primary mt-6 disabled:opacity-60"
        >
          {saveMessage?.ok ? <Check size={17} /> : null}
          {state.pending === "save" ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </form>
      <div className="content-card h-fit p-6">
        <h2 className="font-bold text-[#0c2340]">Mon CV</h2>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <FileText className={`mx-auto ${profile.cv ? "text-[#1768c4]" : "text-slate-400"}`} />
          {profile.cv ? (
            <>
              <p className="mt-3 truncate text-sm font-bold">{profile.cv.fileName}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatFileSize(profile.cv.size)} · déposé le{" "}
                {formatShortDate(profile.cv.uploadedAt)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold">Aucun CV déposé</p>
              <p className="mt-1 text-xs text-slate-400">
                Il sera joint à vos prochaines candidatures.
              </p>
            </>
          )}
        </div>
        {cvMessage && (
          <p
            role={cvMessage.ok ? "status" : "alert"}
            className={`mt-4 rounded-lg p-3 text-xs ${cvMessage.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          >
            {cvMessage.text}
          </p>
        )}
        <label
          className={`btn-secondary mt-4 w-full cursor-pointer ${state.pending === "cv" ? "pointer-events-none opacity-60" : ""}`}
        >
          <Upload size={16} /> {profile.cv ? "Remplacer le CV" : "Déposer un CV"}
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,application/pdf"
            aria-label="Fichier du CV (PDF)"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // permet de renvoyer le même fichier
              if (file) void cvAction(() => state.uploadCv(file), "CV enregistré.");
            }}
          />
        </label>
        {profile.cv && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={state.pending === "cv"}
              onClick={() => void cvAction(state.downloadCv, "Téléchargement lancé.")}
              className="btn-secondary px-3 py-2 text-xs"
            >
              <Download size={15} /> Télécharger
            </button>
            <button
              type="button"
              disabled={state.pending === "cv"}
              onClick={() => void cvAction(state.deleteCv, "CV retiré de votre profil.")}
              className="btn-secondary px-3 py-2 text-xs text-red-700"
            >
              <Trash2 size={15} /> Retirer
            </button>
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-slate-400">PDF uniquement · 5 Mo maximum</p>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Votre CV n’est visible que par les recruteurs auxquels vous postulez.
        </p>
      </div>
    </div>
  );
}
