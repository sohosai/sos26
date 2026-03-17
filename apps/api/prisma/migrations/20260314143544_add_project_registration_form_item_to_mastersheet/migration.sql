/*
  Warnings:

  - A unique constraint covering the columns `[projectRegistrationFormItemId]` on the table `MastersheetColumn` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ProjectRegistrationFormItemEditHistoryTrigger" AS ENUM ('PROJECT_SUBMIT', 'COMMITTEE_EDIT');

-- AlterEnum
ALTER TYPE "MastersheetColumnType" ADD VALUE 'PROJECT_REGISTRATION_FORM_ITEM';

-- AlterTable
ALTER TABLE "MastersheetColumn" ADD COLUMN     "projectRegistrationFormItemId" TEXT;

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItemEditHistory" (
    "id" TEXT NOT NULL,
    "projectRegistrationFormItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "fileId" TEXT,
    "actorId" TEXT NOT NULL,
    "trigger" "ProjectRegistrationFormItemEditHistoryTrigger" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRegistrationFormItemEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" (
    "id" TEXT NOT NULL,
    "editHistoryId" TEXT NOT NULL,
    "projectRegistrationFormItemOptionId" TEXT NOT NULL,

    CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItemEditHistory_projectRegistrationF_idx" ON "ProjectRegistrationFormItemEditHistory"("projectRegistrationFormItemId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItemEditHistory_actorId_idx" ON "ProjectRegistrationFormItemEditHistory"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormItemEditHistorySelectedOption_editHi_key" ON "ProjectRegistrationFormItemEditHistorySelectedOption"("editHistoryId", "projectRegistrationFormItemOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "MastersheetColumn_projectRegistrationFormItemId_key" ON "MastersheetColumn"("projectRegistrationFormItemId");

-- AddForeignKey
ALTER TABLE "MastersheetColumn" ADD CONSTRAINT "MastersheetColumn_projectRegistrationFormItemId_fkey" FOREIGN KEY ("projectRegistrationFormItemId") REFERENCES "ProjectRegistrationFormItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistory_projectRegistration_fkey" FOREIGN KEY ("projectRegistrationFormItemId") REFERENCES "ProjectRegistrationFormItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_editH_fkey" FOREIGN KEY ("editHistoryId") REFERENCES "ProjectRegistrationFormItemEditHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_proje_fkey" FOREIGN KEY ("projectRegistrationFormItemOptionId") REFERENCES "ProjectRegistrationFormItemOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
