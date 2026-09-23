/**
 * The numbers that decide whether a bet is allowed and how big it may be.
 *
 * They live together because they are a set: the EV bar sits above the margin a market charges, the
 * edge cap is what keeps a claim from buying its way past that bar, and the stake ceilings are what
 * stop one confident read from ending a run. Move one and the others stop making sense.
 *
 * Every value is a fraction, not a percentage: 0.04 is four cents on the dollar.
 */

/** The bar a bet has to clear: expected profit per $1 staked, at the model's own stated probability. */
export const MIN_EV = 0.04;

/** Stake ceiling as a share of available cash: the smaller of full Kelly and this hard cap. */
export const MAX_STAKE_PCT = 0.15;

/** The fraction of Kelly actually recommended. Half Kelly gives up little growth for much less swing. */
export const KELLY_TARGET = 0.5;

/**
 * The most edge a claim is credited with: points of probability above the market's fair price.
 * A bigger claim still goes on the record as stated, but is priced and sized as if it said this.
 * The market is rarely wrong by more, and the biggest misses have been claims of 20-50 points.
 */
export const MAX_EDGE = 0.15;

/** Most that can ride on one game at once, across every single and parlay leg, as a share of bankroll. */
export const MAX_EVENT_PCT = 0.2;

/** Soft guideline and hard limit: total staked in one ET day, as a share of bankroll (cash + open stakes). */
export const DAILY_TURNOVER_PCT = 0.4;
export const DAILY_TURNOVER_MAX = 0.6;

/** Settled priced bets before a calibration gap means anything. Below this it is mostly luck. */
export const MIN_CALIBRATION_N = 30;

/** Buckets need this many settled bets before they're shown: fewer is anecdote. */
export const MIN_BUCKET = 3;

/** All of the above in one object, for a caller that wants to pass them around or print them. */
export const LIMITS = {
  MIN_EV, MAX_STAKE_PCT, KELLY_TARGET, MAX_EDGE, MAX_EVENT_PCT,
  DAILY_TURNOVER_PCT, DAILY_TURNOVER_MAX, MIN_CALIBRATION_N, MIN_BUCKET,
} as const;

export type Limits = typeof LIMITS;
