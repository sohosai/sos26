-- CreateTable
CREATE TABLE "InquiryAttachment" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "commentId" TEXT,
    "fileId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InquiryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InquiryAttachment_fileId_idx" ON "InquiryAttachment"("fileId");

-- CreateIndex
CREATE INDEX "InquiryAttachment_commentId_idx" ON "InquiryAttachment"("commentId");

-- CreateIndex
CREATE INDEX "InquiryAttachment_deletedAt_idx" ON "InquiryAttachment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InquiryAttachment_inquiryId_fileId_key" ON "InquiryAttachment"("inquiryId", "fileId");

-- AddForeignKey
ALTER TABLE "InquiryAttachment" ADD CONSTRAINT "InquiryAttachment_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAttachment" ADD CONSTRAINT "InquiryAttachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "InquiryComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryAttachment" ADD CONSTRAINT "InquiryAttachment_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
