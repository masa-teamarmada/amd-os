/**
 * AMD OS PWA build version
 *
 * コード修正で deploy するたびに必ず patch を bump up する。
 * 画面左上 (GlobalNav の "AMD OS" ロゴ直下) に表示され、
 * キャッシュが効いてリロードが効いてないことを目視で判別できるようにするための運用ルール。
 *
 * 仕様は pwa/CLAUDE.md の「🔢 build version の bump up」セクションを参照。
 */
export const BUILD_VERSION = "v0.12.7";
