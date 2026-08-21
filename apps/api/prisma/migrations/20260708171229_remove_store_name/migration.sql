/*
  Warnings:

  - You are about to drop the column `isStoreNameEditable` on the `MapAppSetting` table. All the data in the column will be lost.
  - You are about to drop the column `storeName` on the `ProjectPublicInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MapAppSetting" DROP COLUMN "isStoreNameEditable";

-- AlterTable
ALTER TABLE "ProjectPublicInfo" DROP COLUMN "storeName";
