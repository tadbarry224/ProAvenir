-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CANDIDATE', 'COMPANY', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'RECRUITER');

-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('JOB', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SENT', 'IN_REVIEW', 'SHORTLISTED', 'REJECTED', 'ACCEPTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cityId" TEXT,
    "education" TEXT,
    "bio" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cvFileKey" TEXT,
    "cvFileName" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT,
    "cityId" TEXT,
    "description" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "logoColor" TEXT NOT NULL DEFAULT 'blue',
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "type" "OfferType" NOT NULL,
    "cityId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadline" DATE,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(3),
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "candidateId" UUID NOT NULL,
    "message" TEXT,
    "cvFileKey" TEXT,
    "cvFileName" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateProfile_userId_key" ON "CandidateProfile"("userId");

-- CreateIndex
CREATE INDEX "CandidateProfile_cityId_idx" ON "CandidateProfile"("cityId");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_userId_key" ON "CompanyMember"("userId");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_idx" ON "CompanyMember"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_name_key" ON "Domain"("name");

-- CreateIndex
CREATE INDEX "Offer_status_deadline_idx" ON "Offer"("status", "deadline");

-- CreateIndex
CREATE INDEX "Offer_companyId_status_idx" ON "Offer"("companyId", "status");

-- CreateIndex
CREATE INDEX "Offer_cityId_idx" ON "Offer"("cityId");

-- CreateIndex
CREATE INDEX "Offer_domainId_idx" ON "Offer"("domainId");

-- CreateIndex
CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

-- CreateIndex
CREATE INDEX "Application_offerId_status_idx" ON "Application"("offerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Application_offerId_candidateId_key" ON "Application"("offerId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateProfile" ADD CONSTRAINT "CandidateProfile_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Contraintes de cohérence ajoutées à la main (Prisma ne sait pas les exprimer
-- dans schema.prisma, mais il les conserve). Elles protègent les données même
-- si une erreur du backend tentait d'enregistrer un état incohérent.
-- ---------------------------------------------------------------------------

-- Les e-mails sont enregistrés en minuscules : l'unicité ne dépend pas de la casse.
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase_check"
  CHECK ("email" = lower("email"));

-- Intitulé d'offre : 3 à 120 caractères (règle de validation du frontend, brouillons compris).
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_title_length_check"
  CHECK (char_length("title") BETWEEN 3 AND 120);

-- Une offre publiée (ou clôturée après publication) a forcément une date limite
-- et une date de publication. Seul un brouillon peut en être dépourvu.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_published_fields_check"
  CHECK ("status" = 'DRAFT' OR ("deadline" IS NOT NULL AND "publishedAt" IS NOT NULL));

-- Une entreprise refusée a forcément un motif de refus.
ALTER TABLE "Company" ADD CONSTRAINT "Company_rejection_reason_check"
  CHECK ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL);
