/*
  Warnings:

  - A unique constraint covering the columns `[formDeliveryId]` on the table `FormResponse` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "FormResponse_formDeliveryId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "FormResponse_formDeliveryId_key" ON "FormResponse"("formDeliveryId");
