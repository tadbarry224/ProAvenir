import { useState } from "react";
import { Check } from "lucide-react";

export function CompanyProfile() {
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(true);
      }}
      className="content-card max-w-3xl p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="form-label sm:col-span-2">
          Nom de l’entreprise
          <input required defaultValue="Kamsar Solutions" />
        </label>
        <label className="form-label">
          Secteur
          <select required defaultValue="Services professionnels">
            <option>Services professionnels</option>
            <option>Technologie</option>
          </select>
        </label>
        <label className="form-label">
          Ville
          <select required defaultValue="Conakry">
            <option>Conakry</option>
            <option>Kindia</option>
          </select>
        </label>
        <label className="form-label sm:col-span-2">
          Description
          <textarea
            required
            rows={5}
            defaultValue="Cabinet guinéen spécialisé dans l’accompagnement des organisations et le développement de projets."
          />
        </label>
        <label className="form-label">
          E-mail de contact
          <input required type="email" defaultValue="recrutement@exemple.gn" />
        </label>
        <label className="form-label">
          Téléphone
          <input defaultValue="+224 600 00 00 00" />
        </label>
      </div>
      <button type="submit" className="btn-primary mt-6">
        {saved && <Check size={17} />}
        {saved ? "Modifications enregistrées" : "Enregistrer"}
      </button>
    </form>
  );
}
