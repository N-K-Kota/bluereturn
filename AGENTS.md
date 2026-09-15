<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BlueReturn の作業ガイド

## プロジェクト

- 個人事業向けのローカル会計アプリ。Next.js 16 / React 19 / TypeScript / Tauri 2 / SQLite。
- セットアップ・計算の対象範囲は `README.md`、修正の背景は `docs/design-review.md` を必要に応じて読む。
- パッケージ管理は npm。既存の `package-lock.json` と `src-tauri/Cargo.lock` を使用する。

## 実装の境界

- `lib/accounting/` と税額計算は、副作用のない計算として保つ。
- DBアクセスは `lib/db/`、仕訳の一括保存は `src-tauri/src/journal.rs` に集約する。
- JS側から別々のSQL呼び出しで `BEGIN` / `COMMIT` を送らない。複数テーブルの更新は単一接続のトランザクションにまとめる。
- 申告画面・入力ガイド・印刷で計算を複製しない。`lib/tax/compute.ts` の共通入口を使う。
- 年度や検索条件を切り替える非同期処理では古い応答を破棄する。保存の多重実行を防ぎ、失敗を画面に表示する。
- Next.js は静的エクスポート構成。新たなサーバー機能を導入するときはTauri配布との整合性を確認する。`useSearchParams` の静的生成では `Suspense` を確認する。

## 会計・データ

- 金額は整数円を基本とし、日付・借貸一致・科目の存在を保存境界で検証する。
- 税制は対象年度を明示し、変更前に国税庁の一次資料で確認する。最新年度の制度を過年度へ流用しない。
- 税計算の変更には、境界値・端数・赤字・還付など変更に関係する回帰テストを追加する。
- 「未入力」と明示的な `0` を区別する。消費税の税込・税抜の単位を画面・保存・計算で一致させる。
- DB変更は既存データを保持するマイグレーションで行う。実際の `aoshoku.db` を初期化したり、テストデータを追加したりしない。検証は一時DB・メモリDBで行う。
- CSV、マイナンバー、認証情報などの実データをテストやログに含めない。

## 検証

変更した範囲に応じて実行する。ドキュメント・Codex設定だけの変更ではアプリ全体のビルドは不要。

| 変更 | 確認 |
| --- | --- |
| TypeScript・React | `npm run typecheck`、`npm run lint` |
| 会計・税額・CSV・入力検証 | `npm test` |
| ルート・レイアウト・Next.js設定・依存関係 | `npm run build` |
| Rust・トランザクション | `cargo test --manifest-path src-tauri/Cargo.toml --lib` |

- GUI・SQLiteを含む動作確認は `npm run tauri -- dev`。通常のブラウザではDB機能は動かない。
- 開発サーバーやTauriがすでに起動中なら、そのプロセスを再利用して重複起動を避ける。
- ネットワークやサンドボックスが原因の失敗を、コードの不具合やDB破損と断定しない。原因を切り分けて必要な権限で再確認する。
- 最終報告に変更の目的、検証結果、残る制限を記載する。未確認のGUI操作を「確認済み」としない。

## レビューの重点

- 貸借対照表の累積残高と期間損益、営業外収益・費用の取りこぼし。
- 保存の一部成功、参照整合性、エラーを無条件で無視するマイグレーション。
- 年度別控除、入力の単位、端数処理、画面間の計算結果の差。
- CSVの引用符・改行・文字コード・返金・入出金別の辞書照合。
