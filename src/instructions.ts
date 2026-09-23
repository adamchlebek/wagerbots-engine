import { pct } from "./devig.js";
import {
  DAILY_TURNOVER_MAX, DAILY_TURNOVER_PCT, MAX_EDGE, MAX_EVENT_PCT, MAX_STAKE_PCT, MIN_EV,
} from "./limits.js";

/**
 * What a model has to be told before it is allowed to bet money.
 *
 * This is the part of the prompt that is true wherever betting happens, so it is kept apart from
 * the surrounding app: WagerBots wraps it in a competition between models, Silicon Springs wraps it
 * in a venue a resident walks into. Neither owns the wording.
 *
 * Tool names are arguments rather than literals for the same reason — the rules are identical, only
 * the verbs differ. Every number comes from limits.ts, so the text can never promise a bar the code
 * doesn't enforce.
 */

export type ToolNames = {
  /** The tool that places a single bet */
  bet?: string;
  /** The tool that places a multi-leg bet, or null where there isn't one */
  parlay?: string | null;
  /** The tool that runs a web search */
  search?: string;
};

const DEFAULT_TOOLS: Required<ToolNames> = { bet: "place_bet", parlay: "place_parlay", search: "web_search" };

/**
 * Why the market, not the teams, is the thing to beat — and what kind of knowledge can actually beat
 * it. The longest-lived part of the prompt and the one that changes behaviour most: without it a
 * model argues from records and rankings, which is an argument for the price it is being charged.
 */
export function priceDiscipline(tools: ToolNames = {}): string {
  const t = { ...DEFAULT_TOOLS, ...tools };
  return `THE PRICE IS YOUR OPPONENT, NOT THE TEAMS
- Every market is posted with a margin built in. The two sides of a baseball moneyline add up to about 104-105%; a three-way soccer market to 107-108%. That surplus is the book's cut, and a bettor with no real edge pays it on every bet. Bet often enough at fair prices and you lose, however smart each individual pick felt.
- So every selection shows its fair probability: the same price with the margin stripped out. That is the market's honest opinion, and the market is very good. It is the number you have to beat.
- Each market also shows its hold. A 7.9% market costs you roughly twice as much to enter as a 4.2% one, so it needs a correspondingly bigger edge to be worth touching.
- Beating the fair number means knowing something it doesn't: news it hasn't absorbed, a lineup, a weather read, a total the market has been slow to move. "This team is better" is already in the price. So is "they're 4-0". So is the starting pitcher's ERA. Records, rankings and season stats are the most thoroughly priced information that exists — an argument built only from them is an argument for the price you are being charged.
- News is only an edge while it is fresh. A player on the injured list, a season-ending injury, anything reported more than a day ago — the line was set with it, however dramatic the list of names looks. What the market can still be slow on: lineups and starting pitchers or quarterbacks confirmed today, late scratches, game-day weather for totals. When you find a piece of news, check when it broke. If it broke before the line was posted, it is in the price.
- Search for the specific thing that would change a specific game ("Guardians Red Sox probable pitchers September 23", "Camden Yards wind forecast tonight"), not for news in general. A vague ${t.search} gives you vague reasons, and vague reasons are already priced.
- The board is full of games. Almost none of them are bets. Passing costs you nothing. A bet at a fair price costs you the margin, every time.`;
}

/**
 * What a stated probability means and why inflating it is self-defeating. Pair this with an engine
 * that actually enforces MIN_EV and caps the claim at MAX_EDGE — said without the enforcement, it is
 * a suggestion, and a model that wants a bet through will simply type a bigger number.
 */
export function claimDiscipline(tools: ToolNames = {}): string {
  const t = { ...DEFAULT_TOOLS, ...tools };
  const placers = t.parlay ? `${t.bet} and ${t.parlay}` : t.bet;
  return `WHAT IT TAKES TO PLACE A BET
- ${placers} ask${t.parlay ? "" : "s"} for win_probability: your honest probability that the bet wins, from 0 to 1. Not a confidence score, not how much you like it. Saying 0.55 is claiming this wins 55 times out of 100.
- The bet goes through only if that probability beats the price by at least ${(MIN_EV * 100).toFixed(0)}% expected value: win_probability × decimal odds − 1 ≥ ${MIN_EV.toFixed(2)}. The bar sits above the margin on purpose.
- Decide your probability before you look at what the bar needs, and state it once. The first probability you give a selection is the one that counts for the rest of the turn: if it is refused, the answer is to leave the bet, not to try again with a bigger number. A resubmitted higher claim is refused automatically.
- No claim is credited with more than ${(MAX_EDGE * 100).toFixed(0)} points of edge over the fair price. Say what you believe and it is recorded as said, but it is priced and sized as if it were ${(MAX_EDGE * 100).toFixed(0)} points over fair.
- Inflating the number to force a bet through is the single most reliable way to lose. Every probability you state is recorded and checked against what actually happened. Your own calibration comes back to you at the top of every turn, and it is public.
- Before you commit a number, argue the other side for a moment. If the fair price says 42% and you are about to type 0.55, you are claiming the market is wrong by thirteen points. Occasionally it is. Usually you have found a reason the market already knows.`;
}

/** How much to stake, and why more bets is not more profit. */
export function stakeDiscipline(): string {
  return `HOW MUCH TO STAKE
- Your stake is capped by your own claim. Full Kelly at your probability and price is (win_probability × odds − 1) / (odds − 1) of your available cash, and the hard ceiling is that or ${(MAX_STAKE_PCT * 100).toFixed(0)}% of cash, whichever is smaller. Claim a bigger edge and you may stake more, but the claim is on the record.
- Stake about half of Kelly. It costs very little long-run growth and roughly halves the swings. Every tool result tells you both numbers, and the refusal tells you the cap.
- Several bets on one game are one bet: the moneyline, the run line, a team total and the under all win or lose together when the same thing happens. No more than ${(MAX_EVENT_PCT * 100).toFixed(0)}% of your bankroll (cash plus open stakes) can ride on any one game, counting every bet and parlay leg on it.
- Every bet pays the margin, so more bets is not more profit: a day of a few strong bets beats a day of many thin ones. Aim to stake no more than ${(DAILY_TURNOVER_PCT * 100).toFixed(0)}% of your bankroll in one ET day; ${(DAILY_TURNOVER_MAX * 100).toFixed(0)}% is a hard limit.
- Cash you have already committed is cash you cannot use on a better spot tomorrow. Watch how much of your bankroll is riding at once, and keep enough dry to keep playing.
- Losing does not make the next bet better. There is no such thing as getting it back. Winning does not make a read proven either: a handful of results is mostly luck, and the next game's price already knows what you know.`;
}

/** Margin compounds with every leg, which is the whole story of parlays. */
export function parlayDiscipline(tools: ToolNames = {}): string {
  const t = { ...DEFAULT_TOOLS, ...tools };
  if (!t.parlay) return "";
  return `- Parlays: combine 2 or more selections from DIFFERENT events with ${t.parlay}. Payout is the product of the decimal odds. A pushed or voided leg drops out. Note that the margin compounds with every leg — a four-leg parlay of fairly-priced sides pays away four margins at once — so a parlay needs a real edge on each leg, not one good leg carrying three fillers.`;
}

/** The three blocks together: everything true about betting, in reading order. */
export function bettingDiscipline(tools: ToolNames = {}): string {
  return [priceDiscipline(tools), claimDiscipline(tools), stakeDiscipline()].join("\n\n");
}

/** A one-line reminder of the bar, for a refusal message or a venue's rules summary. */
export const barSummary = () =>
  `A bet needs at least ${pct(MIN_EV, 0)} expected value at your own stated probability, which is capped at ${(MAX_EDGE * 100).toFixed(0)} points over the market's fair price. Stake at most ${(MAX_STAKE_PCT * 100).toFixed(0)}% of cash on one bet and ${(MAX_EVENT_PCT * 100).toFixed(0)}% of bankroll on one game.`;
