import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { OFFER_CITIES } from "../../types/offer";

/** L'enregistrement du profil et le dépôt du CV sont la prochaine étape (B6). */
const PROFILE_NOT_SAVED =
  "L’enregistrement du profil arrive prochainement : vos modifications ne sont pas encore sauvegardées.";

/**
 * Profil du candidat. Aucune valeur inventée : seul le nom (session) est pré-rempli.
 */
export function CandidateProfile({ fullName }: { fullName: string }) {
  const [notice, setNotice] = useState(false);
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setNotice(true);
        }}
        className="content-card p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-label">
            Nom complet
            <input required defaultValue={fullName} />
          </label>
          <label className="form-label">
            Ville
            <select defaultValue="">
              <option value="">Choisir une ville</option>
              {OFFER_CITIES.map((city) => (
                <option key={city}>{city}</option>
              ))}
            </select>
          </label>
          <label className="form-label sm:col-span-2">
            Formation
            <input placeholder="Ex. Licence en gestion — Université de Conakry" />
          </label>
          <label className="form-label sm:col-span-2">
            Présentation
            <textarea rows={4} placeholder="Présentez-vous en quelques lignes." />
          </label>
          <label className="form-label sm:col-span-2">
            Compétences
            <input placeholder="Ex. Excel, communication, comptabilité" />
          </label>
        </div>
        {notice && (
          <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {PROFILE_NOT_SAVED}
          </p>
        )}
        <button className="btn-primary mt-6">Enregistrer les modifications</button>
      </form>
      <div className="content-card h-fit p-6">
        <h2 className="font-bold text-[#0c2340]">Mon CV</h2>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <FileText className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-bold">Aucun CV déposé</p>
          <p className="mt-1 text-xs text-slate-400">Le dépôt de CV arrive prochainement.</p>
        </div>
        <button type="button" disabled className="btn-secondary mt-4 w-full opacity-60">
          <Upload size={16} /> Déposer un CV
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-400">PDF uniquement · 5 Mo maximum</p>
      </div>
    </div>
  );
}
