# SendGrid メール送信設計・実装ドキュメント（Hono バックエンド）

本ドキュメントは、Hono を用いたバックエンドにおいて SendGrid を利用する際の
**設計方針・ディレクトリ構造・実装例・利用方法**をまとめたものです。
SendGrid SDK の直接利用を避け、責務分離された構造を前提とします。

---

## 1. 設計方針

### 基本原則

- Hono の handler から SendGrid SDK を直接呼ばない
- メール送信は「ユースケース」「テンプレート」「送信プロバイダ」に分離
- SendGrid 依存は provider 層に閉じ込める

### 目的

- SDK 変更・メール基盤変更への耐性確保
- handler の肥大化防止
- メール種別追加時の影響範囲を限定

---

## 2. ディレクトリ構造

```txt
apps/api/src/
├─ lib/
│  └─ emails/
│     ├─ usecases/
│     │  └─ sendVerificationEmail.ts
│     ├─ templates/
│     │  └─ verification.ts
│     ├─ providers/
│     │  └─ sendgridClient.ts
│     ├─ types.ts
│     └─ index.ts
├─ routes/
│  └─ auth.ts
└─ env.ts
```

---

## 3. 環境変数

### apps/api/.env

```env
# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=no-reply@example.com
EMAIL_SANDBOX=true
```

- from アドレスや sandbox 設定はコードに直書きしない
- dev / prod で挙動を切り替え可能

### env.ts（型安全な環境変数管理）

```ts
import { z } from "zod";

const envSchema = z.object({
  SENDGRID_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  EMAIL_SANDBOX: z.enum(["true", "false"]).default("false"),
});

export const env = envSchema.parse(process.env);
```

---

## 4. パッケージの追加

`apps/api/package.json` に以下の依存関係を追加します。

```json
{
  "dependencies": {
    "@sendgrid/mail": "^8.1.0"
  }
}
```

---

## 5. Provider（SendGrid クライアント）

### lib/emails/providers/sendgridClient.ts

```ts
import sgMail from "@sendgrid/mail";
import { env } from "../../../env";

sgMail.setApiKey(env.SENDGRID_API_KEY);

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  try {
    await sgMail.send({
      to: input.to,
      from: env.EMAIL_FROM,
      subject: input.subject,
      html: input.html,
      text: input.text,
      mailSettings: {
        sandboxMode: {
          enable: env.EMAIL_SANDBOX === "true",
        },
      },
    });
  } catch (err) {
    throw new EmailSendError("Failed to send email", err);
  }
}
```

### ポイント

- SendGrid SDK の import はこのファイルのみ
- SendGrid 特有のエラーをアプリ独自エラーに正規化
- `env` オブジェクトで型安全に環境変数を参照

---

## 6. Template（メール文面）

### lib/emails/templates/verification.ts

```ts
export function verificationTemplate(params: { verifyUrl: string }) {
  return {
    subject: "メールアドレスの確認",
    html: `
      <p>以下のリンクをクリックして、メールアドレスを確認してください。</p>
      <p><a href="${params.verifyUrl}">確認する</a></p>
    `,
    text: `以下のURLを開いてメールアドレスを確認してください。\n${params.verifyUrl}`,
  };
}
```

### ポイント

- 副作用なしの純粋関数
- 表示ロジック・送信処理を含めない
- 将来の多言語化に対応しやすい

---

## 7. Usecase（ユースケース）

### lib/emails/usecases/sendVerificationEmail.ts

```ts
import { sendEmail } from "../providers/sendgridClient";
import { verificationTemplate } from "../templates/verification";

type Input = {
  email: string;
  verifyUrl: string;
};

export async function sendVerificationEmail(input: Input): Promise<void> {
  const template = verificationTemplate({
    verifyUrl: input.verifyUrl,
  });

  await sendEmail({
    to: input.email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  // 必要に応じて監査ログや DB 記録を追加
}
```

### usecase の責務

- メール送信の「意味」を表現する
- handler から見て 1 関数で完結させる
- provider / template を組み立てる役割

---

## 8. 外部公開 API

### lib/emails/index.ts

```ts
export { sendVerificationEmail } from "./usecases/sendVerificationEmail";
```

- アプリ側はここだけ import すればよい

---

## 9. Hono からの利用例

### routes/auth.ts

```ts
import { Hono } from "hono";
import { sendVerificationEmail } from "../lib/emails";

const app = new Hono();

app.post("/signup", async (c) => {
  const { email } = await c.req.json();

  const verifyUrl = `https://example.com/verify?token=xxx`;

  await sendVerificationEmail({
    email,
    verifyUrl,
  });

  return c.json({ ok: true });
});

export default app;
```

### 重要点

- Hono 側に SendGrid の存在が漏れていない
- メール送信ロジックがテスト・差し替え可能

---

## 10. テスト（vitest）

### lib/emails/providers/sendgridClient.test.ts

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }]),
  },
}));

vi.mock("../../../env", () => ({
  env: {
    SENDGRID_API_KEY: "test-api-key",
    EMAIL_FROM: "test@example.com",
    EMAIL_SANDBOX: "true",
  },
}));

describe("sendEmail", () => {
  it("should send email successfully", async () => {
    const { sendEmail } = await import("./sendgridClient");

    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test Body</p>",
      }),
    ).resolves.toBeUndefined();
  });

  it("should throw EmailSendError on failure", async () => {
    const sgMail = await import("@sendgrid/mail");
    vi.mocked(sgMail.default.send).mockRejectedValueOnce(
      new Error("API Error"),
    );

    const { sendEmail, EmailSendError } = await import("./sendgridClient");

    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      }),
    ).rejects.toThrow(EmailSendError);
  });
});
```

---

## 11. 拡張指針

### メール種別を追加する場合

1. `lib/emails/templates/` に文面を追加
2. `lib/emails/usecases/` に送信関数を追加
3. `lib/emails/index.ts` で export

### 送信基盤を変更する場合

- `lib/emails/providers/` を差し替えるだけ
- usecase / handler は原則変更不要

---

## 結論

SendGrid を用いたメール送信は
**emails/usecases + templates + providers** の 3 層構成で実装し、
Hono からは usecase のみを呼ぶ設計が最も安全かつ拡張性が高いです。

| レイヤー  | 責務                           | 依存関係       |
| --------- | ------------------------------ | -------------- |
| usecase   | ビジネスロジック・送信の意味   | template, provider |
| template  | メール文面の生成（純粋関数）   | なし           |
| provider  | 外部サービス（SendGrid）との通信 | SendGrid SDK   |
