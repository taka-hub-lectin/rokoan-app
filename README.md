# ロコ庵 運営ハブ

民泊運営の道具を1か所にまとめた、軽量なWebアプリ集です。
GitHub Pages などに静的に置いて、iPadやスマホの「ホーム画面に追加」で使います。

## フォルダ構成

```
rokoan-app/
├ index.html        … ホーム（機能カードが並ぶ入口）
├ cleaning.html     … 清掃チェック（自己完結・お母さん用）
├ _template.html    … 新機能のひな型（複製して使う）
├ README.md         … このファイル
└ shared/
   ├ tokens.css     … 共通デザイン（色・フォント）
   └ store.js       … 共有データ窓口（差し替え式）
```

## 設計の考え方

- **機能はカードを足すだけで増える** … `index.html` の `MODULES` に1行追加。
- **保存は `Store` に集約** … 各機能は `shared/store.js` の `Store` だけを使い、
  `localStorage` を直接触らない。
- **裏側は差し替え式** … 今は端末内保存。将来「家族で共有・同期」したく
  なったら、`store.js` の `RemoteAdapter`（Google Sheets＋GAS）を実装して
  `BACKEND` を差し替えるだけ。**各機能の画面は直さなくてよい。**

## 新しい機能の足し方（3ステップ）

1. `_template.html` を複製し、`outsourcing.html` など分かる名前にリネーム。
2. 中身を作る。データの読み書きは `Store.get / Store.set / Store.remove / Store.list` を使う。
3. `index.html` の `MODULES` に1行追加して登録する。
   ```js
   { name:"外注管理", desc:"業者一覧・依頼の管理", icon:"🛠️", url:"outsourcing.html", ready:true },
   ```

## 公開（デプロイ）

- このフォルダ一式を GitHub Pages に置く（`index.html` がルートに来るように）。
- 公開URLを iPad の Safari で開き、「ホーム画面に追加」。
  - お母さんは `cleaning.html` を直接ホーム画面に追加すれば、ワンタップで清掃チェックへ。
  - 管理用には `index.html`（ハブ）を追加。

## メモ

- いまの保存は端末ごと（共有されません）。共有が必要になったら上記の差し替えで対応。
- `cleaning.html` は単体で動くよう自己完結で作ってあります（電波が弱くても安定）。
