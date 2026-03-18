-- CreateTable
CREATE TABLE "InquiryCommentReadStatus" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InquiryCommentReadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InquiryCommentReadStatus_inquiryId_userId_key" ON "InquiryCommentReadStatus"("inquiryId", "userId");

-- CreateIndex
CREATE INDEX "InquiryCommentReadStatus_userId_idx" ON "InquiryCommentReadStatus"("userId");

-- AddForeignKey
ALTER TABLE "InquiryCommentReadStatus" ADD CONSTRAINT "InquiryCommentReadStatus_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryCommentReadStatus" ADD CONSTRAINT "InquiryCommentReadStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
