# オブジェクトストレージ（ファイル管理）

さくらのオブジェクトストレージ（S3互換）を利用したファイルアップロード・配信基盤。

---

## 1. アーキテクチャ

### アップロードフロー（Presigned PUT URL）

```
ブラウザ                       API                          S3
  │                            │                            │
  │ POST /files/upload-url     │                            │
  │ (fileName, mimeType,       │                            │
  │  size, isPublic)           │                            │
  │ ──────────────────────────> │                            │
  │                            │ 認証チェック                │
  │                            │ バリデーション              │
  │                            │ File レコード作成 (PENDING) │
  │                            │ Presigned PUT URL 生成      │
  │  { fileId, uploadUrl }     │                            │
  │ <────────────────────────── │                            │
  │                            │                            │
  │ PUT uploadUrl + ファイル本体                             │
  │ ────────────────────────────────────────────────────────>│
  │                            │                            │
  │ POST /files/:id/confirm    │                            │
  │ ──────────────────────────> │ S3 にオブジェクト存在確認  │
  │                            │ ステータス → CONFIRMED      │
  │  { file }                  │                            │
  │ <────────────────────────── │                            │
```

- ブラウザが S3 に直接アップロードするため、API サーバーの負荷が低い
- S3 への PUT には認証ヘッダ不要（Presigned URL に署名が含まれる）

### ファイル配信フロー（API プロキシ）

```
ブラウザ                       API                          S3
  │                            │                            │
  │ GET /files/:id/content     │                            │
  │ ──────────────────────────> │                            │
  │                            │ 公開 → そのまま通過         │
  │                            │ 非公開 → 認証 + アクセス制御│
  │                            │ GetObject ─────────────────>│
  │                            │ <───────────────────────────│
  │  ストリーミング配信         │                            │
  │  + Cache-Control           │                            │
  │ <────────────────────────── │                            │
```

ファイルの読み取りは **すべて API プロキシ** で配信する。

- `<img src="/api/files/{id}/content">` で直接埋め込み可能
- S3 側のバケットポリシー・ACL 設定は不要
- `Cache-Control` でブラウザキャッシュを活用

---

## 2. データベース

### File モデル

```prisma
enum FileStatus {
  PENDING      // URL 発行済み、アップロード未確認
  CONFIRMED    // S3 上の存在を確認済み
}

model File {
  id           String     @id @default(cuid())
  key          String     @unique              // S3 オブジェクトキー
  fileName     String                          // 元のファイル名
  mimeType     String
  size         Int                             // バイト
  isPublic     Boolean    @default(false)
  status       FileStatus @default(PENDING)
  uploadedById String
  uploadedBy   User       @relation(...)
  deletedAt    DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

### 設計方針

`File` テーブルは **ストレージの物理管理のみ** を担当する。「何のためのファイルか」「誰がアクセスできるか」は各機能側のテーブル・モジュールの責任。

```
File（物理管理のみ）
  ↑                    ↑
  │                    │
User.avatarId    ProjectDocument.fileId
（アバター）      （企画書類）
```

新しい用途が増えても File テーブルは変更不要。紐づけ側にリレーションを追加するだけ。

### S3 キー構造

```
{userId}/{uuid}.{ext}
```

例: `cm1abc2d3e000/550e8400-e29b-41d4-a716-446655440000.jpg`

---

## 3. アクセス制御

### 公開ファイル

`isPublic === true` のファイルは認証不要でそのまま配信する。

### 非公開ファイル

非公開ファイル（`isPublic === false`）は、HMAC-SHA256 署名付きトークンをクエリパラメータで渡してアクセスする。

```
ブラウザ                       API
  │                            │
  │ GET /files/:id/token       │
  │ (requireAuth)              │
  │ ──────────────────────────> │
  │                            │ requireAuth + アクセス制御
  │  { token, expiresAt }      │ HMAC-SHA256 署名付きトークン生成
  │ <────────────────────────── │
  │                            │
  │ GET /files/:id/content     │
  │   ?token=xxx               │
  │ ──────────────────────────> │
  │                            │ トークン検証（署名・期限・fileId）
  │  ストリーミング配信         │ ※ アクセス制御はトークン発行時に確認済み
  │ <────────────────────────── │
```

- トークン形式: `base64url(payload).base64url(hmac-sha256(payload))`
- ペイロード: `fileId:userId:expiresAt(unix秒)`
- デフォルト有効期限: **5分**
- `timingSafeEqual` によるタイミング攻撃防止

### アクセス権限の判定フロー

`GET /:id/token` でのアクセス権限判定:

```
├─ アップローダー本人 (uploadedById === userId) → 許可
│   ※ 自分がアップロードしたファイルは常にアクセス可能
│
├─ 登録済みアクセスチェッカーを順次実行
│   ├─ いずれかのチェッカーが true → 許可
│   └─ すべて false → 403
```

### アクセスチェッカーレジストリ

非公開ファイルへのアクセス権は用途によって異なる。File テーブルはこれを知らないので、各機能モジュールが判定関数を登録する仕組みになっている。

#### 登録済みチェッカー

| 用途 | ファイル | アクセスできるユーザー |
|------|---------|----------------------|
| お知らせ添付 | `lib/storage/checkers/notice.ts` | 実委人（全員） / 配信先企画のメンバー（承認済み & 配信日時到来） |

新しいチェッカーを追加する場合は `lib/storage/checkers/` にファイルを作成し、`checkers/index.ts` に import を追加する。

#### 仕組み

```typescript
import { registerFileAccessChecker, canAccessFile } from "../lib/storage/access";

// チェッカーの型
type FileAccessChecker = (fileId: string, user: User) => Promise<boolean>;
// true  → アクセス許可
// false → このチェッカーでは判定不能（次のチェッカーへ）
// ※ すべてのチェッカーが false を返した場合のみアクセス拒否

// チェッカー登録（各機能モジュールの初期化時に呼ぶ）
registerFileAccessChecker(async (fileId, user) => {
  // 自分の管轄のファイルか確認 → 該当しなければ false（判定不能）
  // 該当すればアクセスルールを適用 → 許可なら true
});

// アクセス判定（files.ts 内で使用）
const hasAccess = await canAccessFile(fileId, user);
```

**設計のポイント**:

- **File テーブルは変更不要** — アクセス制御ロジックは各機能側に置く
- **拡張が容易** — `lib/storage/checkers/` にファイルを追加し、`checkers/index.ts` で import するだけ
- **チェッカーの独立性** — 各チェッカーは他のチェッカーを知らない。自分の管轄外なら `false` を返すだけ
- **アップローダー本人は常にアクセス可** — チェッカーの前にチェックするため、どの機能にも紐づいていないファイルでも本人はアクセスできる

**注意点**:

- **登録タイミング**: `checkers/index.ts` がアプリ起動時に読み込まれる必要がある
- **パフォーマンス**: チェッカーが増えると DB クエリが増える。現時点では数個程度なので問題なし

---

## 4. エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/files/upload-url` | POST | 必須 | Presigned PUT URL 発行 + PENDING レコード作成 |
| `/files/:id/confirm` | POST | 必須（本人のみ） | S3 存在確認 → CONFIRMED 更新（冪等） |
| `/files/:id/content` | GET | 公開→不要 / 非公開→`?token` 必須 | API プロキシでファイル配信 |
| `/files/:id/token` | GET | 必須（アクセス制御あり） | 非公開ファイル用の署名付きトークン発行 |
| `/files` | GET | 必須 | 自分のファイル一覧（CONFIRMED のみ） |
| `/files/:id` | DELETE | 必須（本人のみ） | ソフトデリート |

---

## 5. フロントエンドでの利用

### アップロード

`uploadFile()` が 3 ステップ（URL 要求 → S3 PUT → confirm）を自動で実行する。

```typescript
import { uploadFile } from "@/lib/api/files";

const result = await uploadFile(file, { isPublic: false });
// result.file.id でファイル ID を取得
```

### ファイル表示

```typescript
import { getFileContentUrl } from "@/lib/api/files";

// 公開ファイルの場合: そのまま使える
<img src={getFileContentUrl(fileId)} />
```

### useStorageUrl フック（推奨）

公開・非公開を問わず、ファイル URL を返す汎用フック。`<img>`, `<a>`, `<video>` 等どこでも使える。

```typescript
import { useStorageUrl } from "@/lib/storage";

const url = useStorageUrl(file.id, file.isPublic);
// 公開 → 即座に URL を返す
// 非公開 → トークン付き URL を非同期取得（取得中は null）
```

使用例:

```tsx
// 画像
{url && <img src={url} alt="添付画像" />}

// リンク
{url && <a href={url} target="_blank">ダウンロード</a>}
```

### ファイルダウンロード

`downloadFile()` はファイルを Blob として取得し、ブラウザのダウンロードを実行する。別オリジン（S3 プロキシ経由）でも `download` 属性が機能するよう、Object URL を経由する。

```typescript
import { downloadFile } from "@/lib/api/files";

await downloadFile(fileId, fileName, isPublic);
```

### getAuthenticatedFileUrl 関数

コンポーネント外（イベントハンドラ等）でトークン付き URL が必要な場合:

```typescript
import { getAuthenticatedFileUrl } from "@/lib/api/files";

const url = await getAuthenticatedFileUrl(fileId);
```

---

## 6. 関連ファイル

### API (`apps/api/src/`)

| ファイル | 役割 |
|---------|------|
| `routes/files.ts` | エンドポイント |
| `lib/storage/client.ts` | S3Client の初期化・取得 |
| `lib/storage/presign.ts` | Presigned URL 生成、オブジェクト取得・存在確認 |
| `lib/storage/key.ts` | S3 キー生成、MIME → 拡張子マッピング |
| `lib/storage/file-token.ts` | 署名付きトークンの生成・検証 |
| `lib/storage/access.ts` | アクセスチェッカーレジストリ |
| `lib/storage/checkers/index.ts` | チェッカー一括登録 |
| `lib/storage/checkers/notice.ts` | お知らせ添付ファイル用アクセスチェッカー |
| `lib/storage/cleanup.ts` | 古い PENDING レコードのクリーンアップ |

### 共有（SSOT）

| ファイル | 役割 |
|---------|------|
| `packages/shared/src/schemas/file.ts` | Zod スキーマ・型定義 |
| `packages/shared/src/endpoints/file.ts` | エンドポイント型定義 |

### フロントエンド

| ファイル | 役割 |
|---------|------|
| `apps/web/src/lib/api/files.ts` | API クライアント関数・`uploadFile()` ヘルパー |
| `apps/web/src/lib/storage.ts` | `useStorageUrl` フック |
| `apps/web/src/routes/dev/storage/index.tsx` | 開発用テストページ |

---

## 7. 運用

### 環境変数

`S3_*` および `FILE_TOKEN_SECRET` を `apps/api/.env` に設定する必要がある。
詳細は [docs/apps/api/environment-variables.md](./apps/api/environment-variables.md) を参照。

### 許可されたファイル形式

| カテゴリ | MIME タイプ | 拡張子 |
|---------|-----------|-------|
| 画像 | `image/jpeg` | jpg |
| 画像 | `image/png` | png |
| 画像 | `image/gif` | gif |
| 画像 | `image/webp` | webp |
| 文書 | `application/pdf` | pdf |
| 文書 | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | docx |
| 文書 | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | xlsx |

ファイルサイズ上限: `S3_MAX_FILE_SIZE`（デフォルト 10MB）

### CORS 設定（さくらのオブジェクトストレージ）

ブラウザから Presigned URL で直接 PUT するため、バケットに CORS 設定が必要。
さくらのオブジェクトストレージのコントロールパネルで、以下の値を設定する:

| 項目 | 値 |
|------|-----|
| AllowedOrigins | `http://localhost:5173`, `https://本番ドメイン`（`CORS_ORIGIN` と同じ） |
| AllowedMethods | `PUT` のみ（GET は API プロキシ経由なので不要） |
| AllowedHeaders | `Content-Type` |
| MaxAgeSeconds | `3600` |

### クリーンアップ

`cleanupStalePendingFiles()` は、作成から一定時間（デフォルト 24 時間）経過した PENDING レコードをソフトデリートする。

```typescript
import { cleanupStalePendingFiles } from "./lib/storage/cleanup";

const count = await cleanupStalePendingFiles();
```

外部のスケジューラ（cron 等）から定期的に呼び出す必要がある。現時点では自動実行の仕組みは未実装。

---

## 8. 既知の制限・TODO

- **PENDING クリーンアップの自動化**: cron 等の定期実行の仕組みが未整備
- **S3 孤立オブジェクト**: ソフトデリート後も S3 上のオブジェクトは残る。物理削除の仕組みは未実装
