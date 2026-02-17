# API エンドポイント設計（Draft）

> **注意**: このドキュメントは開発段階の設計計画です。未実装（🆕）や要変更（🔧）のエンドポイントは今後の実装で変更される可能性があります。正式な API リファレンスではありません。

各エンドポイントの実装状態を以下のアイコンで示す。

- ✅ 実装済み
- 🔧 実装済みだが変更が必要
- 🆕 未実装（新規追加）

## 設計方針

APIのプレフィックスは**利用者のロール**で分離する。フロントエンドのルーティングと対称。

```
/auth/*       → 認証（全ユーザー共通）
/project/*    → 企画人が叩くAPI
/committee/*  → 実委人が叩くAPI
/push/*       → 通知（共通）
/users/*      → ユーザー（共通）
```

パスの構造は `/{誰}/{何}` で統一する。

```
/committee/members    → 実委が / メンバーを管理
/committee/projects   → 実委が / 企画を管理
/committee/forms      → 実委が / フォームを管理

/project/list         → 企画人が / 企画一覧を取得
/project/create       → 企画人が / 企画を作成
/project/join         → 企画人が / 企画に参加
/project/:id/members  → 企画人が / メンバーを管理
/project/:id/forms    → 企画人が / フォームを管理
```

- `/project` 配下は全て「企画人として自分のスコープ」
- `/committee` 配下は全て「実委人としてのスコープ」
- 同じリソース（例: 企画一覧）でもロールが異なればパスが異なる

---

## 認可ミドルウェア

| ミドルウェア | 説明 | 状態 |
|---|---|---|
| `requireAuth` | Firebase IDトークン検証 + User取得 | ✅ |
| `requireRegTicket` | 登録チケットCookie検証 | ✅ |
| `requireCommitteeMember` | 実委メンバーであることを確認。`committeeMember` をコンテキストに格納 | ✅ |
| `requireProjectMember` | 企画メンバーであることを確認。`project` / `projectRole` をコンテキストに格納 | ✅ |

---

## 1. 認証 `/auth`

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| ✅ | `POST` | `/auth/email/start` | なし | メール検証開始。検証トークンをメール送信 |
| ✅ | `POST` | `/auth/email/verify` | なし | メール検証確定。`reg_ticket` Cookieを発行 |
| ✅ | `POST` | `/auth/register` | `requireRegTicket` | 本登録（Firebaseユーザー + DBユーザー作成） |
| ✅ | `GET` | `/auth/me` | `requireAuth` | ログインユーザー情報 + committeeMember を取得 |

---

## 2. 企画 `/project`（企画人向け）

マウント: `app.route("/project", projectRoute)`

### 2.1 企画の管理

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🔧 | `GET` | `/project/list` | `requireAuth` | 自分が参加している企画一覧。パス `/projects` から変更 |
| 🔧 | `POST` | `/project/create` | `requireAuth` | 企画を作成。パス `/projects/subscribe` から変更 |
| 🔧 | `POST` | `/project/join` | `requireAuth` | 招待コードで企画に参加。パス `/projects/join` から変更 |
| 🆕 | `GET` | `/project/:projectId/detail` | `requireProjectMember` | 企画の詳細を取得（招待コード含む） |
| 🆕 | `PATCH` | `/project/:projectId/detail` | `requireProjectMember` + OWNER | 企画の設定変更（名前・団体名等） |
| 🆕 | `POST` | `/project/:projectId/invite-code/regenerate` | `requireProjectMember` + OWNER | 招待コードを再生成 |

### 2.2 メンバー管理

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🔧 | `GET` | `/project/:projectId/members` | `requireProjectMember` | メンバー一覧を取得 |
| 🔧 | `POST` | `/project/:projectId/members/:userId/remove` | `requireProjectMember` + OWNER/SUB_OWNER | メンバーを論理削除 |
| 🔧 | `POST` | `/project/:projectId/members/:userId/promote` | `requireProjectMember` + OWNER | 副責任者に任命 |
| 🆕 | `POST` | `/project/:projectId/members/:userId/demote` | `requireProjectMember` + OWNER | 副責任者を解任 |
| 🆕 | `POST` | `/project/:projectId/leave` | `requireProjectMember` + MEMBERのみ | 自主脱退（責任者・副責任者は不可） |

### 2.3 フォーム（受信・回答側）

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/project/:projectId/forms` | `requireProjectMember` | 自企画宛のフォーム一覧（ステータス・締切含む） |
| 🆕 | `GET` | `/project/:projectId/forms/:formId` | `requireProjectMember` | フォームの詳細・設問内容を取得 |
| 🆕 | `POST` | `/project/:projectId/forms/:formId/answer` | `requireProjectMember` | フォームに回答を送信 |
| 🆕 | `PUT` | `/project/:projectId/forms/:formId/draft` | `requireProjectMember` | フォームの下書きを保存 |
| 🆕 | `DELETE` | `/project/:projectId/forms/:formId/draft` | `requireProjectMember` | フォームの下書きをリセット |

### 2.4 お知らせ（受信側）

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/project/:projectId/notices` | `requireProjectMember` | 自企画宛のお知らせ一覧（ステータス含む） |
| 🆕 | `GET` | `/project/:projectId/notices/:noticeId` | `requireProjectMember` | お知らせの詳細を取得 |
| 🆕 | `POST` | `/project/:projectId/notices/:noticeId/read` | `requireProjectMember` | お知らせを既読にする |

### 2.5 チャット

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/project/:projectId/chat/messages` | `requireProjectMember` | チャットメッセージ一覧を取得 |
| 🆕 | `POST` | `/project/:projectId/chat/messages` | `requireProjectMember` | チャットメッセージを送信 |

### 2.6 設定

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/project/:projectId/settings` | `requireProjectMember` | 企画の設定情報を取得 |
| 🆕 | `PATCH` | `/project/:projectId/settings` | `requireProjectMember` + OWNER | 企画の設定を更新 |

> **備考**: `PATCH /project/:projectId`（企画情報の変更）と `/settings`（通知設定等のユーザー個別設定）の棲み分けは要検討。

---

## 3. 実委 `/committee`（実委人向け）

マウント: `app.route("/committee", committeeRoute)`

全エンドポイントに `requireAuth` + `requireCommitteeMember` を適用。

### 3.1 委員メンバー管理

既存の `/committee-members` を `/committee/members` に移設し、認可を追加。

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🔧 | `GET` | `/committee/members` | なし | 委員メンバー一覧を取得 |
| 🔧 | `POST` | `/committee/members` | `isExecutive` | 委員メンバーを作成（ソフトデリート済みは再有効化） |
| 🔧 | `PATCH` | `/committee/members/:id` | `isExecutive` | 委員メンバーを更新（Bureau、isExecutive等） |
| 🔧 | `DELETE` | `/committee/members/:id` | `isExecutive` | 委員メンバーを論理削除 |

### 3.2 企画管理（マスターシート）

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/committee/projects` | なし | 全企画一覧を取得（フィルタ・検索対応） |
| 🆕 | `GET` | `/committee/projects/:projectId` | なし | 企画の詳細を取得（メンバー数等の集計含む） |
| 🆕 | `GET` | `/committee/projects/:projectId/members` | なし | 任意の企画のメンバー一覧を取得 |
| 🆕 | `GET` | `/committee/projects/:projectId/history` | なし | 企画の更新履歴を取得 |

#### マスターシートのカスタムカラム

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/committee/mastersheet/columns` | なし | カスタムカラム定義一覧を取得 |
| 🆕 | `POST` | `/committee/mastersheet/columns` | なし | カスタムカラムを作成 |
| 🆕 | `PATCH` | `/committee/mastersheet/columns/:columnId` | なし | カスタムカラム定義を更新 |
| 🆕 | `DELETE` | `/committee/mastersheet/columns/:columnId` | なし | カスタムカラムを削除 |
| 🆕 | `PATCH` | `/committee/mastersheet/cells` | なし | セルの値を更新（一括対応） |
| 🆕 | `GET` | `/committee/mastersheet/cells/history` | なし | セルの更新履歴を取得 |

### 3.3 フォーム管理（作成・配信側）

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `POST` | `/committee/forms` | なし | フォームを作成 |
| 🆕 | `GET` | `/committee/forms` | なし | フォーム一覧を取得 |
| 🆕 | `GET` | `/committee/forms/:formId` | なし | フォームの詳細を取得 |
| 🆕 | `PATCH` | `/committee/forms/:formId` | なし | フォームを編集（設問・締切・遅延回答許可等） |
| 🆕 | `DELETE` | `/committee/forms/:formId` | なし | フォームを削除 |
| 🆕 | `POST` | `/committee/forms/:formId/send` | なし | フォームを企画に配信（対象企画IDリスト指定） |
| 🆕 | `POST` | `/committee/forms/:formId/schedule` | なし | フォームの予約送信を設定 |
| 🆕 | `GET` | `/committee/forms/:formId/results` | なし | フォームの回答結果一覧を取得 |
| 🆕 | `GET` | `/committee/forms/:formId/results/:projectId` | なし | 特定企画のフォーム回答を取得 |
| 🆕 | `POST` | `/committee/forms/:formId/share` | なし | フォームを他の委員に共有 |

### 3.4 お知らせ管理（作成・配信側）

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `POST` | `/committee/notices` | なし | お知らせを作成（Markdown本文） |
| 🆕 | `GET` | `/committee/notices` | なし | お知らせ一覧を取得 |
| 🆕 | `GET` | `/committee/notices/:noticeId` | なし | お知らせの詳細を取得 |
| 🆕 | `PATCH` | `/committee/notices/:noticeId` | なし | お知らせを編集 |
| 🆕 | `DELETE` | `/committee/notices/:noticeId` | なし | お知らせを削除 |
| 🆕 | `POST` | `/committee/notices/:noticeId/send` | なし | お知らせを企画に配信（対象企画IDリスト指定） |
| 🆕 | `POST` | `/committee/notices/:noticeId/share` | なし | お知らせを他の委員に共有 |
| 🆕 | `GET` | `/committee/notices/:noticeId/status` | なし | 企画ごとの既読/未読状況を取得 |

### 3.5 承認

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/committee/checks` | なし | 承認待ち項目一覧を取得 |
| 🆕 | `POST` | `/committee/checks/:checkId/approve` | なし | 項目を承認 |
| 🆕 | `POST` | `/committee/checks/:checkId/reject` | なし | 項目を差し戻し |

> **備考**: 「承認」の対象が何か（フォーム回答の承認？企画登録の承認？）は設計書から読み取れないため、要件の明確化が必要。

### 3.6 チャット

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/committee/chat/channels` | なし | チャンネル一覧を取得 |
| 🆕 | `POST` | `/committee/chat/channels` | なし | チャンネルを作成 |
| 🆕 | `GET` | `/committee/chat/channels/:channelId/messages` | なし | メッセージ一覧を取得 |
| 🆕 | `POST` | `/committee/chat/channels/:channelId/messages` | なし | メッセージを送信 |

> **備考**: チャットは WebSocket による実装も検討対象。REST エンドポイントはポーリングベースの場合のフォールバック。

### 3.7 設定

| 状態 | メソッド | パス | 追加認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `GET` | `/committee/settings` | なし | 委員の設定情報を取得 |
| 🆕 | `PATCH` | `/committee/settings` | `isExecutive` | 委員全体の設定を更新 |

---

## 4. 通知 `/push`

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| ✅ | `POST` | `/push/subscribe` | `requireAuth` | Web Push サブスクリプションを登録 |
| 🔧 | `POST` | `/push/send` | `requireAuth` を追加 | Push通知を送信。現在は認証なし |
| 🆕 | `GET` | `/push/subscriptions` | `requireAuth` | 自分の通知登録一覧を取得 |
| 🆕 | `DELETE` | `/push/subscriptions/:id` | `requireAuth` | 通知登録を削除 |

---

## 5. ユーザー `/users`

| 状態 | メソッド | パス | 認可 | 説明 |
|---|---|---|---|---|
| 🆕 | `PATCH` | `/users/me` | `requireAuth` | 自分のプロフィールを更新（名前・電話番号等） |
| 🆕 | `PATCH` | `/users/me/password` | `requireAuth` | パスワードを変更 |
| 🆕 | `POST` | `/users/me/avatar` | `requireAuth` | アイコン画像をアップロード |

> **備考**: パスワードリセット（未ログイン時）は Firebase の機能で処理。ここはログイン後の変更。

---

## エンドポイント数サマリー

| カテゴリ | ✅ 実装済み | 🔧 要変更 | 🆕 新規 | 合計 |
|---|---|---|---|---|
| 認証 `/auth` | 4 | 0 | 0 | 4 |
| 企画 `/project` | 0 | 6 | 17 | 23 |
| 実委 `/committee` | 0 | 4 | 33 | 37 |
| 通知 `/push` | 1 | 1 | 2 | 4 |
| ユーザー `/users` | 0 | 0 | 3 | 3 |
| **合計** | **5** | **11** | **55** | **71** |
