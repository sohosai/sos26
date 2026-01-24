# 筑波大学メールアドレス仕様

本プロジェクトでは、ユーザー登録に**筑波大学のメールアドレス**を必須としています。

---

## 目次

- [筑波大学メールアドレス仕様](#筑波大学メールアドレス仕様)
  - [目次](#目次)
  - [対象メールアドレス](#対象メールアドレス)
  - [形式](#形式)
  - [バリデーション](#バリデーション)
    - [正規表現](#正規表現)
    - [Zodスキーマ](#zodスキーマ)
    - [ヘルパー関数](#ヘルパー関数)
  - [使用箇所](#使用箇所)
  - [有効な例・無効な例](#有効な例無効な例)

---

## 対象メールアドレス

筑波大学が学生に発行する統一認証システム（u.tsukuba.ac.jp）のメールアドレスのみを許可します。

---

## 形式

```
s{学籍番号7桁}@u.tsukuba.ac.jp
```

| 部分 | 説明 |
|------|------|
| `s` | 学生を示すプレフィックス（小文字固定） |
| `{7桁の数字}` | 学籍番号（0〜9の数字のみ） |
| `@u.tsukuba.ac.jp` | 筑波大学統一認証ドメイン |

---

## バリデーション

### 正規表現

```
/^s\d{7}@u\.tsukuba\.ac\.jp$/
```

### Zodスキーマ

`packages/shared/src/schemas/email.ts` で定義:

```typescript
import { z } from "zod";

const TSUKUBA_EMAIL_REGEX = /^s\d{7}@u\.tsukuba\.ac\.jp$/;

export const tsukubaEmailSchema = z
  .string()
  .regex(
    TSUKUBA_EMAIL_REGEX,
    "筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください"
  );

export type TsukubaEmail = z.infer<typeof tsukubaEmailSchema>;
```

### ヘルパー関数

```typescript
import { isTsukubaEmail } from "@sos26/shared";

if (isTsukubaEmail(email)) {
  // 筑波大学メールアドレス
}
```

---

## 使用箇所

| 箇所 | 用途 |
|------|------|
| `POST /auth/email/start` | 新規登録時のメールアドレス検証 |
| `User.email` | ユーザーテーブルのメールアドレスカラム |

---

## 有効な例・無効な例

### 有効

| メールアドレス | 説明 |
|----------------|------|
| `s1234567@u.tsukuba.ac.jp` | 標準的な形式 |
| `s0000000@u.tsukuba.ac.jp` | 全て0でも可 |
| `s9999999@u.tsukuba.ac.jp` | 全て9でも可 |

### 無効

| メールアドレス | 理由 |
|----------------|------|
| `test@example.com` | 筑波大学ドメインではない |
| `t1234567@u.tsukuba.ac.jp` | `s` で始まっていない |
| `s123456@u.tsukuba.ac.jp` | 数字が6桁（7桁必要） |
| `s12345678@u.tsukuba.ac.jp` | 数字が8桁（7桁必要） |
| `s1234567@tsukuba.ac.jp` | `u.` が欠けている |
| `S1234567@u.tsukuba.ac.jp` | 大文字の `S`（小文字のみ許可） |
| `s123456a@u.tsukuba.ac.jp` | 数字以外の文字が含まれている |
