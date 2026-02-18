-- CreateEnum
CREATE TYPE "FormItemType" AS ENUM ('TEXT', 'TEXTAREA', 'SELECT', 'CHECKBOX', 'NUMBER', 'FILE');

-- CreateEnum
CREATE TYPE "FormAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '無題のフォーム',
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormItem" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FormItemType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormItemOption" (
    "id" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormShare" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAuthorization" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedToId" TEXT NOT NULL,
    "status" "FormAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "scheduledSendAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "allowLateResponse" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormDelivery" (
    "id" TEXT NOT NULL,
    "formAuthorizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormResponse" (
    "id" TEXT NOT NULL,
    "formDeliveryId" TEXT NOT NULL,
    "respondentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAnswer" (
    "id" TEXT NOT NULL,
    "formResponseId" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormAnswerSelectedOption" (
    "id" TEXT NOT NULL,
    "formAnswerId" TEXT NOT NULL,
    "formItemOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAnswerSelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormItem_formId_idx" ON "FormItem"("formId");

-- CreateIndex
CREATE INDEX "FormItemOption_formItemId_idx" ON "FormItemOption"("formItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FormShare_formId_userId_key" ON "FormShare"("formId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FormDelivery_formAuthorizationId_projectId_key" ON "FormDelivery"("formAuthorizationId", "projectId");

-- CreateIndex
CREATE INDEX "FormResponse_formDeliveryId_idx" ON "FormResponse"("formDeliveryId");

-- CreateIndex
CREATE INDEX "FormResponse_respondentId_idx" ON "FormResponse"("respondentId");

-- CreateIndex
CREATE INDEX "FormAnswer_formResponseId_idx" ON "FormAnswer"("formResponseId");

-- CreateIndex
CREATE INDEX "FormAnswer_formItemId_idx" ON "FormAnswer"("formItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FormAnswer_formResponseId_formItemId_key" ON "FormAnswer"("formResponseId", "formItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FormAnswerSelectedOption_formAnswerId_formItemOptionId_key" ON "FormAnswerSelectedOption"("formAnswerId", "formItemOptionId");

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItem" ADD CONSTRAINT "FormItem_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormItemOption" ADD CONSTRAINT "FormItemOption_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "FormItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormShare" ADD CONSTRAINT "FormShare_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormShare" ADD CONSTRAINT "FormShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAuthorization" ADD CONSTRAINT "FormAuthorization_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAuthorization" ADD CONSTRAINT "FormAuthorization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAuthorization" ADD CONSTRAINT "FormAuthorization_requestedToId_fkey" FOREIGN KEY ("requestedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDelivery" ADD CONSTRAINT "FormDelivery_formAuthorizationId_fkey" FOREIGN KEY ("formAuthorizationId") REFERENCES "FormAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDelivery" ADD CONSTRAINT "FormDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_formDeliveryId_fkey" FOREIGN KEY ("formDeliveryId") REFERENCES "FormDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_formResponseId_fkey" FOREIGN KEY ("formResponseId") REFERENCES "FormResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswer" ADD CONSTRAINT "FormAnswer_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "FormItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswerSelectedOption" ADD CONSTRAINT "FormAnswerSelectedOption_formAnswerId_fkey" FOREIGN KEY ("formAnswerId") REFERENCES "FormAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormAnswerSelectedOption" ADD CONSTRAINT "FormAnswerSelectedOption_formItemOptionId_fkey" FOREIGN KEY ("formItemOptionId") REFERENCES "FormItemOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
