-- CreateEnum
CREATE TYPE "OpenStatus" AS ENUM ('OPEN', 'CLOSED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "ProjectPublicInfo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "storeName" TEXT,
    "description" VARCHAR(400),
    "iconFileId" TEXT,
    "openStatus" "OpenStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "stockStatus" "StockStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPublicInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPublicMapImage" (
    "id" TEXT NOT NULL,
    "projectPublicInfoId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPublicMapImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MapAppSetting" (
    "id" TEXT NOT NULL DEFAULT 'GLOBAL',
    "isStoreNameEditable" BOOLEAN NOT NULL DEFAULT true,
    "isDescriptionEditable" BOOLEAN NOT NULL DEFAULT true,
    "isIconEditable" BOOLEAN NOT NULL DEFAULT true,
    "isMapImagesEditable" BOOLEAN NOT NULL DEFAULT true,
    "isOpenStatusEditable" BOOLEAN NOT NULL DEFAULT true,
    "isStockStatusEditable" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MapAppSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPublicInfo_projectId_key" ON "ProjectPublicInfo"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPublicMapImage_fileId_idx" ON "ProjectPublicMapImage"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPublicMapImage_projectPublicInfoId_fileId_key" ON "ProjectPublicMapImage"("projectPublicInfoId", "fileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPublicMapImage_projectPublicInfoId_sortOrder_key" ON "ProjectPublicMapImage"("projectPublicInfoId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProjectPublicInfo" ADD CONSTRAINT "ProjectPublicInfo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPublicInfo" ADD CONSTRAINT "ProjectPublicInfo_iconFileId_fkey" FOREIGN KEY ("iconFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPublicMapImage" ADD CONSTRAINT "ProjectPublicMapImage_projectPublicInfoId_fkey" FOREIGN KEY ("projectPublicInfoId") REFERENCES "ProjectPublicInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPublicMapImage" ADD CONSTRAINT "ProjectPublicMapImage_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
