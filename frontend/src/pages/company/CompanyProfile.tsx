import { useState } from "react";
import { OFFER_CITIES } from "../../types/offer";

/** L'enregistrement du profil entreprise est une prochaine étape. */
const PROFILE_NOT_SAVED =
  "L’enregistrement du profil arrive prochainement : vos modifications ne sont pas encore sauvegardées.";

/**
 * Profil de l'entreprise. Aucune valeur inventée : seul le nom (session) est pré-rempli.
 */
export function CompanyProfile({ companyName }: { companyName: string }) {
  const [notice, setNotice] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setNotice(true);
      }}
      className="content-card max-w-3xl p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">
          Nom de l’entreprise
          <input required defaultValue={companyName} />
        </label>
        <label className="form-label">
          Secteur
          <input placeholder="Ex. Services professionnels" />
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
          Description
          <textarea rows={5} placeholder="Présentez votre entreprise et ses activités." />
        </label>
        <label className="form-label">
          E-mail de contact
          <input type="email" placeholder="recrutement@votre-entreprise.gn" />
        </label>
        <label className="form-label">
          Téléphone
          <input placeholder="+224 …" />
        </label>
      </div>
      {notice && (
        <p role="status" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {PROFILE_NOT_SAVED}
        </p>
      )}
      <button type="submit" className="btn-primary mt-6">
        Enregistrer
      </button>
    </form>
  );
}
