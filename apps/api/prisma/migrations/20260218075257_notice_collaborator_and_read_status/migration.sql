/*
  Warnings:

  - You are about to drop the `NoticeShare` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "NoticeShare" DROP CONSTRAINT "NoticeShare_noticeId_fkey";

-- DropForeignKey
ALTER TABLE "NoticeShare" DROP CONSTRAINT "NoticeShare_userId_fkey";

-- DropTable
DROP TABLE "NoticeShare";

-- CreateTable
CREATE TABLE "NoticeCollaborator" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeReadStatus" (
    "id" TEXT NOT NULL,
    "noticeDeliveryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeReadStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoticeCollaborator_noticeId_userId_key" ON "NoticeCollaborator"("noticeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeReadStatus_noticeDeliveryId_userId_key" ON "NoticeReadStatus"("noticeDeliveryId", "userId");

-- AddForeignKey
ALTER TABLE "NoticeCollaborator" ADD CONSTRAINT "NoticeCollaborator_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeCollaborator" ADD CONSTRAINT "NoticeCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeReadStatus" ADD CONSTRAINT "NoticeReadStatus_noticeDeliveryId_fkey" FOREIGN KEY ("noticeDeliveryId") REFERENCES "NoticeDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeReadStatus" ADD CONSTRAINT "NoticeReadStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
