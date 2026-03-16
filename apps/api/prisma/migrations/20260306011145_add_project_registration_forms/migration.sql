-- CreateEnum
CREATE TYPE "ProjectRegistrationFormAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommitteePermission" ADD VALUE 'PROJECT_REGISTRATION_FORM_CREATE';
ALTER TYPE "CommitteePermission" ADD VALUE 'PROJECT_REGISTRATION_FORM_DELIVER';

-- CreateTable
CREATE TABLE "ProjectRegistrationForm" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '無題の企画登録フォーム',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "filterTypes" "ProjectType"[],
    "filterLocations" "ProjectLocation"[],
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItem" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "FormItemType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationFormItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormItemOption" (
    "id" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationFormItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormAuthorization" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedToId" TEXT NOT NULL,
    "status" "ProjectRegistrationFormAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationFormAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationFormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationFormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRegistrationFormAnswerSelectedOption" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "formItemOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectRegistrationFormAnswerSelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRegistrationForm_ownerId_idx" ON "ProjectRegistrationForm"("ownerId");

-- CreateIndex
CREATE INDEX "ProjectRegistrationForm_isActive_idx" ON "ProjectRegistrationForm"("isActive");

-- CreateIndex
CREATE INDEX "ProjectRegistrationForm_deletedAt_idx" ON "ProjectRegistrationForm"("deletedAt");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItem_formId_idx" ON "ProjectRegistrationFormItem"("formId");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormItemOption_formItemId_idx" ON "ProjectRegistrationFormItemOption"("formItemId");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormAuthorization_formId_status_idx" ON "ProjectRegistrationFormAuthorization"("formId", "status");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormResponse_projectId_idx" ON "ProjectRegistrationFormResponse"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormResponse_formId_projectId_key" ON "ProjectRegistrationFormResponse"("formId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectRegistrationFormAnswer_responseId_idx" ON "ProjectRegistrationFormAnswer"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormAnswer_responseId_formItemId_key" ON "ProjectRegistrationFormAnswer"("responseId", "formItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormAnswerSelectedOption_answerId_formIt_key" ON "ProjectRegistrationFormAnswerSelectedOption"("answerId", "formItemOptionId");

-- AddForeignKey
ALTER TABLE "ProjectRegistrationForm" ADD CONSTRAINT "ProjectRegistrationForm_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItem" ADD CONSTRAINT "ProjectRegistrationFormItem_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ProjectRegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormItemOption" ADD CONSTRAINT "ProjectRegistrationFormItemOption_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "ProjectRegistrationFormItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAuthorization" ADD CONSTRAINT "ProjectRegistrationFormAuthorization_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ProjectRegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAuthorization" ADD CONSTRAINT "ProjectRegistrationFormAuthorization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAuthorization" ADD CONSTRAINT "ProjectRegistrationFormAuthorization_requestedToId_fkey" FOREIGN KEY ("requestedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormResponse" ADD CONSTRAINT "ProjectRegistrationFormResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ProjectRegistrationForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormResponse" ADD CONSTRAINT "ProjectRegistrationFormResponse_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswer" ADD CONSTRAINT "ProjectRegistrationFormAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ProjectRegistrationFormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswer" ADD CONSTRAINT "ProjectRegistrationFormAnswer_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "ProjectRegistrationFormItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswerSelectedOption" ADD CONSTRAINT "ProjectRegistrationFormAnswerSelectedOption_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "ProjectRegistrationFormAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswerSelectedOption" ADD CONSTRAINT "ProjectRegistrationFormAnswerSelectedOption_formItemOption_fkey" FOREIGN KEY ("formItemOptionId") REFERENCES "ProjectRegistrationFormItemOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
