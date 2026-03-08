/*
  Warnings:

  - You are about to drop the `MastersheetEditHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MastersheetOverride` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MastersheetOverrideSelectedOption` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FormItemEditHistoryTrigger" AS ENUM ('PROJECT_SUBMIT', 'PROJECT_RESUBMIT', 'COMMITTEE_EDIT');

-- DropForeignKey
ALTER TABLE "MastersheetEditHistory" DROP CONSTRAINT "MastersheetEditHistory_columnId_fkey";

-- DropForeignKey
ALTER TABLE "MastersheetEditHistory" DROP CONSTRAINT "MastersheetEditHistory_editorId_fkey";

-- DropForeignKey
ALTER TABLE "MastersheetEditHistory" DROP CONSTRAINT "MastersheetEditHistory_projectId_fkey";

-- DropForeignKey
ALTER TABLE "MastersheetOverride" DROP CONSTRAINT "MastersheetOverride_columnId_fkey";

-- DropForeignKey
ALTER TABLE "MastersheetOverride" DROP CONSTRAINT "MastersheetOverride_editorId_fkey";

-- DropForeignKey
ALTER TABLE "MastersheetOverride" DROP CONSTRAINT "MastersheetOverride_projectId_fkey";

-- DropForeignKey
ALTER TABLE "MastersheetOverrideSelectedOption" DROP CONSTRAINT "MastersheetOverrideSelectedOption_overrideId_fkey";

-- DropTable
DROP TABLE "MastersheetEditHistory";

-- DropTable
DROP TABLE "MastersheetOverride";

-- DropTable
DROP TABLE "MastersheetOverrideSelectedOption";

-- CreateTable
CREATE TABLE "FormItemEditHistory" (
    "id" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "actorId" TEXT NOT NULL,
    "trigger" "FormItemEditHistoryTrigger" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormItemEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormItemEditHistorySelectedOption" (
    "id" TEXT NOT NULL,
    "editHistoryId" TEXT NOT NULL,
    "formItemOptionId" TEXT NOT NULL,

    CONSTRAINT "FormItemEditHistorySelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormItemEditHistory_formItemId_projectId_createdAt_idx" ON "FormItemEditHistory"("formItemId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FormItemEditHistory_actorId_idx" ON "FormItemEditHistory"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "FormItemEditHistorySelectedOption_editHistoryId_formItemOpt_key" ON "FormItemEditHistorySelectedOption"("editHistoryId", "formItemOptionId");

-- AddForeignKey
ALTER TABLE "FormItemEditHistory" ADD CONSTRAINT "FormItemEditHistory_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "FormItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemEditHistory" ADD CONSTRAINT "FormItemEditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemEditHistory" ADD CONSTRAINT "FormItemEditHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemEditHistorySelectedOption" ADD CONSTRAINT "FormItemEditHistorySelectedOption_editHistoryId_fkey" FOREIGN KEY ("editHistoryId") REFERENCES "FormItemEditHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemEditHistorySelectedOption" ADD CONSTRAINT "FormItemEditHistorySelectedOption_formItemOptionId_fkey" FOREIGN KEY ("formItemOptionId") REFERENCES "FormItemOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
