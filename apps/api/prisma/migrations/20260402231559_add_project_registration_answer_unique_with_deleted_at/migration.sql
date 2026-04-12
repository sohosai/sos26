/*
  Warnings:

  - A unique constraint covering the columns `[responseId,formItemId,deletedAt]` on the table `ProjectRegistrationFormAnswer` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProjectRegistrationFormAnswer_responseId_formItemId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormAnswer_responseId_formItemId_deleted_key" ON "ProjectRegistrationFormAnswer"("responseId", "formItemId", "deletedAt");
