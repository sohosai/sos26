/*
  Warnings:

  - You are about to drop the column `draftCreatedById` on the `InquiryComment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InquiryComment" DROP COLUMN "draftCreatedById";
