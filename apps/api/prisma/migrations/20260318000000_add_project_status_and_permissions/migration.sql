-- CreateEnum
CREATE TYPE "ProjectDeletionStatus" AS ENUM ('LOTTERY_LOSS', 'DELETED');

-- AlterEnum
ALTER TYPE "CommitteePermission" ADD VALUE IF NOT EXISTS 'PROJECT_EDIT';
ALTER TYPE "CommitteePermission" ADD VALUE IF NOT EXISTS 'PROJECT_DELETE';
ALTER TYPE "CommitteePermission" ADD VALUE IF NOT EXISTS 'PROJECT_VIEW';

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "deletionStatus" "ProjectDeletionStatus";

-- CreateIndex
CREATE INDEX "Project_isActive_idx" ON "Project"("isActive");
