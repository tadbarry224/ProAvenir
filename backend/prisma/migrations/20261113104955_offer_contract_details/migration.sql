-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'INTERNSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('FULL_TIME', 'PART_TIME');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "contractType" "ContractType",
ADD COLUMN     "duration" VARCHAR(50),
ADD COLUMN     "workSchedule" "WorkSchedule";

-- ---------------------------------------------------------------------------
-- Contraintes de cohérence ajoutées à la main (Prisma les conserve).
-- ---------------------------------------------------------------------------

-- Le contrat correspond au type d'offre : CDI/CDD pour un emploi, convention de
-- stage pour un stage ; OTHER est accepté pour les deux.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_contract_matches_type_check"
  CHECK (
    "contractType" IS NULL
    OR "contractType" = 'OTHER'
    OR ("type" = 'JOB' AND "contractType" IN ('CDI', 'CDD'))
    OR ("type" = 'INTERNSHIP' AND "contractType" = 'INTERNSHIP')
  );

-- Un CDI est à durée indéterminée : il n'a pas de durée.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_cdi_without_duration_check"
  CHECK ("contractType" IS DISTINCT FROM 'CDI' OR "duration" IS NULL);
