/**
 * No-vig ("fair") pricing, expected value and stake sizing.
 *
 * A sportsbook's posted prices always add up to more than 100%: the surplus is the book's margin,
 * or "hold". A bettor with no edge at all loses exactly that margin over time, which is why every
 * price has to be judged against the margin-free version of itself rather than against a hunch.
 * These are pure functions so the engine, the prompt and the site can all show the same numbers.
 */

export type Priced = { market: string; side: string; decimal_odds: number | string };

/** Both team totals live under one market name but are two separate two-way markets, so they devig apart. */
export function marketGroup(market: string, side: string): string {
  return market === "team_total" ? `team_total:${side.split("_")[0]}` : market;
}

export const priceKey = (o: { market: string; side: string }) => `${o.market}|${o.side}`;

export type FairPrice = {
  /** What the book's price implies, margin included */
  implied: number;
  /**
   * The same price with the book's margin stripped out — but only when `devigged` is true.
   * A market with one price posted has nothing to strip against, and this falls back to `implied`,
   * which is a vigged number. Callers that mean "what the market really thinks" must check the flag;
   * treating a lone longshot price as margin-free would read a free edge into it that isn't there.
   */
  fair: number;
  /** False when the market had only one price and nothing could be removed */
  devigged: boolean;
  /** The market's overround: 0.046 means the posted prices add to 104.6%. Zero when not devigged. */
  hold: number;
  /** EV per $1 of taking this price if `fair` is the true probability. The toll, when devigged. */
  cost: number;
};

/**
 * Strip the book's margin out of every price in an event, one market at a time.
 *
 * Multiplicative devig (divide each implied probability by the overround), which is the standard
 * reading of a "no-vig line". It splits the margin proportionally, so it shades longshots a little
 * generously — close enough for judging a price, not a substitute for a real model.
 *
 * A market with only one price posted has nothing to devig against, so it passes through untouched.
 */
export function fairPrices(offers: Priced[]): Map<string, FairPrice> {
  const groups = new Map<string, Priced[]>();
  for (const o of offers) {
    const k = marketGroup(o.market, o.side);
    groups.set(k, [...(groups.get(k) ?? []), o]);
  }
  const out = new Map<string, FairPrice>();
  for (const list of groups.values()) {
    const decs = list.map((o) => Number(o.decimal_odds));
    const overround = decs.reduce((s, d) => s + (d > 0 ? 1 / d : 0), 0);
    const devigable = list.length >= 2 && overround > 0;
    list.forEach((o, i) => {
      const implied = decs[i] > 0 ? 1 / decs[i] : 0;
      const fair = devigable ? implied / overround : implied;
      out.set(priceKey(o), { implied, fair, devigged: devigable, hold: devigable ? overround - 1 : 0, cost: fair * decs[i] - 1 });
    });
  }
  return out;
}

/** Expected profit per $1 staked. 0.04 means four cents of edge on the dollar. */
export function ev(p: number, dec: number): number {
  return p * dec - 1;
}

/**
 * The Kelly stake: the fraction of a bankroll that maximises long-run growth at this probability
 * and price. Negative when the bet is -EV. Betting a whole Kelly is already aggressive — it's the
 * most you can stake without the growth rate turning against you — so the engine treats it as a
 * ceiling and recommends half of it.
 */
export function kelly(p: number, dec: number): number {
  const b = dec - 1;
  return b > 0 ? (p * b - (1 - p)) / b : 0;
}

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
/** Signed percentage, for EV and edge, where the sign carries the meaning */
export const signedPct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
