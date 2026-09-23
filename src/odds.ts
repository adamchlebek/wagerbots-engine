export function americanToDecimal(price: number): number {
  return price > 0 ? 1 + price / 100 : 1 + 100 / Math.abs(price);
}

export function decimalToAmerican(dec: number): number {
  if (dec <= 1) return 0;
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}

/** Implied probability (0-1) of decimal odds. */
export function impliedProb(dec: number): number {
  return 1 / dec;
}

export function fmtAmerican(price: number | null | undefined): string {
  if (price == null) return "";
  return price > 0 ? `+${price}` : `${price}`;
}

export function fmtLine(line: number | null | undefined, signed = true): string {
  if (line == null) return "";
  const s = Number(line).toString();
  return signed && line > 0 ? `+${s}` : s;
}
