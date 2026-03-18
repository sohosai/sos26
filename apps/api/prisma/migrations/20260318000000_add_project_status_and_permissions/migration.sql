-- CreateEnum
CREATE TYPE "ProjectDeletionStatus" AS ENUM ('LOTTERY_LOSS', 'DELETED');

-- AlterEnum
ALTER TYPE "CommitteePermission" ADD VALUE IF NOT EXISTS 'PROJECT_EDIT';
ALTER TYPE "CommitteePermission" ADD VALUE IF NOT EXISTS 'PROJECT_DELETE';
ALTER TYPE "CommitteePermission" ADD VALUE IF NOT EXISTS 'PROJECT_VIEW';

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "deletionStatus" "ProjectDeletionStatus";

