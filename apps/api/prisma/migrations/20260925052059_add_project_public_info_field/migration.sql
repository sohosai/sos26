-- CreateEnum
CREATE TYPE "ProjectPublicInfoField" AS ENUM ('DESCRIPTION', 'ICON', 'WEBSITE_URLS', 'X_IDS', 'INSTAGRAM_IDS', 'YOUTUBE_IDS');

-- CreateEnum
CREATE TYPE "ProjectPublicInfoModerationKind" AS ENUM ('HIDDEN', 'CORRECTED');

-- AlterTable
ALTER TABLE "ProjectPublicMapImage" ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProjectPublicInfoModeration" (
    "id" TEXT NOT NULL,
    "projectPublicInfoId" TEXT NOT NULL,
    "field" "ProjectPublicInfoField" NOT NULL,
    "kind" "ProjectPublicInfoModerationKind" NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPublicInfoModeration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPublicInfoModeration_projectPublicInfoId_field_kind_key" ON "ProjectPublicInfoModeration"("projectPublicInfoId", "field", "kind");

-- AddForeignKey
ALTER TABLE "ProjectPublicInfoModeration" ADD CONSTRAINT "ProjectPublicInfoModeration_projectPublicInfoId_fkey" FOREIGN KEY ("projectPublicInfoId") REFERENCES "ProjectPublicInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPublicInfoModeration" ADD CONSTRAINT "ProjectPublicInfoModeration_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
