/**
 * サイト情報ページ（About / 規約 / ポリシー等）の共通定義。
 * フッターのリンク一覧と sitemap の静的パスをここから生成し、
 * ページ追加時の更新漏れを防ぐ。
 */

/** 運営者表記。特商法表記・プライバシーポリシーの管理主体として使用する。 */
export const SITE_OPERATOR = "Shuichi Higashi（個人運営）";

/** 各ドキュメントの最終改定日。改定したらここを更新する。 */
export const SITE_POLICY_REVISED_AT = "2026年7月21日";

export type SiteInfoLink = {
  href: string;
  label: string;
};

export const SITE_INFO_LINKS: SiteInfoLink[] = [
  { href: "/about", label: "オトノフについて" },
  { href: "/guide", label: "使い方ガイド" },
  { href: "/guidelines", label: "ガイドライン" },
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/tokushoho", label: "特定商取引法に基づく表記" },
  { href: "/contact", label: "お問い合わせ" },
];

/**
 * フッター左側に置く、サービス内の主要導線。
 * アルバム一覧は /charts に統合済みのため、新着順のランキングへ送る。
 */
export const SITE_SERVICE_LINKS: SiteInfoLink[] = [
  { href: "/threads", label: "セッション" },
  { href: "/charts", label: "ランキング" },
  { href: "/charts?sort=newest", label: "アルバム" },
  { href: "/lists", label: "リスト" },
];
