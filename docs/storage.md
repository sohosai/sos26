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
  │                            │ 非公開 → 認証チェック       │
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

### 非公開ファイルの署名付きトークン認証

`<img src>` や `<a href>` では `Authorization` ヘッダーを付けられないため、非公開ファイルには **HMAC-SHA256 署名付きトークン** をクエリパラメータで渡す方式を提供する。

```
ブラウザ                       API
  │                            │
  │ GET /files/:id/token       │
  │ (Authorization: Bearer)    │
  │ ──────────────────────────> │
  │                            │ 認証チェック
  │                            │ ファイル存在・非公開チェック
  │  { token, expiresAt }      │ HMAC-SHA256 署名付きトークン生成
  │ <────────────────────────── │
  │                            │
  │ GET /files/:id/content     │
  │   ?token=xxx               │
  │ ──────────────────────────> │
  │                            │ トークン検証（署名・期限・fileId）
  │  ストリーミング配信         │
  │ <────────────────────────── │
```

- トークン形式: `base64url(payload).base64url(hmac-sha256(payload))`
- ペイロード: `fileId:userId:expiresAt(unix秒)`
- デフォルト有効期限: **5分**
- `timingSafeEqual` によるタイミング攻撃防止
- トークンなしの場合は従来の Bearer 認証にフォールバック

---

## 2. 関連ファイル

### API

| ファイル | 役割 |
|---------|------|
| `apps/api/src/routes/files.ts` | エンドポイント（5つ） |
| `apps/api/src/lib/storage/client.ts` | S3Client の初期化・取得 |
| `apps/api/src/lib/storage/presign.ts` | Presigned URL 生成、オブジェクト取得・存在確認 |
| `apps/api/src/lib/storage/key.ts` | S3 キー生成、MIME → 拡張子マッピング |
| `apps/api/src/lib/storage/file-token.ts` | 署名付きトークンの生成・検証 |
| `apps/api/src/lib/storage/file-token.test.ts` | トークンユーティリティのテスト |
| `apps/api/src/lib/storage/access.ts` | アクセスチェッカーレジストリ |
| `apps/api/src/lib/storage/access.test.ts` | アクセスチェッカーのテスト |
| `apps/api/src/lib/storage/cleanup.ts` | 古い PENDING レコードのクリーンアップ |

### 共有（SSOT）

| ファイル | 役割 |
|---------|------|
| `packages/shared/src/schemas/file.ts` | Zod スキーマ・型定義 |
| `packages/shared/src/endpoints/file.ts` | エンドポイント型定義 |

### フロントエンド

| ファイル | 役割 |
|---------|------|
| `apps/web/src/lib/api/files.ts` | API クライアント関数・`useStorageUrl` フック・`uploadFile()` ヘルパー |
| `apps/web/src/routes/dev/storage/index.tsx` | 開発用テストページ |

---

## 3. エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/files/upload-url` | POST | 必須 | Presigned PUT URL 発行 + PENDING レコード作成 |
| `/files/:id/confirm` | POST | 必須（本人のみ） | S3 存在確認 → CONFIRMED 更新（冪等） |
| `/files/:id/content` | GET | 公開→不要 / 非公開→Bearer or `?token`（アクセス制御あり） | API プロキシでファイル配信 |
| `/files/:id/token` | GET | 必須（アクセス制御あり） | 非公開ファイル用の署名付きトークン発行 |
| `/files` | GET | 必須 | 自分のファイル一覧（CONFIRMED のみ） |
| `/files/:id` | DELETE | 必須（本人のみ） | ソフトデリート |

---

## 4. データベース

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

`File` テーブルは **ストレージの物理管理のみ** を担当する。「何のためのファイルか」は各機能側のテーブルからリレーションで参照する。

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

## 5. 許可されたファイル形式

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

---

## 6. 環境変数

`apps/api/.env` に設定する。

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `S3_ENDPOINT` | エンドポイント URL | （必須） |
| `S3_REGION` | リージョン | `jp-north-1` |
| `S3_BUCKET` | バケット名 | （必須） |
| `S3_ACCESS_KEY_ID` | アクセスキー | （必須） |
| `S3_SECRET_ACCESS_KEY` | シークレットキー | （必須） |
| `S3_PRESIGNED_URL_EXPIRES` | Presigned URL の有効期限（秒） | `3600` |
| `S3_MAX_FILE_SIZE` | 最大ファイルサイズ（バイト） | `10485760` |
| `FILE_TOKEN_SECRET` | ファイルトークン署名用秘密鍵（32文字以上） | （必須） |

---

## 7. CORS 設定（さくらのオブジェクトストレージ）

ブラウザから Presigned URL で直接 PUT するため、バケットに CORS 設定が必要。

```bash
# cors.json を作成
cat > cors.json << 'EOF'
{
  "CORSConfiguration": {
    "CORSRules": [
      {
        "AllowedOrigins": ["http://localhost:5173", "https://本番ドメイン"],
        "AllowedMethods": ["PUT"],
        "AllowedHeaders": ["Content-Type"],
        "MaxAgeSeconds": 3600
      }
    ]
  }
}
EOF

# 設定を適用
aws s3api put-bucket-cors \
  --bucket バケット名 \
  --cors-configuration file://cors.json \
  --endpoint-url https://s3.isk01.sakurastorage.jp
```

- `AllowedOrigins`: フロントエンドのオリジン（`CORS_ORIGIN` と同じ値）
- `AllowedMethods`: `PUT` のみ（GET は API プロキシ経由のため不要）
- `AllowedHeaders`: `Content-Type`（アップロード時に送信するヘッダー）

---

## 8. フロントエンドでの利用

### アップロード

`uploadFile()` が 3 ステップを自動で実行する。

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
import { useStorageUrl } from "@/lib/api/files";

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

### getAuthenticatedFileUrl 関数

コンポーネント外（イベントハンドラ等）でトークン付き URL が必要な場合:

```typescript
import { getAuthenticatedFileUrl } from "@/lib/api/files";

const url = await getAuthenticatedFileUrl(fileId);
```

---

## 9. クリーンアップ

`cleanupStalePendingFiles()` は、作成から一定時間（デフォルト 24 時間）経過した PENDING レコードをソフトデリートする。

```typescript
import { cleanupStalePendingFiles } from "./lib/storage/cleanup";

const count = await cleanupStalePendingFiles();
```

外部のスケジューラ（cron 等）から定期的に呼び出す必要がある。現時点では自動実行の仕組みは未実装。

---

## 10. アクセス制御

### 背景

非公開ファイルへのアクセス権は **用途によって異なる**。File テーブルは「物理管理」のみの責任なので、アクセス権の判定は **各機能モジュール側** に委譲する。

> 例（実際のルールは各機能の実装に依存する）:
>
> | 用途 | アクセスできるユーザー |
> |------|----------------------|
> | お知らせ添付 | 配信先企画メンバー + owner/共同編集者 |
> | フォーム回答添付 | 回答者本人 + フォームの owner/共同編集者 |

### アクセスチェッカー登録パターン

各機能モジュールが「このファイルにこのユーザーはアクセスできるか？」を判定する関数を登録する。ファイル配信時にそれらを順番にチェックし、1つでも許可すれば配信する。

#### 判定フロー

```
GET /files/:id/content（または GET /files/:id/token）
│
├─ ファイルが存在しない → 404
├─ ファイルが公開 (isPublic === true) → そのまま配信
│
├─ ファイルが非公開 (isPublic === false)
│   │
│   ├─ 認証なし → 401
│   │
│   ├─ 認証あり
│   │   │
│   │   ├─ アップローダー本人 (uploadedById === userId) → 配信
│   │   │   ※自分がアップロードしたファイルは常にアクセス可能
│   │   │
│   │   ├─ 登録済みアクセスチェッカーを順次実行
│   │   │   │
│   │   │   ├─ [お知らせチェッカー] → 配信先企画メンバー等なら許可
│   │   │   ├─ [フォームチェッカー] → フォーム管理者等なら許可
│   │   │   └─ (将来追加される他のチェッカー)
│   │   │
│   │   └─ すべてのチェッカーが拒否 or 該当なし → 403
```

`GET /:id/content` の `?token` パスではトークン署名検証のみ行う（トークン発行時（`GET /:id/token`）にアクセス権限を確認済みのため）。

#### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `apps/api/src/lib/storage/access.ts` | レジストリ本体 |
| `apps/api/src/lib/storage/access.test.ts` | ユニットテスト |

#### API

```typescript
import { registerFileAccessChecker, canAccessFile } from "../lib/storage/access";

// チェッカーの型
type FileAccessChecker = (fileId: string, user: User) => Promise<boolean>;
// true  → アクセス許可
// false → このチェッカーでは判定不能（次のチェッカーへ）
// ※ すべてのチェッカーが false を返した場合のみアクセス拒否

// チェッカー登録（各機能モジュールの初期化時に呼ぶ）
registerFileAccessChecker(async (fileId, user) => { ... });

// アクセス判定（files.ts 内で使用）
const hasAccess = await canAccessFile(fileId, user);
```

#### チェッカー登録例（お知らせ機能）

```typescript
// apps/api/src/routes/committee-notice.ts（初期化時）
registerFileAccessChecker(async (fileId, user) => {
  // このファイルがお知らせに添付されているか確認
  const attachment = await prisma.noticeAttachment.findFirst({
    where: { fileId },
    include: { notice: { include: { collaborators: true, authorizations: { ... } } } },
  });
  if (!attachment) return false; // お知らせの添付ではない → 判定不能

  const notice = attachment.notice;
  if (notice.ownerId === user.id) return true; // owner → 許可
  if (notice.collaborators.some(c => c.userId === user.id)) return true; // 共同編集者 → 許可

  // 配信先企画のメンバーかチェック → 該当すれば許可
  // ...
  return false;
});
```

### 設計のポイント

| ポイント | 説明 |
|---------|------|
| **File テーブルは変更不要** | アクセス制御ロジックは各機能側に置く |
| **拡張が容易** | 新しい機能が増えたら、チェッカーを `registerFileAccessChecker` で登録するだけ |
| **チェッカーの独立性** | 各チェッカーは他のチェッカーを知らない。自分の管轄外なら `false` を返すだけ |
| **アップローダー本人は常にアクセス可** | チェッカーの前にチェックするため、どの機能にも紐づいていないファイルでも本人はアクセスできる |

### 注意点

| 項目 | 内容 |
|------|------|
| **パフォーマンス** | チェッカーが増えると DB クエリが増える。現時点ではお知らせとフォームの 2 つ程度なので問題なし |
| **チェッカーの登録タイミング** | アプリ起動時に全チェッカーが登録されている必要がある。`index.ts` での初期化順序に注意 |
| **監査ログ** | 現時点では不要だが、将来的に `canAccessFile` 内にログを追加できる |

---

## 11. 既知の制限・TODO

- **PENDING クリーンアップの自動化**: cron 等の定期実行の仕組みが未整備
- **S3 孤立オブジェクト**: ソフトデリート後も S3 上のオブジェクトは残る。物理削除の仕組みは未実装
