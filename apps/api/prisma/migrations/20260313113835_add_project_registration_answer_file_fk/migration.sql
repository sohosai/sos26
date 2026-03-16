-- CreateIndex
CREATE INDEX "ProjectRegistrationFormAnswer_fileId_idx" ON "ProjectRegistrationFormAnswer"("fileId");

-- AddForeignKey
ALTER TABLE "ProjectRegistrationFormAnswer" ADD CONSTRAINT "ProjectRegistrationFormAnswer_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
