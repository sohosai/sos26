-- INFORMATION (案内所運営部会) を廃止し、既存データを INFO_SYSTEM へ移行
UPDATE "CommitteeMember" SET "Bureau" = 'INFO_SYSTEM' WHERE "Bureau" = 'INFORMATION';
UPDATE "FormViewer" SET "bureauValue" = 'INFO_SYSTEM' WHERE "bureauValue" = 'INFORMATION';
UPDATE "InquiryViewer" SET "bureauValue" = 'INFO_SYSTEM' WHERE "bureauValue" = 'INFORMATION';
UPDATE "MastersheetColumnViewer" SET "bureauValue" = 'INFO_SYSTEM' WHERE "bureauValue" = 'INFORMATION';

CREATE TYPE "Bureau_new" AS ENUM (
  'FINANCE',
  'GENERAL_AFFAIRS',
  'PUBLIC_RELATIONS',
  'EXTERNAL',
  'PROMOTION',
  'PLANNING',
  'STAGE_MANAGEMENT',
  'HQ_PLANNING',
  'INFO_SYSTEM'
);

ALTER TABLE "CommitteeMember"
  ALTER COLUMN "Bureau" TYPE "Bureau_new"
  USING ("Bureau"::text::"Bureau_new");

ALTER TABLE "FormViewer"
  ALTER COLUMN "bureauValue" TYPE "Bureau_new"
  USING ("bureauValue"::text::"Bureau_new");

ALTER TABLE "InquiryViewer"
  ALTER COLUMN "bureauValue" TYPE "Bureau_new"
  USING ("bureauValue"::text::"Bureau_new");

ALTER TABLE "MastersheetColumnViewer"
  ALTER COLUMN "bureauValue" TYPE "Bureau_new"
  USING ("bureauValue"::text::"Bureau_new");

ALTER TYPE "Bureau" RENAME TO "Bureau_old";
ALTER TYPE "Bureau_new" RENAME TO "Bureau";
DROP TYPE "Bureau_old";
