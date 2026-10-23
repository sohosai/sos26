/*
  Warnings:

  - You are about to alter the column `description` on the `ProjectPublicInfo` table. The data in that column could be lost. The data in that column will be cast from `VarChar(400)` to `VarChar(200)`.

*/
-- 既存データを新しい上限に合わせて切り詰める（型変更がエラーになるのを防ぐ）
UPDATE "ProjectPublicInfo"
SET "description" = LEFT("description", 200)
WHERE "description" IS NOT NULL AND LENGTH("description") > 200;

-- AlterTable
ALTER TABLE "ProjectPublicInfo" ALTER COLUMN "description" SET DATA TYPE VARCHAR(200);
