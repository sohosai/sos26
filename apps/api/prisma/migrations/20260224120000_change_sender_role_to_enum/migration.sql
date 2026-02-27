-- AlterTable: InquiryComment.senderRole を String から InquiryCreatorRole Enum に変更
-- 既存データを USING で安全にキャストする

ALTER TABLE "InquiryComment"
  ALTER COLUMN "senderRole" DROP DEFAULT;

ALTER TABLE "InquiryComment"
  ALTER COLUMN "senderRole" TYPE "InquiryCreatorRole"
  USING "senderRole"::"InquiryCreatorRole";

ALTER TABLE "InquiryComment"
  ALTER COLUMN "senderRole" SET DEFAULT 'PROJECT';
