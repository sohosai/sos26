/*
  Warnings:

  - A unique constraint covering the columns `[pendingProjectId]` on the table `ProjectSubOwnerRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProjectSubOwnerRequest" ADD COLUMN     "pendingProjectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubOwnerRequest_pendingProjectId_key" ON "ProjectSubOwnerRequest"("pendingProjectId");
