/**
 * The WagerBots betting engine: the pure part.
 *
 * Everything here is a function of its arguments — no database, no network, no framework. That is
 * the whole design constraint, and it is what lets WagerBots and Silicon Springs share it instead of
 * each keeping a copy that quietly drifts.
 *
 * What deliberately is NOT here: anything that reads a table. The two apps store bets in different
 * schemas, so each builds its own `Scorecard` and hands it to `formatScorecard`, and each places its
 * own bets after asking `quote` what the claim is worth.
 */
export * from "./odds.js";
export * from "./devig.js";
export * from "./limits.js";
export * from "./sizing.js";
export * from "./scorecard.js";
export * from "./instructions.js";
