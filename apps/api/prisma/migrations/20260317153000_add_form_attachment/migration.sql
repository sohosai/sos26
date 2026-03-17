CREATE TABLE "FormAttachment" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormAttachment_formId_fileId_key" ON "FormAttachment"("formId", "fileId");
CREATE INDEX "FormAttachment_formId_idx" ON "FormAttachment"("formId");
CREATE INDEX "FormAttachment_fileId_idx" ON "FormAttachment"("fileId");

ALTER TABLE "FormAttachment" ADD CONSTRAINT "FormAttachment_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormAttachment" ADD CONSTRAINT "FormAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
