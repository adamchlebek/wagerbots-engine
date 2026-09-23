import { ev, kelly } from "./devig.js";
import { KELLY_TARGET, MAX_EDGE, MAX_STAKE_PCT, MIN_EV } from "./limits.js";

/**
 * Turning a stated probability into a stake, and deciding whether the bet is allowed at all.
 *
 * The whole point is that the model's claim is not taken at face value for money purposes. It is
 * recorded exactly as said — that is what calibration is checked against later — but it is *priced*
 * capped at MAX_EDGE over the market's fair number. Otherwise the way to bet bigger is simply to
 * claim more, and the claim stops meaning anything.
 */

/** The most a claim of `p` at these odds may stake, and what it should stake. */
export function sizing(p: number, dec: number, cash: number) {
  const k = kelly(p, dec);
  const cap = Math.min(Math.max(k, 0), MAX_STAKE_PCT) * cash;
  return { kelly: k, cap, suggested: Math.min(Math.max(k, 0) * KELLY_TARGET * cash, cap) };
}

/**
 * The probability a stake is actually computed from: the claim, held to at most MAX_EDGE above the
 * market's fair price. With no fair price to measure against (a market with one price posted, so
 * nothing to devig), the claim stands — there is no honest number to cap it against.
 */
export function pricedProbability(claimed: number, fair: number | null): number {
  if (fair == null) return claimed;
  return Math.min(claimed, fair + MAX_EDGE);
}

/** One intended bet, priced: the claim, the odds taken, and what the two together justify. */
export type Quote = {
  /** The probability the model stated, recorded as-is */
  claimed: number;
  /** The probability actually priced: the claim, capped at MAX_EDGE over fair */
  p: number;
  dec: number;
  /** The market's margin-free probability for the same outcome, when it could be devigged */
  fair: number | null;
  /** The margin this market charges to enter (singles only) */
  hold: number | null;
  ev: number;
  kelly: number;
  /** Most this claim may stake */
  cap: number;
  /** Half Kelly: what it should stake */
  suggested: number;
};

/** Price a claim at a price: everything needed to accept, refuse or size the bet. */
export function quote(args: {
  claimed: number; dec: number; cash: number; fair?: number | null; hold?: number | null;
}): Quote {
  const fair = args.fair ?? null;
  const p = pricedProbability(args.claimed, fair);
  const { kelly: k, cap, suggested } = sizing(p, args.dec, args.cash);
  return { claimed: args.claimed, p, dec: args.dec, fair, hold: args.hold ?? null, ev: ev(p, args.dec), kelly: k, cap, suggested };
}

/** Whether a quote clears the EV bar. The claim is capped first, so claiming more cannot buy a pass. */
export const clearsBar = (q: Quote, minEv = MIN_EV) => q.ev >= minEv;
