/*
  Warnings:

  - You are about to drop the column `userId` on the `PushSubscription` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PushSubscription" DROP CONSTRAINT "PushSubscription_userId_fkey";

-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "userId";

-- CreateTable
CREATE TABLE "UserPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushSubscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPushSubscription_userId_idx" ON "UserPushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushSubscription_userId_pushSubscriptionId_key" ON "UserPushSubscription"("userId", "pushSubscriptionId");

-- AddForeignKey
ALTER TABLE "UserPushSubscription" ADD CONSTRAINT "UserPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushSubscription" ADD CONSTRAINT "UserPushSubscription_pushSubscriptionId_fkey" FOREIGN KEY ("pushSubscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
