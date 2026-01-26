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

### 基本形式

```
s{学籍番号7桁}@u.tsukuba.ac.jp
```

| 部分 | 説明 |
|------|------|
| `s` | 学生を示すプレフィックス（小文字固定） |
| `{7桁の数字}` | 学籍番号（0〜9の数字のみ） |
| `@u.tsukuba.ac.jp` | 筑波大学統一認証ドメイン |

### エイリアス形式

メールのエイリアス（`+` 記法）もサポートしています。

```
s{学籍番号7桁}+{任意の文字列}@u.tsukuba.ac.jp
```

| 部分 | 説明 |
|------|------|
| `+{任意の文字列}` | 英数字、ドット、ハイフン、アンダースコアで構成（オプショナル） |

---

## バリデーション

### 正規表現

```
/^s\d{7}(\+[a-zA-Z0-9._-]+)?@u\.tsukuba\.ac\.jp$/
```

### Zodスキーマ

`packages/shared/src/lib/email.ts` で定義:

```typescript
import { z } from "zod";

const TSUKUBA_EMAIL_REGEX =
  /^s\d{7}(\+[a-zA-Z0-9._-]+)?@u\.tsukuba\.ac\.jp$/;

export const tsukubaEmailSchema = z
  .string()
  .transform(email => email.trim().toLowerCase())
  .pipe(
    z.string().regex(TSUKUBA_EMAIL_REGEX, {
      message:
        "筑波大学のメールアドレス（s0000000@u.tsukuba.ac.jp）を入力してください",
    })
  );

export type TsukubaEmail = z.infer<typeof tsukubaEmailSchema>;
```

スキーマは入力を自動で正規化（トリム + 小文字化）します。

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
| `s1234567+test@u.tsukuba.ac.jp` | エイリアス形式 |
| `s1234567+foo.bar@u.tsukuba.ac.jp` | ドットを含むエイリアス |
| `s1234567+a-b_c@u.tsukuba.ac.jp` | ハイフン・アンダースコアを含むエイリアス |

### 無効

| メールアドレス | 理由 |
|----------------|------|
| `test@example.com` | 筑波大学ドメインではない |
| `t1234567@u.tsukuba.ac.jp` | `s` で始まっていない |
| `s123456@u.tsukuba.ac.jp` | 数字が6桁（7桁必要） |
| `s12345678@u.tsukuba.ac.jp` | 数字が8桁（7桁必要） |
| `s1234567@tsukuba.ac.jp` | `u.` が欠けている |
| `S1234567@u.tsukuba.ac.jp` | 大文字の `S`（小文字のみ許可、ただし自動で小文字化される） |
| `s123456a@u.tsukuba.ac.jp` | 数字以外の文字が含まれている |
| `s1234567+@u.tsukuba.ac.jp` | `+` の後に文字がない |
