-- AlterTable
ALTER TABLE "ProjectPublicInfo" ADD COLUMN     "instagramIds" VARCHAR(30)[] DEFAULT ARRAY[]::VARCHAR(30)[],
ADD COLUMN     "websiteUrls" VARCHAR(2048)[] DEFAULT ARRAY[]::VARCHAR(2048)[],
ADD COLUMN     "xIds" VARCHAR(15)[] DEFAULT ARRAY[]::VARCHAR(15)[],
ADD COLUMN     "youtubeIds" VARCHAR(30)[] DEFAULT ARRAY[]::VARCHAR(30)[];

-- 既存の値を1件目として移す
UPDATE "ProjectPublicInfo"
SET "websiteUrls" = CASE WHEN "websiteUrl" IS NULL THEN ARRAY[]::VARCHAR(2048)[] ELSE ARRAY["websiteUrl"] END,
	"xIds" = CASE WHEN "xId" IS NULL THEN ARRAY[]::VARCHAR(15)[] ELSE ARRAY["xId"] END,
	"instagramIds" = CASE WHEN "instagramId" IS NULL THEN ARRAY[]::VARCHAR(30)[] ELSE ARRAY["instagramId"] END,
	"youtubeIds" = CASE WHEN "youtubeId" IS NULL THEN ARRAY[]::VARCHAR(30)[] ELSE ARRAY["youtubeId"] END;

-- AlterTable
ALTER TABLE "ProjectPublicInfo" DROP COLUMN "instagramId",
DROP COLUMN "websiteUrl",
DROP COLUMN "xId",
DROP COLUMN "youtubeId";
