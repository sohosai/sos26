/*
  Warnings:

  - You are about to drop the `FormShare` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FormShare" DROP CONSTRAINT "FormShare_formId_fkey";

-- DropForeignKey
ALTER TABLE "FormShare" DROP CONSTRAINT "FormShare_userId_fkey";

-- DropTable
DROP TABLE "FormShare";

-- CreateTable
CREATE TABLE "FormCollaborator" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormCollaborator_formId_userId_key" ON "FormCollaborator"("formId", "userId");

-- AddForeignKey
ALTER TABLE "FormCollaborator" ADD CONSTRAINT "FormCollaborator_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormCollaborator" ADD CONSTRAINT "FormCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
