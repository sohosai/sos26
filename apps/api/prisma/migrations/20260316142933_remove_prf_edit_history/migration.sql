/*
  Warnings:

  - You are about to drop the `ProjectRegistrationFormItemEditHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectRegistrationFormItemEditHistorySelectedOption` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" DROP CONSTRAINT "ProjectRegistrationFormItemEditHistory_actorId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" DROP CONSTRAINT "ProjectRegistrationFormItemEditHistory_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistory" DROP CONSTRAINT "ProjectRegistrationFormItemEditHistory_projectRegistration_fkey";

-- DropForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" DROP CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_editH_fkey";

-- DropForeignKey
ALTER TABLE "ProjectRegistrationFormItemEditHistorySelectedOption" DROP CONSTRAINT "ProjectRegistrationFormItemEditHistorySelectedOption_proje_fkey";

-- DropTable
DROP TABLE "ProjectRegistrationFormItemEditHistory";

-- DropTable
DROP TABLE "ProjectRegistrationFormItemEditHistorySelectedOption";

-- DropEnum
DROP TYPE "ProjectRegistrationFormItemEditHistoryTrigger";
