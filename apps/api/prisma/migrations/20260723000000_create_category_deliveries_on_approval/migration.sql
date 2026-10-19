-- Add a projectId index for project-side form delivery lookups.
CREATE INDEX "FormDelivery_projectId_idx" ON "FormDelivery"("projectId");

-- Backfill deliveries for already-approved category form authorizations.
INSERT INTO "FormDelivery" ("id", "formAuthorizationId", "projectId", "createdAt")
SELECT
    'c' || substr(md5('formDelivery:' || fa."id" || ':' || p."id"), 1, 24),
    fa."id",
    p."id",
    now()
FROM "FormAuthorization" fa
JOIN "Form" f ON f."id" = fa."formId"
JOIN "Project" p ON p."deletedAt" IS NULL
WHERE
    fa."deliveryMode" = 'CATEGORY'
    AND fa."status" = 'APPROVED'
    AND f."deletedAt" IS NULL
    AND (cardinality(fa."filterTypes") = 0 OR p."type" = ANY(fa."filterTypes"))
    AND (
        cardinality(fa."filterLocations") = 0
        OR p."location" = ANY(fa."filterLocations")
    )
ON CONFLICT ("formAuthorizationId", "projectId") DO NOTHING;

-- Backfill deliveries for already-approved category notice authorizations.
INSERT INTO "NoticeDelivery" ("id", "noticeAuthorizationId", "projectId", "createdAt")
SELECT
    'c' || substr(md5('noticeDelivery:' || na."id" || ':' || p."id"), 1, 24),
    na."id",
    p."id",
    now()
FROM "NoticeAuthorization" na
JOIN "Notice" n ON n."id" = na."noticeId"
JOIN "Project" p ON p."deletedAt" IS NULL
WHERE
    na."deliveryMode" = 'CATEGORY'
    AND na."status" = 'APPROVED'
    AND n."deletedAt" IS NULL
    AND (cardinality(na."filterTypes") = 0 OR p."type" = ANY(na."filterTypes"))
    AND (
        cardinality(na."filterLocations") = 0
        OR p."location" = ANY(na."filterLocations")
    )
ON CONFLICT ("noticeAuthorizationId", "projectId") DO NOTHING;
