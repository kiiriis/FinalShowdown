-- AlterTable
ALTER TABLE "User" ADD COLUMN "followUpDelayDays" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "JobEntry"
ADD COLUMN "referralSentAt" TIMESTAMP(3),
ADD COLUMN "referralFollowUpSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "coldEmailSentAt" TIMESTAMP(3),
ADD COLUMN "coldEmailFollowUpSent" BOOLEAN NOT NULL DEFAULT false;
