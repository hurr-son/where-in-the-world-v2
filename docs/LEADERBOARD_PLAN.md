# Leaderboard: plan

Let players compare scores. Status: **proposal**, nothing built yet.

---

## 1. The key decision: a leaderboard for *what*?

Today every game has five different random places, so two scores aren't
comparable: one player may get Paris and Tokyo, another a village in Chad.
A single all-time leaderboard would mostly rank luck.

**Proposal: a daily challenge with a leaderboard per day.** Everyone who
plays the daily challenge on a given day (UTC) gets the same five places, so
scores are directly comparable. Normal random games stay as they are, with no
leaderboard.

This also covers the "Daily challenge" idea in [IDEAS.md](IDEAS.md), and it
fits the code: `pickLocation` already takes an injectable random number
generator, and `seededRng(seed)` gives the same sequence for the same seed.

## 2. Goals

**In scope**
- Daily challenge mode: five places chosen from the date, the same for everyone.
- After a daily game, submit a score under a nickname (no accounts).
- Daily leaderboard: today's top 20 plus your own rank; yesterday's for comparison.
- Scores checked on the server (see section 4), not just trusted.

**Out of scope** (stays in IDEAS.md)
- Accounts, logins, friends, all-time or weekly boards.
- Leaderboards for random games.
- Strong anti-cheat (see section 4 for why it isn't possible here).

## 3. Architecture

The game is a static site on GitHub Pages, which can't store anything, so a
leaderboard needs a small backend. It only needs two endpoints and one table.

| Option | Pros | Cons |
|---|---|---|
| **Cloudflare Worker + D1 (SQLite)** (proposed) | Free tier; code is TypeScript, so it can reuse `sampler.ts`, `scoring.ts` and `geo.ts` to check scores; one small deploy | Another account and a second deploy target |
| Supabase (Postgres + REST) | Table editor in the browser; the client can talk to it directly | Checking scores needs an Edge Function anyway; free projects pause when idle |
| Firebase Firestore | Common, good docs | Checking scores needs Cloud Functions, which require a paid plan |

**Verify before building:** Cloudflare's current free limits for Workers and
D1, and that the Worker can fetch `grid.json` from the Pages site, or bundle
it (about 1.1 MB gzipped).

```
Browser (GitHub Pages)                 Cloudflare Worker                  D1
  daily game, 5 guesses  ── POST /scores {date, name, guesses} ──▶  recompute score ──▶ scores table
  leaderboard screen     ◀── GET /leaderboard?date=YYYY-MM-DD ───  top 20 + count
```

### Data

One table:

```sql
CREATE TABLE scores (
  id         INTEGER PRIMARY KEY,
  day        TEXT    NOT NULL,   -- '2026-10-26' (UTC)
  name       TEXT    NOT NULL,   -- 1-20 characters, filtered
  points     INTEGER NOT NULL,   -- computed by the server
  guesses    TEXT    NOT NULL,   -- JSON [[lat, lon] x 5], kept for re-checking
  created_at TEXT    NOT NULL
);
CREATE INDEX scores_day_points ON scores (day, points DESC);
```

No emails, no IP addresses stored. Nicknames are the only personal data.

### Daily places

- Seed = a number derived from the UTC date (e.g. a hash of `"2026-10-26"`),
  plus a secret salt kept on the server and in the build so the places can't
  be computed far in advance from the public code.
- Both the browser and the server run `pickLocation(grid, sampling, seededRng(seed))`
  five times, so they agree on the places without sending them.
- The sampling settings and `grid.json` must be identical on both sides;
  include a `gridVersion` (hash of grid.json) in each submission, and reject
  a mismatch.

## 4. Cheating: what's realistic

The answer is always in the browser: the imagery's tile requests contain its
coordinates. A determined player can find the answer, and no backend can
fully stop that. The aim is to stop the *easy* cheats:

| Cheat | Defence |
|---|---|
| Posting a made-up score with curl | The server ignores any submitted score and recomputes it from the five guesses |
| Submitting many times a day | Rate limit by IP at the Worker (not stored); one submission per browser per day (localStorage, honour system) |
| Spam or offensive nicknames | Length limit, character allow-list, small word filter; a way to delete rows by hand |
| Scripted submissions | Optional: Cloudflare Turnstile (free, privacy-friendly captcha) on submit |
| Looking up the answer | Not preventable; accept it for a hobby game. Perfect 25,000 scores are visible and can be removed by hand |

## 5. Milestones

One step = one reviewable change, as in the prototype plan.

### L1: Daily challenge (browser only, no backend)
1. `daily.ts`: `dailySeed(date)` and `dailyLocations(grid, sampling, date)` + tests
   (same date gives the same places; different dates give different places;
   UTC, not local time).
2. Start screen: "Daily challenge" and "Random game" buttons. `Game` takes the
   picker it's given, so the daily mode needs no change to `game.ts`.
3. Summary screen shows "Daily challenge, 26 Oct 2026" and a share-text button.

**Done when:** two browsers get the same five places on the same day.

### L2: Backend
1. New `worker/` folder: Wrangler config, D1 schema, `POST /scores`, `GET /leaderboard`.
2. Score check reuses `src/sampler.ts`, `src/scoring.ts`, `src/geo.ts` + tests
   (vitest also runs in Workers).
3. Validation: date is today or yesterday, five guesses with valid
   coordinates, nickname rules, `gridVersion` matches.
4. CORS limited to `https://hurr-son.github.io` and `localhost`.
5. Deploy with a GitHub Actions workflow (`wrangler deploy`), secrets for the
   Cloudflare API token and the seed salt.

**Done when:** a curl submission with fake points is stored with the
recomputed score instead.

### L3: Leaderboard UI
1. Summary screen (daily games only): nickname field and "Submit score".
2. Leaderboard screen: today's top 20, your rank ("You're #37 of 212"),
   yesterday's tab.
3. Nickname remembered in localStorage; loading and error states like the
   rest of the game.
4. `config.ts`: `leaderboard.apiUrl`.

**Done when:** a daily game can be submitted and seen on the board, on phone and desktop.

### L4: Moderation and limits
1. Rate limiting and the nickname filter.
2. Optional Turnstile.
3. A small admin script or SQL notes for deleting rows.

## 6. Costs and limits

- Cloudflare Workers and D1 free tiers should cover a hobby game comfortably (check the numbers).
- **The real bottleneck is Mapbox:** your plan allows 20,000 tiles a month,
  about 200–400 games at 50–100 tiles each. A leaderboard that brings more players will hit that
  first. The game already shows an imagery error when tiles fail; consider a
  message that says the monthly imagery quota is used up.

## 7. Questions for you

1. Daily challenge leaderboard (proposed), or something else, e.g. a weekly board?
2. Cloudflare (proposed) or Supabase?
3. Nicknames only, or optional sign-in later?
4. Is Turnstile worth the extra step for players?
