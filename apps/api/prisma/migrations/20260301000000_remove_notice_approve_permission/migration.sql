-- NOTICE_APPROVE 権限レコードを削除
DELETE FROM "CommitteeMemberPermission" WHERE "permission" = 'NOTICE_APPROVE';

-- CommitteePermission enum から NOTICE_APPROVE を削除
CREATE TYPE "CommitteePermission_new" AS ENUM ('MEMBER_EDIT', 'NOTICE_DELIVER', 'FORM_DELIVER', 'INQUIRY_ADMIN');
ALTER TABLE "CommitteeMemberPermission" ALTER COLUMN "permission" TYPE "CommitteePermission_new" USING ("permission"::text::"CommitteePermission_new");
ALTER TYPE "CommitteePermission" RENAME TO "CommitteePermission_old";
ALTER TYPE "CommitteePermission_new" RENAME TO "CommitteePermission";
DROP TYPE "CommitteePermission_old";
