-- AlterTable
ALTER TABLE "InquiryComment" ADD COLUMN     "draftCreatedById" TEXT,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;
