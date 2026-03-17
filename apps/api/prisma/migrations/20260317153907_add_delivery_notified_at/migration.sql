-- AlterTable
ALTER TABLE "FormAuthorization" ADD COLUMN     "deliveryNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FormAuthorization_status_scheduledSendAt_deliveryNotifiedAt_idx" ON "FormAuthorization"("status", "scheduledSendAt", "deliveryNotifiedAt");

-- AlterTable
ALTER TABLE "NoticeAuthorization" ADD COLUMN     "deliveryNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NoticeAuthorization_status_deliveredAt_deliveryNotifiedAt_idx" ON "NoticeAuthorization"("status", "deliveredAt", "deliveryNotifiedAt");
