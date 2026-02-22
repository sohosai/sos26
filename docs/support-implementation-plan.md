# お問い合わせ機能 実装計画

本ドキュメントは [support-spec.md](./support-spec.md) の仕様に基づく実装計画である。

---

## フェーズ一覧

| フェーズ | 内容 | 依存 |
|---------|------|------|
| 1 | DB スキーマ + マイグレーション | なし |
| 2 | 共有スキーマ・エンドポイント定義 (packages/shared) | フェーズ 1 |
| 3 | API 実装 (apps/api) | フェーズ 2 |
| 4 | フロントエンド API クライアント (apps/web) | フェーズ 2 |
| 5 | フロントエンド UI 改修 (モック → 実 API 接続) | フェーズ 3, 4 |
| 6 | テスト | フェーズ 3, 4, 5 |
| 7 | フォーム紐づけ対応 | フェーズ 1〜6 + フォーム機能完成 |

> **注意**: フォーム機能が未完成のため、関連フォームの選択・初期対応ルール（フォームオーナー自動割り当て等）はフェーズ 7 で対応する。フェーズ 1〜6 では `relatedFormId` カラムは定義するが、フォーム関連ロジックは実装しない。

---

## フェーズ 1: DB スキーマ + マイグレーション

### 変更ファイル

- `apps/api/prisma/schema.prisma`

### 作業内容

#### 1-1. Enum 追加

```prisma
enum InquiryStatus {
  UNASSIGNED
  IN_PROGRESS
  RESOLVED
}

enum InquiryCreatorRole {
  PROJECT
  COMMITTEE
}

enum InquiryAssigneeSide {
  PROJECT
  COMMITTEE
}

enum InquiryViewerScope {
  ALL
  BUREAU
  INDIVIDUAL
}

enum InquiryActivityType {
  ASSIGNEE_ADDED
  ASSIGNEE_REMOVED
  VIEWER_UPDATED
  STATUS_RESOLVED
  STATUS_REOPENED
}
```

#### 1-2. CommitteePermission に INQUIRY_ADMIN 追加

```prisma
enum CommitteePermission {
  MEMBER_EDIT
  NOTICE_DELIVER
  NOTICE_APPROVE
  FORM_DELIVER
  INQUIRY_ADMIN   // 追加
}
```

#### 1-3. モデル追加

- `Inquiry` - お問い合わせ本体（`relatedFormId` は nullable で定義）
- `InquiryAssignee` - 担当者（企画側・実委側）
- `InquiryViewer` - 閲覧者（スコープ付き）
- `InquiryComment` - コメント
- `InquiryActivity` - アクティビティログ

#### 1-4. リレーション追加

- `User` に `inquiries`, `inquiryAssignments`, `inquiryComments`, `inquiryActivities` リレーション追加
- `Project` に `inquiries` リレーション追加
- `Form` に `inquiries` リレーション追加（フェーズ 7 で使用）

#### 1-5. マイグレーション実行

```bash
bun run db:migrate
```

---

## フェーズ 2: 共有スキーマ・エンドポイント定義

### 変更ファイル

- `packages/shared/src/schemas/inquiry.ts` (新規)
- `packages/shared/src/endpoints/inquiry.ts` (新規)
- `packages/shared/src/index.ts` (再エクスポート追加)

### 作業内容

#### 2-1. Zod スキーマ定義 (`packages/shared/src/schemas/inquiry.ts`)

既存の notice.ts のパターンに準拠して以下を定義:

- `inquiryStatusSchema` - ステータス enum
- `inquirySchema` - お問い合わせ本体
- `inquiryAssigneeSchema` - 担当者
- `inquiryViewerSchema` - 閲覧者
- `inquiryCommentSchema` - コメント
- `inquiryActivitySchema` - アクティビティ
- 各エンドポイントの Request / Response スキーマ:
  - `createInquiryRequest/ResponseSchema`
  - `listInquiriesResponseSchema`
  - `getInquiryResponseSchema`
  - `addCommentRequest/ResponseSchema`
  - `updateStatusRequestSchema`
  - `addAssigneeRequestSchema`
  - `updateViewersRequestSchema`

#### 2-2. エンドポイント定義 (`packages/shared/src/endpoints/inquiry.ts`)

既存の notice.ts のパターンに準拠:

**企画側エンドポイント:**

| 名前 | メソッド | パス |
|------|---------|------|
| `listProjectInquiries` | GET | `/project/:projectId/inquiries` |
| `getProjectInquiry` | GET | `/project/:projectId/inquiries/:inquiryId` |
| `createProjectInquiry` | POST | `/project/:projectId/inquiries` |
| `addProjectInquiryComment` | POST | `/project/:projectId/inquiries/:inquiryId/comments` |
| `reopenProjectInquiry` | PATCH | `/project/:projectId/inquiries/:inquiryId/reopen` |
| `addProjectInquiryAssignee` | POST | `/project/:projectId/inquiries/:inquiryId/assignees` |
| `removeProjectInquiryAssignee` | DELETE | `/project/:projectId/inquiries/:inquiryId/assignees/:assigneeId` |

**実委側エンドポイント:**

| 名前 | メソッド | パス |
|------|---------|------|
| `listCommitteeInquiries` | GET | `/committee/inquiries` |
| `getCommitteeInquiry` | GET | `/committee/inquiries/:inquiryId` |
| `createCommitteeInquiry` | POST | `/committee/inquiries` |
| `addCommitteeInquiryComment` | POST | `/committee/inquiries/:inquiryId/comments` |
| `updateCommitteeInquiryStatus` | PATCH | `/committee/inquiries/:inquiryId/status` |
| `reopenCommitteeInquiry` | PATCH | `/committee/inquiries/:inquiryId/reopen` |
| `addCommitteeInquiryAssignee` | POST | `/committee/inquiries/:inquiryId/assignees` |
| `removeCommitteeInquiryAssignee` | DELETE | `/committee/inquiries/:inquiryId/assignees/:assigneeId` |
| `updateCommitteeInquiryViewers` | PUT | `/committee/inquiries/:inquiryId/viewers` |

#### 2-3. index.ts に再エクスポート追加

---

## フェーズ 3: API 実装

### 変更ファイル

- `apps/api/src/routes/project-inquiry.ts` (新規)
- `apps/api/src/routes/committee-inquiry.ts` (新規)
- `apps/api/src/index.ts` (ルートマウント追加)

### 作業内容

#### 3-1. 共通ヘルパー: 権限チェック関数

各エンドポイントで使用する権限チェックロジックを route ファイル内に定義:

- `isInquiryAdmin(committeeMemberId)` - INQUIRY_ADMIN 権限チェック
- `isCommitteeAssignee(inquiryId, userId)` - 実委側担当者チェック
- `isProjectAssignee(inquiryId, userId)` - 企画側担当者チェック
- `canViewInquiry(inquiryId, userId, committeeMember)` - 閲覧権限チェック（仕様 9 章の判定ロジック）

#### 3-2. 企画側ルート (`project-inquiry.ts`)

ミドルウェア: `requireAuth` → `requireProjectMember`

| エンドポイント | 主なロジック |
|--------------|------------|
| POST `/` (作成) | Inquiry + InquiryAssignee(creator, PROJECT) 作成。relatedFormId は null 固定（フェーズ 7 で対応）。実委担当者なしのため UNASSIGNED |
| GET `/` (一覧) | 自分が企画側担当者の Inquiry を取得 |
| GET `/:inquiryId` (詳細) | 企画側担当者チェック → Inquiry + Assignees + Comments + Activities を返却 |
| POST `/:inquiryId/comments` (コメント) | 企画側担当者チェック + ステータス != RESOLVED チェック |
| PATCH `/:inquiryId/reopen` (再オープン) | 企画側担当者チェック + ステータス == RESOLVED チェック → IN_PROGRESS に変更 + Activity 記録 |
| POST `/:inquiryId/assignees` (担当者追加) | 企画側担当者チェック + 追加対象が同企画メンバーかチェック |
| DELETE `/:inquiryId/assignees/:assigneeId` (担当者削除) | 企画側担当者チェック + isCreator == false チェック |

#### 3-3. 実委側ルート (`committee-inquiry.ts`)

ミドルウェア: `requireAuth` → `requireCommitteeMember`

| エンドポイント | 主なロジック |
|--------------|------------|
| POST `/` (作成) | Inquiry + InquiryAssignee(creator, COMMITTEE) + InquiryAssignee(企画側担当者, PROJECT) 作成。企画側担当者は必須 |
| GET `/` (一覧) | 管理者: 全件 / 担当者: 自分が担当のもの / 閲覧者: 閲覧可能なもの。フィルタリングは canViewInquiry で |
| GET `/:inquiryId` (詳細) | 閲覧権限チェック → 全データ返却 |
| POST `/:inquiryId/comments` (コメント) | 担当者 or 管理者チェック + RESOLVED チェック |
| PATCH `/:inquiryId/status` (解決済みに) | 担当者 or 管理者チェック → RESOLVED に変更 + Activity 記録 |
| PATCH `/:inquiryId/reopen` (再オープン) | 担当者 or 管理者チェック → IN_PROGRESS に変更 + Activity 記録 |
| POST `/:inquiryId/assignees` (担当者追加) | 担当者 or 管理者チェック。実委側担当者追加時に UNASSIGNED → IN_PROGRESS 自動遷移 |
| DELETE `/:inquiryId/assignees/:assigneeId` (削除) | 担当者 or 管理者チェック + isCreator == false チェック |
| PUT `/:inquiryId/viewers` (閲覧者設定) | 担当者 or 管理者チェック → 既存の InquiryViewer を全削除 → 新規作成 |

#### 3-4. ルートマウント (`apps/api/src/index.ts`)

```typescript
app.route("/project/:projectId/inquiries", projectInquiryRoute);
app.route("/committee/inquiries", committeeInquiryRoute);
```

---

## フェーズ 4: フロントエンド API クライアント

### 変更ファイル

- `apps/web/src/lib/api/project-inquiry.ts` (新規)
- `apps/web/src/lib/api/committee-inquiry.ts` (新規)

### 作業内容

既存の `committee-notice.ts` のパターンに準拠して、各エンドポイントの API クライアント関数を作成。

---

## フェーズ 5: フロントエンド UI 改修

### 変更ファイル

- `apps/web/src/routes/committee/support/index.tsx` (改修)
- `apps/web/src/routes/committee/support/$inquiryId.tsx` (改修)
- `apps/web/src/routes/project/support/index.tsx` (改修)
- `apps/web/src/routes/project/support/$inquiryId.tsx` (改修)
- `apps/web/src/components/support/SupportList.tsx` (改修)
- `apps/web/src/components/support/SupportDetail.tsx` (改修)
- `apps/web/src/components/support/NewInquiryForm.tsx` (改修)
- `apps/web/src/mock/support.ts` (削除)

### 作業内容

#### 5-1. Route ファイル改修

- `loader` で API クライアントからデータ取得に変更
- モック store (`useSupportStore`) の使用を全て API 呼び出しに置換
- 操作後は `router.invalidate()` でデータ再取得

#### 5-2. コンポーネント改修

**SupportList.tsx:**
- Props の型を API レスポンス型に合わせて変更
- ステータス表示を「新規」→「担当者未割り当て」に変更
- 実委側: タブ「未完了」「解決済み」+ セクション構成に変更

**SupportDetail.tsx:**
- Props の型を API レスポンス型に合わせて変更
- 閲覧者設定セクションを追加（実委側のみ表示）
  - スコープ選択 UI: 全員 / 特定局（局の複数選択）/ 個人（ユーザー検索）
- 操作関数を API 呼び出しに変更
- 企画側担当者の追加・削除 UI を追加
- 作成者の担当者削除ボタンを非表示

**NewInquiryForm.tsx:**
- Props の型を API レスポンス型に合わせて変更
- 関連フォーム選択 UI は非表示（フェーズ 7 で対応）

#### 5-3. モック削除

- `apps/web/src/mock/support.ts` を削除

---

## フェーズ 6: テスト

### 変更ファイル

- `packages/shared/src/schemas/inquiry.test.ts` (新規)
- `apps/api/src/routes/committee-inquiry.test.ts` (新規)
- `apps/api/src/routes/project-inquiry.test.ts` (新規)

### 作業内容

#### 6-1. スキーマテスト

- 各 Zod スキーマの parse / safeParse テスト

#### 6-2. API テスト

**権限テスト (最重要):**
- お問い合わせ管理者は全件閲覧可能
- 担当者は自分の担当のみ閲覧可能
- 閲覧者はスコープに基づいて閲覧可能
- 権限のない実委人は閲覧不可
- 企画側担当者は自分の担当のみ閲覧可能

**操作テスト:**
- お問い合わせ作成（企画側・実委側）
- コメント追加（権限あり・なし）
- ステータス変更（解決済み、再オープン）
- 担当者追加・削除（作成者削除不可のチェック含む）
- 閲覧者設定（全スコープ）

---

## フェーズ 7: フォーム紐づけ対応

> **前提**: フォーム機能が完成していること

### 作業内容

#### 7-1. API 改修

- 企画側作成時: `relatedFormId` を受け付けるようにする（自企画に配信されたフォームのみ）
- 実委側作成時: `relatedFormId` を受け付けるようにする（フォーム一覧から選択）
- 初期対応ルールの実装:
  - フォームオーナーを実委側の初期担当者として自動割り当て → ステータスを IN_PROGRESS に
  - フォームの共同編集者を初期の閲覧者（個人スコープ）として自動割り当て

#### 7-2. 共有スキーマ改修

- 作成リクエストスキーマに `relatedFormId` を追加
- レスポンスに関連フォーム情報を含める

#### 7-3. フロントエンド改修

- NewInquiryForm: 関連フォーム選択 UI を有効化
- SupportDetail: 関連フォームのリンク表示

#### 7-4. テスト追加

- 初期対応ルール（フォームオーナー自動割り当て、共同編集者の閲覧者設定）

---

## 実装順序の推奨

フェーズ 1 → 2 → 3 & 4（並行可） → 5 → 6 → 7（フォーム完成後）

フェーズ 3 と 4 は並行作業可能だが、共有スキーマ（フェーズ 2）の完了が前提。
フェーズ 5 はフロントエンドの改修量が最も大きいため、コンポーネント単位で段階的に進めることを推奨する。
フェーズ 7 はフォーム機能の完成を待って着手する。
