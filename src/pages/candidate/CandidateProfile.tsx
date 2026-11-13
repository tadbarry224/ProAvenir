import { useState } from "react";
import { Check, FileText, Upload } from "lucide-react";

export function CandidateProfile() {
  const [saved, setSaved] = useState(false);
  const [cvName, setCvName] = useState("CV_Mariama_Diallo.pdf");
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="content-card p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="form-label">
            Nom complet
            <input required defaultValue="Mariama Diallo" />
          </label>
          <label className="form-label">
            Ville
            <select required defaultValue="Conakry">
              <option>Conakry</option>
              <option>Labé</option>
              <option>Kindia</option>
            </select>
          </label>
          <label className="form-label sm:col-span-2">
            Formation
            <input required defaultValue="Licence en Communication — Université de Sonfonia" />
          </label>
          <label className="form-label sm:col-span-2">
            Présentation
            <textarea
              rows={4}
              defaultValue="Jeune diplômée passionnée par la communication digitale et les projets à impact."
            />
          </label>
          <label className="form-label sm:col-span-2">
            Compétences
            <input required defaultValue="Communication, Réseaux sociaux, Canva, Excel" />
          </label>
        </div>
        <button className="btn-primary mt-6">
          {saved ? <Check size={17} /> : null}
          {saved ? "Modifications enregistrées" : "Enregistrer les modifications"}
        </button>
      </form>
      <div className="content-card h-fit p-6">
        <h2 className="font-bold text-[#0c2340]">Mon CV</h2>
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-center">
          <FileText className="mx-auto text-[#1768c4]" />
          <p className="mt-3 truncate text-sm font-bold">{cvName}</p>
          <p className="mt-1 text-xs text-slate-400">Mis à jour le 10 déc. 2026</p>
        </div>
        <label className="btn-secondary mt-4 w-full cursor-pointer">
          <Upload size={16} /> Remplacer le CV
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setCvName(file.name);
            }}
          />
        </label>
        <p className="mt-3 text-center text-[11px] text-slate-400">PDF uniquement · 5 Mo maximum</p>
      </div>
    </div>
  );
}
