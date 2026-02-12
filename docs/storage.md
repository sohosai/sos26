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

---

## 2. 関連ファイル

### API

| ファイル | 役割 |
|---------|------|
| `apps/api/src/routes/files.ts` | エンドポイント（5つ） |
| `apps/api/src/lib/storage/client.ts` | S3Client の初期化・取得 |
| `apps/api/src/lib/storage/presign.ts` | Presigned URL 生成、オブジェクト取得・存在確認 |
| `apps/api/src/lib/storage/key.ts` | S3 キー生成、MIME → 拡張子マッピング |
| `apps/api/src/lib/storage/cleanup.ts` | 古い PENDING レコードのクリーンアップ |

### 共有（SSOT）

| ファイル | 役割 |
|---------|------|
| `packages/shared/src/schemas/file.ts` | Zod スキーマ・型定義 |
| `packages/shared/src/endpoints/file.ts` | エンドポイント型定義 |

### フロントエンド

| ファイル | 役割 |
|---------|------|
| `apps/web/src/lib/api/files.ts` | API クライアント関数・`uploadFile()` ヘルパー |
| `apps/web/src/routes/dev/storage/index.tsx` | 開発用テストページ |

---

## 3. エンドポイント

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/files/upload-url` | POST | 必須 | Presigned PUT URL 発行 + PENDING レコード作成 |
| `/files/:id/confirm` | POST | 必須（本人のみ） | S3 存在確認 → CONFIRMED 更新（冪等） |
| `/files/:id/content` | GET | 公開→不要 / 非公開→必須 | API プロキシでファイル配信 |
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

// 非公開ファイルの場合: Authorization ヘッダーが必要
// → <img src> や <a href> では認証を付けられないため、
//   fetch + Bearer トークンで取得し Blob URL に変換する必要がある
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

## 10. 既知の制限・TODO

- **非公開ファイルのアクセス制御**: 現在は「有効なトークンを持つ任意のユーザー」がアクセス可能。所有者チェック（`uploadedById === userId`）は行っていない。用途に応じた権限モデルの設計が必要
- **非公開ファイルのブラウザ表示**: `<img src>` 等では Authorization ヘッダーを付けられないため、非公開ファイルのインライン表示には fetch + Blob URL 方式の実装が必要
- **PENDING クリーンアップの自動化**: cron 等の定期実行の仕組みが未整備
- **S3 孤立オブジェクト**: ソフトデリート後も S3 上のオブジェクトは残る。物理削除の仕組みは未実装
