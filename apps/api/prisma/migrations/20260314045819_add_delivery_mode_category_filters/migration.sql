-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('INDIVIDUAL', 'CATEGORY');

-- AlterTable
ALTER TABLE "FormAuthorization" ADD COLUMN     "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "filterLocations" "ProjectLocation"[],
ADD COLUMN     "filterTypes" "ProjectType"[];

-- AlterTable
ALTER TABLE "NoticeAuthorization" ADD COLUMN     "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "filterLocations" "ProjectLocation"[],
ADD COLUMN     "filterTypes" "ProjectType"[];
