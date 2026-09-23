import assert from "node:assert/strict";
import { test } from "node:test";
import {
  americanToDecimal, decimalToAmerican, ev, fairPrices, kelly, MAX_EDGE, MAX_STAKE_PCT, MIN_EV,
  pricedProbability, quote, clearsBar, buckets, formatScorecard, bettingDiscipline, type Scorecard,
} from "../src/index";

test("american ↔ decimal round-trips", () => {
  for (const price of [-250, -131, -110, 100, 145, 320]) {
    assert.equal(decimalToAmerican(americanToDecimal(price)), price);
  }
});

test("devig strips the margin and reports the hold", () => {
  // A −110 / −110 two-way market: both sides imply 52.38%, so the book holds ~4.76%
  const dec = americanToDecimal(-110);
  const f = fairPrices([
    { market: "spread", side: "home", decimal_odds: dec },
    { market: "spread", side: "away", decimal_odds: dec },
  ]);
  const home = f.get("spread|home")!;
  assert.ok(home.devigged);
  assert.ok(Math.abs(home.fair - 0.5) < 1e-9, "a symmetric market devigs to exactly 50%");
  assert.ok(Math.abs(home.hold - 0.0476) < 0.001, `hold ~4.76%, got ${home.hold}`);
  assert.ok(home.implied > home.fair, "the posted price always implies more than the fair one");
});

test("a lone price cannot be devigged and says so", () => {
  const f = fairPrices([{ market: "moneyline", side: "home", decimal_odds: 3.5 }]);
  const only = f.get("moneyline|home")!;
  assert.equal(only.devigged, false, "nothing to strip against");
  assert.equal(only.hold, 0);
  assert.equal(only.fair, only.implied, "falls back to the vigged number");
});

test("team totals devig as separate two-way markets", () => {
  const f = fairPrices([
    { market: "team_total", side: "home_over", decimal_odds: 1.91 },
    { market: "team_total", side: "home_under", decimal_odds: 1.91 },
    { market: "team_total", side: "away_over", decimal_odds: 1.5 },
    { market: "team_total", side: "away_under", decimal_odds: 2.5 },
  ]);
  // If all four devigged together the home side would not land on 50%
  assert.ok(Math.abs(f.get("team_total|home_over")!.fair - 0.5) < 1e-9);
});

test("kelly is zero at fair odds and negative when the bet is bad", () => {
  assert.ok(Math.abs(kelly(0.5, 2)) < 1e-12, "no edge, no stake");
  assert.ok(kelly(0.6, 2) > 0);
  assert.ok(kelly(0.4, 2) < 0);
});

test("a claim is capped at MAX_EDGE over fair, so claiming more cannot buy a bigger stake", () => {
  const fair = 0.4;
  assert.equal(pricedProbability(0.45, fair), 0.45, "a modest claim passes through");
  assert.equal(pricedProbability(0.95, fair), fair + MAX_EDGE, "a wild claim is held to the cap");

  const wild = quote({ claimed: 0.95, dec: 2.5, cash: 1000, fair });
  const capped = quote({ claimed: fair + MAX_EDGE, dec: 2.5, cash: 1000, fair });
  assert.equal(wild.suggested, capped.suggested, "both size identically");
  assert.equal(wild.claimed, 0.95, "but the claim is still recorded as stated");
});

test("with no fair price there is nothing to cap against", () => {
  assert.equal(pricedProbability(0.95, null), 0.95);
});

test("the EV bar refuses a bet priced at the market", () => {
  // Taking −110 while believing exactly the fair 50% is a losing bet, and must not clear
  const dec = americanToDecimal(-110);
  const atMarket = quote({ claimed: 0.5, dec, cash: 1000, fair: 0.5 });
  assert.ok(atMarket.ev < 0);
  assert.equal(clearsBar(atMarket), false);

  const real = quote({ claimed: 0.58, dec, cash: 1000, fair: 0.5 });
  assert.ok(real.ev >= MIN_EV, `${real.ev} should clear ${MIN_EV}`);
  assert.equal(clearsBar(real), true);
});

test("stake never exceeds the hard ceiling, and suggests half Kelly", () => {
  const cash = 1000;
  const q = quote({ claimed: 0.9, dec: 3, cash, fair: 0.85 });
  assert.ok(q.cap <= MAX_STAKE_PCT * cash + 1e-9, "cap respects MAX_STAKE_PCT");
  assert.ok(q.suggested <= q.cap, "suggestion never exceeds the cap");
});

test("a -EV claim suggests no stake at all", () => {
  const q = quote({ claimed: 0.3, dec: 2, cash: 1000, fair: 0.5 });
  assert.equal(q.suggested, 0);
  assert.equal(q.cap, 0);
});

test("ev is profit per dollar staked", () => {
  assert.ok(Math.abs(ev(0.5, 2) - 0) < 1e-12);
  assert.ok(Math.abs(ev(0.55, 2) - 0.1) < 1e-12);
});

test("buckets drop samples too small to mean anything", () => {
  const rows = [
    { k: "NFL", w: true, n: 10 }, { k: "NFL", w: false, n: -10 }, { k: "NFL", w: true, n: 10 },
    { k: "MLB", w: true, n: 5 },
  ];
  const out = buckets(rows, (r) => r.k, (r) => r.w, (r) => r.n);
  assert.deepEqual(out.map((b) => b.label), ["NFL"], "MLB has one bet and is dropped");
  assert.equal(out[0].n, 3);
  assert.equal(out[0].won, 2);
});

test("the scorecard tells a model running hot to shade down", () => {
  const card: Scorecard = {
    settled: 40, won: 14, staked: 400, net: -60, impliedWins: 18,
    calibration: { n: 40, said: 0.6, hit: 0.35 },
    stakedToday: 0, clv: null, byMarket: [], byEdge: [],
  };
  const text = formatScorecard(card, 1000).join("\n");
  assert.match(text, /running 25 points hot/);
  assert.match(text, /expected 18.0 wins\. You have 14\./);
});

test("calibration under the minimum sample is called luck, not skill", () => {
  const card: Scorecard = {
    settled: 5, won: 1, staked: 50, net: -30, impliedWins: 2.5,
    calibration: { n: 5, said: 0.6, hit: 0.2 },
    stakedToday: 0, clv: null, byMarket: [], byEdge: [],
  };
  const text = formatScorecard(card, 1000).join("\n");
  assert.match(text, /too few to judge/);
  assert.doesNotMatch(text, /points hot/);
});

test("the prompt quotes the limits the code actually enforces", () => {
  const text = bettingDiscipline();
  assert.match(text, new RegExp(`${(MIN_EV * 100).toFixed(0)}% expected value`));
  assert.match(text, new RegExp(`${(MAX_EDGE * 100).toFixed(0)} points of edge`));
  assert.match(text, new RegExp(`${(MAX_STAKE_PCT * 100).toFixed(0)}% of cash`));
});

test("tool names are substituted so another app can reuse the wording", () => {
  const text = bettingDiscipline({ bet: "place_wager", parlay: null, search: "search_web" });
  assert.match(text, /place_wager asks for win_probability/);
  assert.doesNotMatch(text, /place_bet/);
  assert.doesNotMatch(text, /place_parlay/);
});
