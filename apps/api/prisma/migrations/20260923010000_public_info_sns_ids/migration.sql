/*
  Warnings:

  - You are about to drop the column `instagramUrl` on the `ProjectPublicInfo` table. All the data in the column will be lost.
  - You are about to drop the column `xUrl` on the `ProjectPublicInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProjectPublicInfo" DROP COLUMN "instagramUrl",
DROP COLUMN "xUrl",
ADD COLUMN     "instagramId" VARCHAR(30),
ADD COLUMN     "xId" VARCHAR(15);
