/*
  Warnings:

  - The values [MASTERSHEET_EDIT] on the enum `ProjectRegistrationFormItemEditHistoryTrigger` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProjectRegistrationFormItemEditHistoryTrigger_new" AS ENUM ('PROJECT_SUBMIT', 'PROJECT_RESUBMIT', 'COMMITTEE_EDIT');
ALTER TABLE "ProjectRegistrationFormItemEditHistory" ALTER COLUMN "trigger" TYPE "ProjectRegistrationFormItemEditHistoryTrigger_new" USING ("trigger"::text::"ProjectRegistrationFormItemEditHistoryTrigger_new");
ALTER TYPE "ProjectRegistrationFormItemEditHistoryTrigger" RENAME TO "ProjectRegistrationFormItemEditHistoryTrigger_old";
ALTER TYPE "ProjectRegistrationFormItemEditHistoryTrigger_new" RENAME TO "ProjectRegistrationFormItemEditHistoryTrigger";
DROP TYPE "public"."ProjectRegistrationFormItemEditHistoryTrigger_old";
COMMIT;
