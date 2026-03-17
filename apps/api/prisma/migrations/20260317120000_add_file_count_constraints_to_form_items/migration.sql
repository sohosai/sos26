ALTER TABLE "FormItem"
ADD COLUMN "constraintMinFiles" INTEGER,
ADD COLUMN "constraintMaxFiles" INTEGER;

ALTER TABLE "ProjectRegistrationFormItem"
ADD COLUMN "constraintMinFiles" INTEGER,
ADD COLUMN "constraintMaxFiles" INTEGER;
