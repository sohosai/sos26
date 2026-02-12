# S3互換オブジェクトストレージ統合

## 概要

sos26にさくらのオブジェクトストレージ（S3互換）を統合し、汎用的なファイルアップロード基盤を構築する。

## アーキテクチャ

### アップロードフロー（全ファイル共通: Presigned PUT URL）

```
クライアント                    API                         S3
    │                          │                           │
    │ POST /files/upload-url   │                           │
    │ (fileName, mimeType,     │                           │
    │  size, isPublic)         │                           │
    │ ─────────────────────────>  認証チェック               │
    │                          │  バリデーション             │
    │                          │  Fileレコード作成(PENDING)  │
    │                          │  Presigned PUT URL生成      │
    │  { fileId, uploadUrl }   │                           │
    │ <─────────────────────────                           │
    │                          │                           │
    │ PUT uploadUrl + ファイル本体                          │
    │ ──────────────────────────────────────────────────────>
    │                          │                           │
    │ POST /files/:id/confirm  │                           │
    │ ─────────────────────────>  S3にオブジェクト存在確認   │
    │                          │  ステータス→CONFIRMED       │
    │  { file }                │                           │
    │ <─────────────────────────                           │
```

- 認証はAPI層で制御（Presigned PUT URLの発行にログイン必須）
- サーバーを経由せずクライアントがS3に直接アップロードするため、負荷が低い

### アクセスフロー（全ファイル共通: APIプロキシ）

```
クライアント                    API                         S3
    │                          │                           │
    │ GET /files/:id/content   │                           │
    │ ─────────────────────────>  公開ファイル→そのまま通過   │
    │                          │  非公開ファイル→認証チェック  │
    │                          │  S3からオブジェクト取得      │
    │                          │ <──────────────────────────
    │  ファイルデータ            │                           │
    │  + Cache-Control          │                           │
    │ <─────────────────────────                           │
```

ファイルの読み取りは**全てAPIプロキシ**（`GET /files/:id/content`）で配信する。

- `<img src="/api/files/{id}/content">`、`<iframe src="...">` で直接埋め込み可能
- 画像もPDFもプレビュー表示に対応
- `S3_MAX_FILE_SIZE` がデフォルト10MB上限なのでサーバー負荷は問題にならない
- `Cache-Control` ヘッダでブラウザキャッシュを効かせる
- S3側の公開設定（バケットポリシー・ACL）が一切不要

> **将来の拡張**: 公開ファイルが大量に増えてAPIプロキシの負荷が問題になった場合は、バケットポリシー（`public/` プレフィックスを公開読み取り可）方式に移行する。

### バケット構成

**単一バケット**を使用する。

```
バケット
└── {userId}/{uuid}.{ext}
```

- アクセス制御はAPI層で完結するため、バケットポリシーやACLの設定は不要
- 用途別にバケットを分ける必要もない（用途の区別はDB側のリレーションで管理）

### DBモデル設計

`File` テーブルは**ストレージの物理管理のみ**を担当する。「何のためのファイルか」は各機能側のテーブルからリレーションで参照する。

```
┌───────────────────────────────────────────────┐
│ File（ストレージの物理管理のみ）                  │
│  id, key, fileName, mimeType, size,            │
│  isPublic, status(PENDING/CONFIRMED),          │
│  uploadedById, deletedAt                       │
└──────────┬──────────────────────┬──────────────┘
           │                      │
    用途別テーブルからリレーションで参照
           │                      │
┌──────────┴──────────┐ ┌────────┴─────────────┐
│ User                 │ │ ProjectDocument       │
│  avatarId → File     │ │  fileId → File        │
│                      │ │  projectId → Project  │
│ （アバター）          │ │  label                │
└──────────────────────┘ │ （企画書類）           │
                         └──────────────────────┘
```

**メリット**:

| 観点 | 説明 |
|------|------|
| 関心の分離 | `File` はアップロード/ストレージの管理だけ。用途のロジックは各テーブルが持つ |
| 再利用性 | 同じアップロード基盤を全用途で共有できる |
| 柔軟性 | 新しい用途が増えても `File` テーブルは変更不要。紐づけテーブルを追加するだけ |
| クエリの直感性 | `user.avatar`、`project.documents` で直感的に取得 |

## エンドポイント一覧

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/files/upload-url` | POST | 必須 | Presigned PUT URL発行 + PENDINGレコード作成 |
| `/files/:id/confirm` | POST | 必須 | S3存在確認 → CONFIRMED更新 |
| `/files/:id/content` | GET | 公開→不要 / 非公開→必須 | APIプロキシでファイル配信 |
| `/files` | GET | 必須 | 自分のファイル一覧 |
| `/files/:id` | DELETE | 必須 | ソフトデリート |

## 実装ステップ

### Step 1: 依存パッケージの追加

`apps/api/package.json` に追加:

- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

### Step 2: 環境変数の追加

**変更: `apps/api/src/lib/env.ts`**

`envSchema` に以下を追加:

| 変数名 | 説明 |
|--------|------|
| `S3_ENDPOINT` | さくらのオブジェクトストレージのエンドポイントURL |
| `S3_REGION` | リージョン（デフォルト: `"jp-north-1"`） |
| `S3_BUCKET` | バケット名 |
| `S3_ACCESS_KEY_ID` | アクセスキー |
| `S3_SECRET_ACCESS_KEY` | シークレットキー |
| `S3_PRESIGNED_URL_EXPIRES` | 署名付きURLの有効期限秒（デフォルト: 3600） |
| `S3_MAX_FILE_SIZE` | 最大ファイルサイズ（バイト、デフォルト: 10MB） |

**変更: `apps/api/.env.example`** にも同様に追加

### Step 3: データベーススキーマ

**変更: `apps/api/prisma/schema.prisma`**

```prisma
enum FileStatus {
  PENDING     // URL発行済み、アップロード未確認
  CONFIRMED   // アップロード確認済み
}

model File {
  id           String       @id @default(cuid())
  key          String       @unique        // S3オブジェクトキー
  fileName     String                      // 元のファイル名
  mimeType     String
  size         Int                         // バイト
  isPublic     Boolean      @default(false)
  status       FileStatus   @default(PENDING)
  uploadedById String
  uploadedBy   User         @relation(fields: [uploadedById], references: [id])
  deletedAt    DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([uploadedById])
  @@index([status])
  @@index([deletedAt])
}
```

- User モデルに `files File[]` リレーションを追加
- `isPublic`: 公開ファイル（アバター等）は `true`、非公開（企画書類等）は `false`

### Step 4: ストレージサービス層（API）

既存の `apps/api/src/lib/push/` パターンに従い、`apps/api/src/lib/storage/` を作成。

| ファイル | 役割 |
|---------|------|
| `client.ts` | S3Client の初期化・取得（`initStorage()` / `getStorageClient()`） |
| `presign.ts` | Presigned PUT URL生成（`generateUploadUrl()`）、オブジェクト取得（`getObject()`）、オブジェクト存在確認（`objectExists()`） |
| `key.ts` | S3キー生成（`generateObjectKey()`）、拡張子取得（`getExtension()`） |
| `cleanup.ts` | 古いPENDINGレコードのクリーンアップ（`cleanupStalePendingFiles()`） |

S3キー構造: `{userId}/{uuid}.{ext}`

S3クライアント設定:

- `forcePathStyle: true`（S3互換ストレージ向け）
- カスタムendpoint（さくらのオブジェクトストレージ）

### Step 5: 共有スキーマ・エンドポイント定義（SSOT）

**新規: `packages/shared/src/schemas/file.ts`**

- `fileStatusSchema` - enum（PENDING / CONFIRMED）
- `mimeTypeSchema` - 許可MIMEタイプ（画像: jpeg/png/gif/webp、文書: pdf/docx/xlsx）
- `fileSchema` - レスポンス用のファイル情報（id, key, fileName, mimeType, size, isPublic, status, uploadedById, ...）
- `requestUploadUrlRequestSchema` - アップロードURL要求（fileName, mimeType, size, isPublic）
- `requestUploadUrlResponseSchema` - 応答（fileId, uploadUrl, key）
- `confirmUploadResponseSchema` - 確認応答（file）
- `listFilesResponseSchema` - 一覧応答（files[]）
- `deleteFileResponseSchema` - 削除応答（success: true）

**新規: `packages/shared/src/endpoints/file.ts`**

| エンドポイント | メソッド | 型ヘルパー | 説明 |
|---------------|---------|-----------|------|
| `/files/upload-url` | POST | BodyEndpoint | Presigned PUT URL発行 + PENDINGレコード作成 |
| `/files/:id/confirm` | POST | BodyEndpoint（空body） | S3存在確認 → CONFIRMED更新 |
| `/files/:id/content` | GET | - （バイナリレスポンス） | APIプロキシでファイル配信 |
| `/files` | GET | GetEndpoint | 自分のファイル一覧 |
| `/files/:id` | DELETE | NoBodyEndpoint | ソフトデリート |

**変更: `packages/shared/src/index.ts`** にexport追加

### Step 6: APIルート実装

**新規: `apps/api/src/routes/files.ts`**

主要なバリデーション:

- ファイルサイズ上限チェック（`env.S3_MAX_FILE_SIZE`）
- MIMEタイプの許可リストチェック
- upload-url / confirm / delete / 一覧: `requireAuth` 必須
- content: `isPublic` なら認証不要、そうでなければ `requireAuth`
- confirm: アップロード者本人のみ + S3オブジェクト存在確認（冪等: 既にCONFIRMEDならそのまま返す）
- delete: アップロード者本人のみ
- 一覧: 自分がアップロードした CONFIRMED + deletedAt null のファイルのみ
- content: `Cache-Control` ヘッダ付与、`Content-Type` にMIMEタイプをセット

**変更: `apps/api/src/index.ts`**

- `initStorage()` の呼び出しを追加
- `app.route("/files", fileRoute)` でルートをマウント

### Step 7: フロントエンドAPI関数

**新規: `apps/web/src/lib/api/files.ts`**

既存の `callGetApi` / `callBodyApi` / `callNoBodyApi` を使ったAPI関数群に加え、
3ステップのアップロードフローをまとめた `uploadFile()` ヘルパーを提供:

```typescript
async function uploadFile(file: File, options?: { isPublic?: boolean }) {
  // 1. APIにPresigned URLを要求（fileName, mimeType, size, isPublic）
  // 2. fetch()でS3に直接PUT（ky不使用 - 認証ヘッダ不要のため）
  // 3. APIにアップロード完了を通知
  // → 確認済みのファイル情報を返す
}

// ファイル表示用URLの取得
function getFileContentUrl(fileId: string): string {
  return `${API_BASE_URL}/files/${fileId}/content`;
}
```

### Step 8: フロントエンドコンポーネント（任意、後回し可）

**新規: `apps/web/src/components/patterns/FileUpload/index.tsx`**

- `<FileUpload accept={...} maxSizeMB={...} onUploadComplete={...} onError={...} />`
- useState + ref パターン（既存のフォームパターンに準拠）
- クライアント側サイズチェック → `uploadFile()` 呼び出し → コールバック

**新規: `apps/web/src/components/patterns/FileUpload/FileUpload.module.scss`**

- CSS Variables 使用（既存のスタイリング規約に準拠）

**変更: `apps/web/src/components/patterns/index.ts`** にexport追加

### Step 9: テスト

| ファイル | 内容 |
|---------|------|
| `apps/api/src/lib/storage/key.test.ts` | キー生成・拡張子取得のユニットテスト |
| `packages/shared/src/schemas/file.test.ts` | スキーマバリデーションテスト |
| `apps/api/src/routes/files.test.ts` | ルートテスト（モック使用、既存パターン準拠） |

## ファイル一覧

### 新規作成（11ファイル）

- `apps/api/src/lib/storage/client.ts`
- `apps/api/src/lib/storage/presign.ts`
- `apps/api/src/lib/storage/key.ts`
- `apps/api/src/lib/storage/cleanup.ts`
- `apps/api/src/lib/storage/key.test.ts`
- `apps/api/src/routes/files.ts`
- `apps/api/src/routes/files.test.ts`
- `packages/shared/src/schemas/file.ts`
- `packages/shared/src/schemas/file.test.ts`
- `packages/shared/src/endpoints/file.ts`
- `apps/web/src/lib/api/files.ts`

### 変更（5ファイル）

- `apps/api/package.json` - AWS SDK追加
- `apps/api/src/lib/env.ts` - S3環境変数追加
- `apps/api/src/index.ts` - ストレージ初期化 + ルートマウント
- `apps/api/prisma/schema.prisma` - Fileモデル + Userリレーション追加
- `packages/shared/src/index.ts` - export追加

### 任意（フロントエンドコンポーネント、後回しでもOK）

- `apps/web/src/components/patterns/FileUpload/index.tsx`
- `apps/web/src/components/patterns/FileUpload/FileUpload.module.scss`
- `apps/web/src/components/patterns/index.ts` - FileUpload export追加

## 検証方法

1. `bun run typecheck` - 型チェック通過
2. `bun run test:run` - テスト通過
3. `bun run lint` - Biome通過
4. 手動テスト: dev起動 → ログイン → アップロードフロー確認

## 注意事項

- さくらのオブジェクトストレージ側で**CORS設定**が必要（フロントエンドオリジンからのPUTを許可）
- `forcePathStyle` の要否はさくらのドキュメントで確認が必要
- PENDINGレコードのクリーンアップは定期実行の仕組み（cron等）が別途必要
