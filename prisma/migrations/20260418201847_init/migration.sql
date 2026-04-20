-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('NONE', 'APPLIED', 'APPLIED_WITH_REFERRAL', 'SKIPPED', 'REJECTED', 'EXPIRED', 'OFFER');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('NONE', 'REQUESTED', 'RECEIVED', 'NOT_NEEDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "notes" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEntry" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'NONE',
    "referral" "ReferralStatus" NOT NULL DEFAULT 'NONE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Job_link_key" ON "Job"("link");

-- CreateIndex
CREATE INDEX "Job_company_idx" ON "Job"("company");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "JobEntry_userId_idx" ON "JobEntry"("userId");

-- CreateIndex
CREATE INDEX "JobEntry_status_idx" ON "JobEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "JobEntry_jobId_userId_key" ON "JobEntry"("jobId", "userId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEntry" ADD CONSTRAINT "JobEntry_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEntry" ADD CONSTRAINT "JobEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
