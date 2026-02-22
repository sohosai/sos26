-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('UNASSIGNED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InquiryCreatorRole" AS ENUM ('PROJECT', 'COMMITTEE');

-- CreateEnum
CREATE TYPE "InquiryAssigneeSide" AS ENUM ('PROJECT', 'COMMITTEE');

-- CreateEnum
CREATE TYPE "InquiryViewerScope" AS ENUM ('ALL', 'BUREAU', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "InquiryActivityType" AS ENUM ('ASSIGNEE_ADDED', 'ASSIGNEE_REMOVED', 'VIEWER_UPDATED', 'STATUS_RESOLVED', 'STATUS_REOPENED');

-- AlterEnum
ALTER TYPE "CommitteePermission" ADD VALUE 'INQUIRY_ADMIN';

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "createdById" TEXT NOT NULL,
    "creatorRole" "InquiryCreatorRole" NOT NULL,
    "projectId" TEXT NOT NULL,
    "relatedFormId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryAssignee" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "InquiryAssigneeSide" NOT NULL,
    "isCreator" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryViewer" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "scope" "InquiryViewerScope" NOT NULL,
    "bureauValue" "Bureau",
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryViewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryComment" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InquiryActivity" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "type" "InquiryActivityType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Inquiry_projectId_idx" ON "Inquiry"("projectId");

-- CreateIndex
CREATE INDEX "Inquiry_status_idx" ON "Inquiry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryAssignee_inquiryId_userId_key" ON "InquiryAssignee"("inquiryId", "userId");

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_relatedFormId_fkey" FOREIGN KEY ("relatedFormId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAssignee" ADD CONSTRAINT "InquiryAssignee_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAssignee" ADD CONSTRAINT "InquiryAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryViewer" ADD CONSTRAINT "InquiryViewer_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryViewer" ADD CONSTRAINT "InquiryViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryComment" ADD CONSTRAINT "InquiryComment_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryComment" ADD CONSTRAINT "InquiryComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryActivity" ADD CONSTRAINT "InquiryActivity_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryActivity" ADD CONSTRAINT "InquiryActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryActivity" ADD CONSTRAINT "InquiryActivity_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
