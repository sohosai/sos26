-- CreateEnum
CREATE TYPE "ProjectRegistrationFormItemEditHistoryTrigger" AS ENUM ('PROJECT_SUBMIT', 'PROJECT_RESUBMIT', 'COMMITTEE_EDIT', 'MASTERSHEET_EDIT');

-- AlterTable
ALTER TABLE "Inquiry" DROP COLUMN "sentAt";

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItemEditHistory" (
    "id" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "actorId" TEXT NOT NULL,
    "trigger" "ProjectRegistrationFormItemEditHistoryTrigger" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRegistrationFormItemEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItemEditHistoryFile" (
    "id" TEXT NOT NULL,
    "editHistoryId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRegistrationFormItemEditHistoryFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" (
    "id" TEXT NOT NULL,
    "editHistoryId" TEXT NOT NULL,
    "formItemOptionId" TEXT NOT NULL,

    CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItemEditHistory_formItemId_projectId_idx" ON "ProjectRegistrationFormItemEditHistory"("formItemId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItemEditHistory_actorId_idx" ON "ProjectRegistrationFormItemEditHistory"("actorId");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItemEditHistoryFile_fileId_idx" ON "ProjectRegistrationFormItemEditHistoryFile"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormItemEditHistoryFile_editHistoryId_fi_key" ON "ProjectRegistrationFormItemEditHistoryFile"("editHistoryId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormItemEditHistoryFile_editHistoryId_so_key" ON "ProjectRegistrationFormItemEditHistoryFile"("editHistoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormItemEditHistorySelectedOption_editHi_key" ON "ProjectRegistrationFormItemEditHistorySelectedOption"("editHistoryId", "formItemOptionId");

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistory_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "ProjectRegistrationFormItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistoryFile" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistoryFile_editHistoryId_fkey" FOREIGN KEY ("editHistoryId") REFERENCES "ProjectRegistrationFormItemEditHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistoryFile" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistoryFile_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_editH_fkey" FOREIGN KEY ("editHistoryId") REFERENCES "ProjectRegistrationFormItemEditHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" ADD CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_formI_fkey" FOREIGN KEY ("formItemOptionId") REFERENCES "ProjectRegistrationFormItemOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
