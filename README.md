# wagerbots-engine

The betting engine shared by [WagerBots](https://github.com/adamchlebek/WagerBots) and
[Silicon Springs](https://github.com/adamchlebek/SiliconSprings): no-vig pricing, expected value,
Kelly sizing, calibration, and the prompt that explains all of it to a model.

It exists because both apps ask a language model to bet money, and the rules for doing that honestly
are the same in both. Keeping two copies meant the town's residents were betting on a "confidence
1-100" with a vague sizing guideline while WagerBots' models were being EV-gated and Kelly-sized
against a devigged line. One of those produces numbers that mean something.

## The one rule

**Everything here is a function of its arguments.** No database, no network, no framework, no
environment variables. That constraint is what makes it shareable — and it is why the parts that
read tables deliberately stayed behind in each app.

So: each app builds its own `Scorecard` from its own schema and hands it to `formatScorecard`; each
app places its own bets after asking `quote` what a claim is actually worth.

## Install

```bash
npm i github:adamchlebek/wagerbots-engine#main
```

`prepare` compiles on install, so a git dependency needs no build step in the consumer and `dist/`
is never committed. Pin a tag instead of `#main` when you want updates to be deliberate.

## What's in it

| Module | What it does |
|---|---|
| `odds` | American ↔ decimal, implied probability, formatting |
| `devig` | `fairPrices()` strips the book's margin per market and reports the hold. `ev()`, `kelly()` |
| `limits` | `MIN_EV`, `MAX_EDGE`, `MAX_STAKE_PCT`, `KELLY_TARGET`, event and daily turnover caps |
| `sizing` | `quote()` prices a claim: capped probability, EV, Kelly, stake cap, suggested stake |
| `scorecard` | `Scorecard` shape, `buckets()`, and `formatScorecard()` — the lines a model reads before betting again |
| `instructions` | `priceDiscipline()`, `claimDiscipline()`, `stakeDiscipline()` — composable prompt blocks |

## The idea worth keeping

A model's stated probability is **recorded as said** but **priced capped** at `MAX_EDGE` over the
market's fair number:

```ts
const q = quote({ claimed: 0.95, dec: 2.5, cash: 1000, fair: 0.40 });
q.claimed  // 0.95  — goes on the record, checked against reality later
q.p        // 0.55  — what it is actually sized from
```

Without that cap, the way to bet bigger is to claim more, and the claim stops meaning anything.
`clearsBar()` then applies the EV gate to the *capped* number, so inflating cannot buy a pass.

## Prompt blocks are composable

The wording is identical wherever betting happens; only the surrounding framing and the tool names
differ. So tool names are arguments:

```ts
bettingDiscipline({ bet: "place_wager", parlay: null, search: "search_web" })
```

Every number in the text is interpolated from `limits.ts`, so the prompt can never promise a bar the
code doesn't enforce. There is a test for exactly that.

## Develop

```bash
npm test        # 16 tests, no network
npm run build
```

Changing a limit changes the prompt, the sizing and the refusals together. That's the point — but it
means a change here reaches both apps, so run both their test suites before pinning a new commit.
