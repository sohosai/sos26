-- AlterTable
ALTER TABLE "MapAppSetting" ADD COLUMN     "isSnsLinksEditable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ProjectPublicInfo" ADD COLUMN     "instagramUrl" VARCHAR(2048),
ADD COLUMN     "websiteUrl" VARCHAR(2048),
ADD COLUMN     "xUrl" VARCHAR(2048),
ADD COLUMN     "youtubeUrl" VARCHAR(2048);
