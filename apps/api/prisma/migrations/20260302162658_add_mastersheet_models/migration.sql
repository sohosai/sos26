-- CreateEnum
CREATE TYPE "MastersheetColumnType" AS ENUM ('FORM_ITEM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MastersheetDataType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "MastersheetColumnVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

-- CreateTable
CREATE TABLE "MastersheetColumn" (
    "id" TEXT NOT NULL,
    "type" "MastersheetColumnType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "formItemId" TEXT,
    "dataType" "MastersheetDataType",
    "visibility" "MastersheetColumnVisibility",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastersheetColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetColumnOption" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "MastersheetColumnOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetCellValue" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastersheetCellValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetCellSelectedOption" (
    "id" TEXT NOT NULL,
    "cellId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "MastersheetCellSelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetOverride" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "fileUrl" TEXT,
    "isStale" BOOLEAN NOT NULL DEFAULT false,
    "editorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastersheetOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetOverrideSelectedOption" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "MastersheetOverrideSelectedOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetColumnViewer" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "scope" "ViewerScope" NOT NULL,
    "bureauValue" "Bureau",
    "userId" TEXT,

    CONSTRAINT "MastersheetColumnViewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetAccessRequest" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "decidedById" TEXT,
    "status" "ApprovalStatus" NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastersheetAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetEditHistory" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "editorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MastersheetEditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MastersheetView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MastersheetView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MastersheetColumn_createdById_idx" ON "MastersheetColumn"("createdById");

-- CreateIndex
CREATE INDEX "MastersheetColumn_formItemId_idx" ON "MastersheetColumn"("formItemId");

-- CreateIndex
CREATE INDEX "MastersheetColumnOption_columnId_idx" ON "MastersheetColumnOption"("columnId");

-- CreateIndex
CREATE INDEX "MastersheetCellValue_projectId_idx" ON "MastersheetCellValue"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MastersheetCellValue_columnId_projectId_key" ON "MastersheetCellValue"("columnId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MastersheetCellSelectedOption_cellId_optionId_key" ON "MastersheetCellSelectedOption"("cellId", "optionId");

-- CreateIndex
CREATE INDEX "MastersheetOverride_projectId_idx" ON "MastersheetOverride"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MastersheetOverride_columnId_projectId_key" ON "MastersheetOverride"("columnId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "MastersheetOverrideSelectedOption_overrideId_optionId_key" ON "MastersheetOverrideSelectedOption"("overrideId", "optionId");

-- CreateIndex
CREATE INDEX "MastersheetColumnViewer_columnId_idx" ON "MastersheetColumnViewer"("columnId");

-- CreateIndex
CREATE INDEX "MastersheetColumnViewer_userId_idx" ON "MastersheetColumnViewer"("userId");

-- CreateIndex
CREATE INDEX "MastersheetAccessRequest_columnId_idx" ON "MastersheetAccessRequest"("columnId");

-- CreateIndex
CREATE INDEX "MastersheetAccessRequest_requesterId_idx" ON "MastersheetAccessRequest"("requesterId");

-- CreateIndex
CREATE INDEX "MastersheetEditHistory_columnId_projectId_idx" ON "MastersheetEditHistory"("columnId", "projectId");

-- CreateIndex
CREATE INDEX "MastersheetView_createdById_idx" ON "MastersheetView"("createdById");

-- AddForeignKey
ALTER TABLE "MastersheetColumn" ADD CONSTRAINT "MastersheetColumn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetColumn" ADD CONSTRAINT "MastersheetColumn_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "FormItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetColumnOption" ADD CONSTRAINT "MastersheetColumnOption_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MastersheetColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetCellValue" ADD CONSTRAINT "MastersheetCellValue_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MastersheetColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetCellValue" ADD CONSTRAINT "MastersheetCellValue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetCellSelectedOption" ADD CONSTRAINT "MastersheetCellSelectedOption_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "MastersheetCellValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetCellSelectedOption" ADD CONSTRAINT "MastersheetCellSelectedOption_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MastersheetColumnOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetOverride" ADD CONSTRAINT "MastersheetOverride_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MastersheetColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetOverride" ADD CONSTRAINT "MastersheetOverride_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetOverride" ADD CONSTRAINT "MastersheetOverride_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetOverrideSelectedOption" ADD CONSTRAINT "MastersheetOverrideSelectedOption_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "MastersheetOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetColumnViewer" ADD CONSTRAINT "MastersheetColumnViewer_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MastersheetColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetColumnViewer" ADD CONSTRAINT "MastersheetColumnViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetAccessRequest" ADD CONSTRAINT "MastersheetAccessRequest_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MastersheetColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetAccessRequest" ADD CONSTRAINT "MastersheetAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetAccessRequest" ADD CONSTRAINT "MastersheetAccessRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetEditHistory" ADD CONSTRAINT "MastersheetEditHistory_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "MastersheetColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetEditHistory" ADD CONSTRAINT "MastersheetEditHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetEditHistory" ADD CONSTRAINT "MastersheetEditHistory_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MastersheetView" ADD CONSTRAINT "MastersheetView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
