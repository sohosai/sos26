-- DropIndex
DROP INDEX IF EXISTS "Project_isActive_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "isActive";
