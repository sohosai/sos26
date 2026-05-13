ALTER TABLE "Inquiry" ADD COLUMN "sentAt" TIMESTAMP(3);

-- 既存データの互換性: 送信済みのお問い合わせは createdAt を sentAt に移す
UPDATE "Inquiry"
SET "sentAt" = "createdAt"
WHERE "isDraft" = FALSE
  AND "sentAt" IS NULL;
