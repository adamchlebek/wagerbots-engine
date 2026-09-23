import { pct, signedPct } from "./devig.js";
import { DAILY_TURNOVER_MAX, DAILY_TURNOVER_PCT, MIN_BUCKET, MIN_CALIBRATION_N } from "./limits.js";

/**
 * A model's own record, priced honestly and handed back to it every turn.
 *
 * Two numbers do the work. `impliedWins` is how many bets the prices themselves expected to win, so
 * the gap between it and the real count says whether the model beat the market or was lucky.
 * `calibration` compares the probabilities it stated against how often those bets actually landed,
 * which is the check that keeps a stated probability from drifting into wishful thinking.
 *
 * Building this needs the app's own tables, so that stays in the app. What lives here is the shape
 * and the wording — the part that has to read the same in every place a model is asked to bet.
 */
export type Bucket = { label: string; n: number; won: number; net: number };

export type Scorecard = {
  settled: number; won: number; staked: number; net: number; impliedWins: number;
  calibration: { n: number; said: number; hit: number } | null;
  stakedToday: number;
  /**
   * Closing line value, over bets whose game has started. `move` is how far the market's fair
   * probability for the pick moved between the bet and the start (margin-free, singles only); `ev` is
   * each bet's EV at that closing fair price, which carries the margin paid, so an unmoved line sits
   * at about −2 to −5%.
   */
  clv: { n: number; ev: number; move: number | null; toward: number | null } | null;
  /** Settled record by sport and market, and by how much edge was claimed over fair */
  byMarket: Bucket[];
  byEdge: Bucket[];
};

/** Group rows into labelled win/loss/net buckets, dropping anything too small to mean much. */
export function buckets<T>(
  rows: T[], key: (r: T) => string | null, won: (r: T) => boolean, net: (r: T) => number, min = MIN_BUCKET,
): Bucket[] {
  const m = new Map<string, Bucket>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const b = m.get(k) ?? { label: k, n: 0, won: 0, net: 0 };
    b.n++; if (won(r)) b.won++; b.net += net(r);
    m.set(k, b);
  }
  return [...m.values()].filter((b) => b.n >= min).sort((a, b) => b.net - a.net);
}

/** How much edge a bet claimed over the market, as a label. */
export function edgeBucket(claimed: number | null, fair: number | null): string | null {
  if (claimed == null || fair == null) return null;
  const pts = (claimed - fair) * 100;
  return pts < 5 ? "claimed under 5 pts of edge" : pts < 10 ? "claimed 5-10 pts" : "claimed 10+ pts";
}

const money = (n: number) => `$${n.toFixed(2)}`;
export const bucketText = (b: Bucket) =>
  `${b.label} ${b.won}-${b.n - b.won} ${b.net >= 0 ? "+" : "−"}${money(Math.abs(b.net))}`;

/** The scorecard as the two or three lines a model reads before it bets again. */
export function formatScorecard(card: Scorecard, bankroll: number): string[] {
  const out: string[] = [];
  if (card.settled) {
    out.push(`Your settled book: ${card.won}-${card.settled - card.won}, ${money(card.staked)} staked, net ${card.net >= 0 ? "+" : "−"}${money(Math.abs(card.net))}.`);
    // The gap between these two is the whole question: everything else is the story you tell about it
    out.push(`  The prices you took expected ${card.impliedWins.toFixed(1)} wins. You have ${card.won}.`);
  }
  if (card.clv) {
    const { n, ev: closeEv, move, toward } = card.clv;
    // The steadiest skill signal there is: it doesn't wait for results, and luck barely touches it
    const moved = move == null ? "" : ` Between your bet and the start, the market's fair probability for your pick moved ${move >= 0 ? "+" : "−"}${(Math.abs(move) * 100).toFixed(1)} points on average, toward you on ${pct(toward ?? 0, 0)} of them. ${
      move > 0.01 ? "The market has been coming to your picks after you bet: that is what a real edge looks like."
        : move < -0.01 ? "The market has been moving away from your picks after you bet: your reasons were mostly already in the price, or wrong."
          : "It has barely moved: so far your picks are ones the market already agreed with, and you pay the margin on each."}`;
    out.push(`Against the closing line (${n} bets whose games have started): priced at the market's final fair odds, your bets averaged ${signedPct(closeEv)} EV (an unmoved line costs you about the margin, roughly −2 to −5%).${moved}`);
  }
  if (card.byMarket.length) {
    const best = card.byMarket.slice(0, 3), worst = card.byMarket.slice(-3).reverse().filter((b) => b.net < 0 && !best.includes(b));
    out.push(`Where your settled results come from (${MIN_BUCKET}+ bets each): best ${best.map(bucketText).join(" · ")}${worst.length ? `; worst ${worst.map(bucketText).join(" · ")}` : ""}. Small samples, but a market you keep losing in deserves a harder look.`);
  }
  if (card.byEdge.length) out.push(`By the edge you claimed: ${card.byEdge.map(bucketText).join(" · ")}.`);
  if (card.calibration) {
    const { n, said, hit } = card.calibration;
    const gap = said - hit;
    // A cold streak over a few dozen bets is mostly luck. Telling a model to "back its reads harder"
    // off one turned into inflated claims, so running cold is never a reason to raise a number.
    const verdict = n < MIN_CALIBRATION_N
      ? `${n} bets is too few to judge: a gap either way is mostly luck. Keep pricing each bet on its own evidence.`
      : gap > 0.05
        ? `You are running ${(gap * 100).toFixed(0)} points hot: you have been claiming more edge than you have. Shade your probabilities down before you bet.`
        : gap < -0.05
          ? `You have won more than you claimed. That is welcome, but it is not a reason to raise your numbers: price the next bet on its own evidence.`
          : `That is in line — your numbers are honest, keep pricing this way.`;
    out.push(`Your calibration over ${n} settled bets: you said ${pct(said, 0)} on average, ${pct(hit, 0)} actually won. ${verdict}`);
  }
  const budget = DAILY_TURNOVER_PCT * bankroll;
  const limit = DAILY_TURNOVER_MAX * bankroll;
  out.push(`Staked today: ${money(card.stakedToday)} against a ${money(budget)} daily guideline (${money(limit)} hard limit). ${
    card.stakedToday > budget
      ? "You are past the guideline. Every extra bet today needs to be one you would regret missing."
      : "Every bet pays the margin, so fewer, stronger bets beat more thin ones."}`);
  return out;
}
