-- AlterTable
ALTER TABLE "ProjectPublicInfo" ADD COLUMN     "youtubeId" VARCHAR(30);

-- 既存のチャンネルURLからハンドルを取り出して移す。
-- /@handle のほか、旧形式の /c/name・/user/name・/name も name をハンドルとして扱う。
-- 動画・再生リストなどチャンネル以外のURLは移さない。
UPDATE "ProjectPublicInfo"
SET "youtubeId" = substring(
	"youtubeUrl"
	FROM '^https?://(?:www\.|m\.)?youtube\.com/(?:@|c/|user/)?([A-Za-z0-9._-]{3,30})/?(?:[?#].*)?$'
)
WHERE "youtubeUrl" IS NOT NULL
	AND substring(
		"youtubeUrl"
		FROM '^https?://(?:www\.|m\.)?youtube\.com/(?:@|c/|user/)?([A-Za-z0-9._-]{3,30})/?(?:[?#].*)?$'
	) NOT IN ('watch', 'playlist', 'shorts', 'live', 'channel', 'results', 'feed', 'embed', 'hashtag');

-- AlterTable
ALTER TABLE "ProjectPublicInfo" DROP COLUMN "youtubeUrl";
