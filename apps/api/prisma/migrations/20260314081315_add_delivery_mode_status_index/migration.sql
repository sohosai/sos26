-- CreateIndex
CREATE INDEX "FormAuthorization_deliveryMode_status_scheduledSendAt_idx" ON "FormAuthorization"("deliveryMode", "status", "scheduledSendAt");

-- CreateIndex
CREATE INDEX "NoticeAuthorization_deliveryMode_status_deliveredAt_idx" ON "NoticeAuthorization"("deliveryMode", "status", "deliveredAt");
