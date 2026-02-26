-- CreateIndex
CREATE INDEX "InquiryViewer_inquiryId_idx" ON "InquiryViewer"("inquiryId");

-- CreateIndex
CREATE INDEX "InquiryViewer_userId_idx" ON "InquiryViewer"("userId");

-- CreateIndex
CREATE INDEX "InquiryComment_inquiryId_idx" ON "InquiryComment"("inquiryId");

-- CreateIndex
CREATE INDEX "InquiryActivity_inquiryId_idx" ON "InquiryActivity"("inquiryId");
