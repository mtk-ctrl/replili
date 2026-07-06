# Flag Crafters（仮）

2.5D見下ろしの陣取り対戦ゲーム。ラボ内部の7×7グリッドを土台にしたランダム迷路（大広間・長い廊下・個室が混在）を舞台に、赤 vs 青の2チームが複数の旗を奪い合う。剣（近接）と弓（遠距離）でプレイヤー同士の戦闘もできる。詳しいルール・数値バランスは Artifact の設計仕様書（design-doc）を参照する。ここには実装を進める上で毎回必要になる最小限だけを書く。

## スタックと起動コマンド

`web/` が実装本体。TypeScript + [Phaser 3](https://phaser.io/) + Vite。ホスティングは Vercel、将来的にオンライン対戦を Supabase (Realtime/Auth/DB) で追加する想定。

```
cd web
npm install
npm run dev       # 開発サーバー
npm run build     # 型チェック(tsc -b) + 本番ビルド
npm run preview   # ビルド結果をローカルで確認
```

## Vercel デプロイ情報

**本番環境URL:** https://replili-vdv4.vercel.app

**デプロイダッシュボード:** https://vercel.com/mtk-ctrls-projects/replili-vdv4

- `main` ブランチへの push で自動デプロイ開始
- デプロイ状況はダッシュボードで確認可能
- ゲーム画面確認はVercelのホスト版URLで実施

## ディレクトリ構成

```
web/src/
  main.ts              Phaser.Game の起動
  config.ts            体力・ダメージ・クールダウンなどのバランス数値
  scenes/MainScene.ts   ゲームループ・入力・HUD・試合進行・FOV管理の中心
  world/LabMap.ts       ラボマップ生成（7×7グリッド上のランダム迷路、大広間/長い廊下/個室の混在）、当たり判定、視線判定、Bot用経路探索
  entities/             Character（プレイヤー/Bot共通）, BotAI, Flag, Arrow
  match/MatchManager.ts 制限時間・勝敗・サドンデスの判定
```

新しいゲームプレイ要素は、原則としてこの構成の対応するディレクトリに追加する。

## 現在の開発フェーズ

**Phase 1: Bot対戦のシングルプレイ版** — 通信なしで、マップ・移動・戦闘・旗の陣取り・制限時間・勝敗判定までが一通り遊べる状態を作っている。オンライン対戦（Supabase Realtime でBotを人間プレイヤーに置き換える）はまだ着手していない。

## 守るべき設計上の制約

- 見下ろし2.5D固定（3D化はしない）
- まずPCブラウザ（キーボード＋マウス）専用。モバイル対応は未着手
- 旗の総数は必ず奇数にする（時間切れ時の同数を避けるため）。同数のまま時間切れになった場合のみサドンデスに入る
- 数値バランスやルールの詳細をここに転記しない。設計仕様書側で管理し、ここは要点のみを参照する

## Git運用ルール

このリポジトリでは、変更を作業ブランチにコミットしたら **都度確認を取らずに push し、そのまま main にマージしてよい**（本人の指示による恒久的な許可）。具体的には毎回:

1. 作業ブランチへ `git push -u origin <branch>`
2. そのブランチを `main` にマージし、`git push origin main`

を実行する。force push や履歴の書き換えなど、これ以外の破壊的操作は引き続き事前確認が必要。
