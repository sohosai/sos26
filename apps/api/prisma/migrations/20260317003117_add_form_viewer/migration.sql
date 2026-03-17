-- CreateTable
CREATE TABLE "FormViewer" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "scope" "ViewerScope" NOT NULL,
    "bureauValue" "Bureau",
    "userId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormViewer_formId_idx" ON "FormViewer"("formId");

-- CreateIndex
CREATE INDEX "FormViewer_userId_idx" ON "FormViewer"("userId");

-- CreateIndex
CREATE INDEX "FormViewer_deletedAt_idx" ON "FormViewer"("deletedAt");

-- AddForeignKey
ALTER TABLE "FormViewer" ADD CONSTRAINT "FormViewer_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormViewer" ADD CONSTRAINT "FormViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
