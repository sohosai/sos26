-- CreateEnum
CREATE TYPE "CommitteePermission" AS ENUM ('MEMBER_EDIT', 'NOTICE_DELIVER', 'FORM_DELIVER');

-- CreateEnum
CREATE TYPE "NoticeAuthorizationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CommitteeMemberPermission" (
    "id" TEXT NOT NULL,
    "committeeMemberId" TEXT NOT NULL,
    "permission" "CommitteePermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeMemberPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '無題のお知らせ',
    "body" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeShare" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isWrite" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeAuthorization" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedToId" TEXT NOT NULL,
    "status" "NoticeAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeDelivery" (
    "id" TEXT NOT NULL,
    "noticeAuthorizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMemberPermission_committeeMemberId_permission_key" ON "CommitteeMemberPermission"("committeeMemberId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeShare_noticeId_userId_key" ON "NoticeShare"("noticeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoticeDelivery_noticeAuthorizationId_projectId_key" ON "NoticeDelivery"("noticeAuthorizationId", "projectId");

-- AddForeignKey
ALTER TABLE "CommitteeMemberPermission" ADD CONSTRAINT "CommitteeMemberPermission_committeeMemberId_fkey" FOREIGN KEY ("committeeMemberId") REFERENCES "CommitteeMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeShare" ADD CONSTRAINT "NoticeShare_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeShare" ADD CONSTRAINT "NoticeShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAuthorization" ADD CONSTRAINT "NoticeAuthorization_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAuthorization" ADD CONSTRAINT "NoticeAuthorization_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeAuthorization" ADD CONSTRAINT "NoticeAuthorization_requestedToId_fkey" FOREIGN KEY ("requestedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeDelivery" ADD CONSTRAINT "NoticeDelivery_noticeAuthorizationId_fkey" FOREIGN KEY ("noticeAuthorizationId") REFERENCES "NoticeAuthorization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeDelivery" ADD CONSTRAINT "NoticeDelivery_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
