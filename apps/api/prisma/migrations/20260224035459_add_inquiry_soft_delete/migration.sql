/*
  Warnings:

  - A unique constraint covering the columns `[inquiryId,userId,deletedAt]` on the table `InquiryAssignee` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "InquiryAssignee_inquiryId_userId_key";

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InquiryActivity" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InquiryAssignee" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InquiryComment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InquiryViewer" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Inquiry_deletedAt_idx" ON "Inquiry"("deletedAt");

-- CreateIndex
CREATE INDEX "InquiryActivity_deletedAt_idx" ON "InquiryActivity"("deletedAt");

-- CreateIndex
CREATE INDEX "InquiryAssignee_inquiryId_idx" ON "InquiryAssignee"("inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryAssignee_inquiryId_userId_deletedAt_key" ON "InquiryAssignee"("inquiryId", "userId", "deletedAt");

-- CreateIndex
CREATE INDEX "InquiryComment_deletedAt_idx" ON "InquiryComment"("deletedAt");

-- CreateIndex
CREATE INDEX "InquiryViewer_deletedAt_idx" ON "InquiryViewer"("deletedAt");
