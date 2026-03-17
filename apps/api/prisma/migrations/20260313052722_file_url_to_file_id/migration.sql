/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `ProjectRegistrationFormAnswer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProjectRegistrationFormAnswer" DROP COLUMN "fileUrl",
ADD COLUMN     "fileId" TEXT;
