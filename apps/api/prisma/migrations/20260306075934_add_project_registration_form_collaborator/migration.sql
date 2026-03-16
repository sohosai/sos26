-- CreateTable
CREATE TABLE "ProjectRegistrationFormCollaborator" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRegistrationFormCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRegistrationFormCollaborator_formId_userId_key" ON "ProjectRegistrationFormCollaborator"("formId", "userId");

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormCollaborator" ADD CONSTRAINT "ProjectRegistrationFormCollaborator_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ProjectRegistrationForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormCollaborator" ADD CONSTRAINT "ProjectRegistrationFormCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
