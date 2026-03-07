/*
  Warnings:

  - A unique constraint covering the columns `[formItemId]` on the table `MastersheetColumn` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MastersheetColumn_formItemId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "MastersheetColumn_formItemId_key" ON "MastersheetColumn"("formItemId");
