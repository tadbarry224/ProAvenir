-- B6 : informations sur le CV du candidat (le fichier lui-même est stocké hors de la base).

-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "cvFileSize" INTEGER,
ADD COLUMN     "cvUploadedAt" TIMESTAMPTZ(3);

-- Un CV fait au plus 5 Mo (5 * 1024 * 1024 octets), même règle que l'API.
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_cv_size_check"
  CHECK ("cvFileSize" IS NULL OR ("cvFileSize" > 0 AND "cvFileSize" <= 5242880));

-- Clé, nom, taille et date vont ensemble : tous renseignés, ou tous vides.
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_cv_fields_check"
  CHECK (
    ("cvFileKey" IS NULL AND "cvFileSize" IS NULL AND "cvUploadedAt" IS NULL)
    OR ("cvFileKey" IS NOT NULL AND "cvFileName" IS NOT NULL
        AND "cvFileSize" IS NOT NULL AND "cvUploadedAt" IS NOT NULL)
  );
