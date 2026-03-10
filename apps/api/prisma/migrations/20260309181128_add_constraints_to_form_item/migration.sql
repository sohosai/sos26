-- AlterTable
ALTER TABLE "FormItem" ADD COLUMN     "constraintCustomPattern" TEXT,
ADD COLUMN     "constraintMaxLength" INTEGER,
ADD COLUMN     "constraintMinLength" INTEGER,
ADD COLUMN     "constraintPattern" TEXT;
