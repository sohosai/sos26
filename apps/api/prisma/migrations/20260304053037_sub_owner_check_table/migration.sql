-- CreateEnum
CREATE TYPE "SubOwnerRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProjectSubOwnerRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubOwnerRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSubOwnerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSubOwnerRequest_projectId_idx" ON "ProjectSubOwnerRequest"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSubOwnerRequest_userId_idx" ON "ProjectSubOwnerRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSubOwnerRequest_projectId_userId_status_key" ON "ProjectSubOwnerRequest"("projectId", "userId", "status");

-- AddForeignKey
ALTER TABLE "ProjectSubOwnerRequest" ADD CONSTRAINT "ProjectSubOwnerRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSubOwnerRequest" ADD CONSTRAINT "ProjectSubOwnerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
