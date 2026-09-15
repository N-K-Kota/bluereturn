# Codex設定

2026-09-15、Codex CLI 0.154.0で確認。

## ファイルの役割

| ファイル | 対象 |
| --- | --- |
| `~/.codex/AGENTS.md` | 日本語での報告、許可済み作業の継続、差分保持など個人の共通方針 |
| `~/.codex/config.toml` | ワークスペース内の書き込みと承認方法の個人既定値 |
| `AGENTS.md` | このアプリの構成、会計の制約、検証コマンド |
| `.codex/config.toml` | このプロジェクトの推論・Web検索・ネットワーク設定 |

指示ファイル名は大文字・複数形の `AGENTS.md` を使用する。`Agent.md` や別名の複製は作らない。プロジェクトは個人設定で `trusted` に登録されているため、プロジェクト設定を読み込める。

## 採用した設定

- 共通：`sandbox_mode = "workspace-write"`、`approval_policy = "on-request"`。
- 共通：`approvals_reviewer = "auto_review"`。対象となる承認要求を自動レビューへ回す。外部アプリのレビュー担当は `apps._default.approvals_reviewer = "user"` とする。
- このプロジェクト：`model_reasoning_effort = "high"`。会計・税額など、正確性を重視する作業向け。簡単な作業はアプリやCLIで変更できる。
- このプロジェクト：`web_search = "live"`。税制やバージョン別ドキュメントの現行資料を確認する。
- このプロジェクト：`sandbox_workspace_write.network_access = true`。パッケージ取得・開発サーバー・localhostの確認を可能にする。この設定は接続先の限定ではなく、サンドボックス内のネットワーク利用を許可する。
- モデル名・サービス階層・トークン上限・実験的機能は固定しない。

自動レビューやネットワーク許可を設定しても、保護されたパス・管理ポリシー・GUI操作などの制約は残り、承認が必要になる場合がある。管理ポリシーや起動時のオプションが設定ファイルより優先する場合もある。

## 反映・検証

新しいCodexセッションをこのリポジトリで開始する。実行中のセッションの権限・指示が、そのまま切り替わるとは限らない。

```sh
codex --strict-config doctor --summary --ascii
```

設定読み込みとランタイムの状態を確認する。サンドボックス内で診断した場合、ネットワークや状態DBへのアクセス制限が診断結果に含まれるため、失敗の原因を切り分ける。

個人設定の変更前ファイルは `~/.codex/backups/settings-日時/` に保存する。リポジトリの変更はGitの差分で確認する。

## 公式資料

- [設定ファイルと優先順位](https://learn.chatgpt.com/docs/config-file/config-basic)
- [設定キーと承認方法](https://learn.chatgpt.com/docs/config-file/config-reference)
- [AGENTS.mdの探索と適用範囲](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
