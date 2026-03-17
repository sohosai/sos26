/*
  Warnings:

  - You are about to drop the column `fileId` on the `FormAnswer` table. All the data in the column will be lost.
  - You are about to drop the column `fileId` on the `FormItemEditHistory` table. All the data in the column will be lost.
  - You are about to drop the column `fileId` on the `ProjectRegistrationFormAnswer` table. All the data in the column will be lost.

*/

-- CreateTable
CREATE TABLE "FormAnswerFile" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAnswerFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormItemEditHistoryFile" (
    "id" TEXT NOT NULL,
    "editHistoryId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormItemEditHistoryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormAnswerFile" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRegistrationFormAnswerFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormAnswerFile_answerId_fileId_key" ON "FormAnswerFile"("answerId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "FormAnswerFile_answerId_sortOrder_key" ON "FormAnswerFile"("answerId", "sortOrder");

-- CreateIndex
CREATE INDEX "FormAnswerFile_fileId_idx" ON "FormAnswerFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "FormItemEditHistoryFile_editHistoryId_fileId_key" ON "FormItemEditHistoryFile"("editHistoryId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "FormItemEditHistoryFile_editHistoryId_sortOrder_key" ON "FormItemEditHistoryFile"("editHistoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "FormItemEditHistoryFile_fileId_idx" ON "FormItemEditHistoryFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormAnswerFile_answerId_fileId_key" ON "ProjectRegistrationFormAnswerFile"("answerId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormAnswerFile_answerId_sortOrder_key" ON "ProjectRegistrationFormAnswerFile"("answerId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormAnswerFile_fileId_idx" ON "ProjectRegistrationFormAnswerFile"("fileId");

-- Backfill existing single-file answers into the new child tables.
INSERT INTO "FormAnswerFile" ("id", "answerId", "fileId", "sortOrder", "createdAt")
SELECT 'faf_' || md5("id" || ':' || "fileId" || ':' || clock_timestamp()::text), "id", "fileId", 0, CURRENT_TIMESTAMP
FROM "FormAnswer"
WHERE "fileId" IS NOT NULL;

INSERT INTO "FormItemEditHistoryFile" ("id", "editHistoryId", "fileId", "sortOrder", "createdAt")
SELECT 'fihf_' || md5("id" || ':' || "fileId" || ':' || clock_timestamp()::text), "id", "fileId", 0, CURRENT_TIMESTAMP
FROM "FormItemEditHistory"
WHERE "fileId" IS NOT NULL;

INSERT INTO "ProjectRegistrationFormAnswerFile" ("id", "answerId", "fileId", "sortOrder", "createdAt")
SELECT 'praf_' || md5("id" || ':' || "fileId" || ':' || clock_timestamp()::text), "id", "fileId", 0, CURRENT_TIMESTAMP
FROM "ProjectRegistrationFormAnswer"
WHERE "fileId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ProjectRegistrationFormAnswer" DROP CONSTRAINT "ProjectRegistrationFormAnswer_fileId_fkey";

-- DropIndex
DROP INDEX "ProjectRegistrationFormAnswer_fileId_idx";

-- AlterTable
ALTER TABLE "FormAnswer" DROP COLUMN "fileId";

-- AlterTable
ALTER TABLE "FormItemEditHistory" DROP COLUMN "fileId";

-- AlterTable
ALTER TABLE "ProjectRegistrationFormAnswer" DROP COLUMN "fileId";

-- AddForeignKey
ALTER TABLE "FormAnswerFile" ADD CONSTRAINT "FormAnswerFile_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "FormAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswerFile" ADD CONSTRAINT "FormAnswerFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemEditHistoryFile" ADD CONSTRAINT "FormItemEditHistoryFile_editHistoryId_fkey" FOREIGN KEY ("editHistoryId") REFERENCES "FormItemEditHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemEditHistoryFile" ADD CONSTRAINT "FormItemEditHistoryFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswerFile" ADD CONSTRAINT "ProjectRegistrationFormAnswerFile_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ProjectRegistrationFormAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswerFile" ADD CONSTRAINT "ProjectRegistrationFormAnswerFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
