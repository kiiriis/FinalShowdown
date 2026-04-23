-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "linkNormalized" TEXT;

-- CreateIndex
CREATE INDEX "Job_linkNormalized_idx" ON "Job"("linkNormalized");
