-- CreateEnum
CREATE TYPE "SendKey" AS ENUM ('ENTER', 'CTRL_ENTER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarFileId" TEXT,
ADD COLUMN     "sendKey" "SendKey" NOT NULL DEFAULT 'ENTER';
