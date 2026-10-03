/** Read the legacy WPBakery cards as data; never execute or render their HTML. */
export interface WordPressCollectionCard {
  slug: string;
  title: string;
  mediaId: number;
  countLabel?: string;
}

export function decodeWordPressText(value: string): string {
  return value.replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
    const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
  }).replace(/&quot;|&amp;|&apos;|&lt;|&gt;|&nbsp;/g, (entity) =>
    ({ "&quot;": '"', "&amp;": "&", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " })[entity] ?? entity);
}

function attributes(value: string): Record<string, string> {
  const normalized = decodeWordPressText(value).replace(/[“”″]/g, '"');
  return Object.fromEntries([...normalized.matchAll(/([\w_]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

export function parseCollectionCards(content: string): WordPressCollectionCard[] {
  return [...content.matchAll(/\[vc_single_image\s+([^\]]+)\]([\s\S]*?)(?=\[vc_single_image|$)/g)].flatMap((match) => {
    const attrs = attributes(match[1]);
    const title = match[2].match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    if (!title || !attrs.link || !/^\d+$/.test(attrs.image ?? "")) return [];
    let slug: string;
    try { slug = new URL(attrs.link).pathname.split("/").filter(Boolean).at(-1) ?? ""; } catch { return []; }
    if (!slug || !/^[\w-]+$/.test(slug)) return [];
    const countLabel = match[2].match(/<span\b[^>]*class="bendown"[^>]*>([^<]+)<\/span>/i)?.[1];
    return [{ slug, title: decodeWordPressText(title.replace(/<[^>]*>/g, "")).trim(), mediaId: Number(attrs.image), countLabel }];
  });
}

export function collectionGridQuery(content: string): string | undefined {
  const match = content.match(/\[grid_plus\s+([^\]]+)\]/);
  return match ? attributes(match[1]).name : undefined;
}
