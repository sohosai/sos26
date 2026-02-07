/*
  Warnings:

  - You are about to drop the column `isActive` on the `PushSubscription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PushSubscription" DROP COLUMN "isActive",
ADD COLUMN     "deletedAt" TIMESTAMP(3);
