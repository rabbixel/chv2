const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  AMP: "&",
  apos: "'",
  quot: '"',
  QUOT: '"',
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  nbsp: "\u00a0",
  iexcl: "¡", cent: "¢", pound: "£", curren: "¤", yen: "¥", brvbar: "¦",
  sect: "§", uml: "¨", copy: "©", ordf: "ª", laquo: "«", not: "¬",
  shy: "\u00ad", reg: "®", macr: "¯", deg: "°", plusmn: "±", sup2: "²",
  sup3: "³", acute: "´", micro: "µ", para: "¶", middot: "·", cedil: "¸",
  sup1: "¹", ordm: "º", raquo: "»", frac14: "¼", frac12: "½", frac34: "¾",
  iquest: "¿", Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä",
  Aring: "Å", AElig: "Æ", Ccedil: "Ç", Egrave: "È", Eacute: "É", Ecirc: "Ê",
  Euml: "Ë", Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï", ETH: "Ð",
  Ntilde: "Ñ", Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö",
  times: "×", Oslash: "Ø", Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü",
  Yacute: "Ý", THORN: "Þ", szlig: "ß", agrave: "à", aacute: "á", acirc: "â",
  atilde: "ã", auml: "ä", aring: "å", aelig: "æ", ccedil: "ç", egrave: "è",
  eacute: "é", ecirc: "ê", euml: "ë", igrave: "ì", iacute: "í", icirc: "î",
  iuml: "ï", eth: "ð", ntilde: "ñ", ograve: "ò", oacute: "ó", ocirc: "ô",
  otilde: "õ", ouml: "ö", divide: "÷", oslash: "ø", ugrave: "ù", uacute: "ú",
  ucirc: "û", uuml: "ü", yacute: "ý", thorn: "þ", yuml: "ÿ",
  OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ", fnof: "ƒ",
  circ: "ˆ", tilde: "˜", ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009",
  zwnj: "\u200c", zwj: "\u200d", lrm: "\u200e", rlm: "\u200f",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  sbquo: "‚", bdquo: "„", dagger: "†", Dagger: "‡", bull: "•",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  permil: "‰", prime: "′", Prime: "″", lsaquo: "‹", rsaquo: "›", oline: "‾",
  frasl: "⁄", euro: "€", trade: "™", minus: "−", le: "≤", ge: "≥", ne: "≠",
  asymp: "≈", infin: "∞", radic: "√", sum: "∑", prod: "∏", pi: "π",
  larr: "←", uarr: "↑", rarr: "→", darr: "↓", harr: "↔", lArr: "⇐",
  uArr: "⇑", rArr: "⇒", dArr: "⇓", hArr: "⇔", loz: "◊", spades: "♠",
  clubs: "♣", hearts: "♥", diams: "♦",
};

/** Decode one layer of HTML entities into plain text; React renders the result as text. */
export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (entity, token: string) => {
    if (token.startsWith("#")) {
      const hexadecimal = token[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      if (
        !Number.isInteger(codePoint) ||
        codePoint <= 0 ||
        codePoint > 0x10ffff ||
        (codePoint >= 0xd800 && codePoint <= 0xdfff)
      ) {
        return entity;
      }
      return String.fromCodePoint(codePoint);
    }
    return Object.hasOwn(NAMED_ENTITIES, token) ? NAMED_ENTITIES[token] : entity;
  });
}
