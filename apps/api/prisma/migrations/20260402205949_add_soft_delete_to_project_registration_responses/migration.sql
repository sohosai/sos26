-- AlterTable
ALTER TABLE "ProjectRegistrationFormAnswer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProjectRegistrationFormResponse" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormAnswer_deletedAt_idx" ON "ProjectRegistrationFormAnswer"("deletedAt");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormResponse_deletedAt_idx" ON "ProjectRegistrationFormResponse"("deletedAt");
