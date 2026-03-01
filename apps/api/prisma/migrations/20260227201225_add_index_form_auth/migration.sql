-- CreateIndex
CREATE INDEX "FormAuthorization_formId_createdAt_idx" ON "FormAuthorization"("formId", "createdAt" DESC);
