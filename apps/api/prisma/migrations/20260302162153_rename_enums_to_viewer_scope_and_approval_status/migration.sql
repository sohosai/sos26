/*
  Warnings:

  - The `status` column on the `FormAuthorization` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `scope` on the `InquiryViewer` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ViewerScope" AS ENUM ('ALL', 'BUREAU', 'INDIVIDUAL');

-- AlterTable
ALTER TABLE "FormAuthorization" DROP COLUMN "status",
ADD COLUMN     "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "InquiryViewer" DROP COLUMN "scope",
ADD COLUMN     "scope" "ViewerScope" NOT NULL;

-- DropEnum
DROP TYPE "FormAuthorizationStatus";

-- DropEnum
DROP TYPE "InquiryViewerScope";
