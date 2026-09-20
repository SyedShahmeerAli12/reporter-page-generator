# Reporter Page Generator

**Live tool:** https://syedshahmeerali12.github.io/reporter-page-generator/
**Example page:** https://syedshahmeerali12.github.io/reporter-page-generator/r/jane-doe-business-insider/

## Assessment answers

The form timed out on me. These are my answers, short and honest.

**1. What I built.** A generator that turns a journalist's email into a tailored, unlisted response page for `prommer.net/r/`, built from one source of truth.

**1. Approach and prompts.** I did not start from the homepage. I read `robots.txt` first, which says journalist response pages live at `/r/`, one per reporter. My prompts were interrogation, not generation: "read robots.txt and llms.txt and tell me what is missing", "is this already solved", "build it but no LLM writes any fact".

**1. What the AI got right.** Scaffolding speed. Engine, renderer, 34 tests and a working UI in one session, plus the boring correctness work: HTML escaping, JSON-LD, graceful fallback, and honouring the noindex contract already in robots.txt.

**1. What I had to debug or push back on.** Two real bugs the tests caught. "crediting" did not match the keyword "credit", so I added prefix matching with a strict left boundary so "board" still never hits "onboarding". A Medium post outranked Business Insider because it was one day newer, so I added masthead tier weighting. I also killed the AI's first idea, an `llms.txt`, after checking and finding he already has one.

**2. Issue I spotted.** `prommer.net/press/` returns 404, and `llms.txt` points agents at `/en/press/`, which is only a redirect to `/en/tech/press/`. A reporter or retrieval agent hitting the obvious URL gets nothing instead of 18 placements and three awards.

**2. My fix.** Add a 301 from `/press/` and `/media/` to `/en/tech/press/`, and point the `llms.txt` line at the canonical URL so agents fetch the page instead of a hop.

**3. AI past my skill level.** I built a ranking engine that scores a reporter's email against a topic vocabulary and orders 18 clippings by tag overlap, outlet match, masthead tier and time decay. I had not written a scoring function or a Node test suite before. The lesson was that I could not judge the ranking until tests asserted the order, not just that it returned something.

**4. Technical foundation.** JavaScript, HTML, CSS, APIs and git day to day. I think in data flow: one source of truth, a pure function over it, a render layer on top. My deliberate choice was refusing the AI's default. It reached for an LLM call per page. I made it retrieval only over a JSON facts file, because a hallucinated quote in a newspaper is a correction, not a bug.

**5. Setup.** Windows, 18 GB RAM. Tools I actually use: Claude Code, ChatGPT, GitHub Copilot.

**6. Agent produced wrong output.** The ranking put a Medium post above Business Insider. The failure was not the prompt, it was my weight model: only topic overlap and recency, so a newer low tier post beat a major masthead. I found it from a failing test, diagnosed it by printing the score breakdown per item, and fixed it with a masthead tier weight of 8, 4 or 0.

**7. Learning.** Last 90 days: agentic coding workflows, driving Claude Code end to end, git and deployment, and writing tests instead of eyeballing output. Next 6 months: Node and real backends, APIs and databases, and retrieval systems, because the hard problem is choosing what context to feed a model.

**9. With more time.** Write straight into `/r/` behind a review step, detect outlet language so a German reporter gets a German page, and log which quotes actually get printed so the ranking learns from outcomes instead of my weights.

---

## The problem

I found this in `prommer.net/robots.txt`:

```
# Journalist response pages, one per reporter, unlisted by design and personal
# to the recipient. Never linked from the site; already noindex,nofollow.
Disallow: /r/
```

So when a reporter gets in touch, they are not sent an email. They are sent a page built for them. It works: the press page carries 18 placements across Business Insider, USA Today, CIO.com, AP and Sportschau.

But every one of those pages needs the right bio, the right headshot, the right quote and the right prior coverage picked out by hand, against a reporter's deadline. That is the same job over and over.

## The solution

Type four things. Get the page.

```
Reporter   Klaus Berg
Outlet     Sportschau
Topic      GLP-1 weight-loss drugs in sport and whether it is doping
Deadline   23 Sep 2026
```

The tool reads the reporter's own words, matches them against a topic vocabulary, and pulls only what fits from one source of truth (`data/thomas-facts.json`). You write the answers to their questions, download the file, and drop it at `/r/<slug>/`.

**No language model writes any of it.** Every bio, quote and headline is copied verbatim from the facts file. A made-up quote in a real newspaper is a correction, not a bug, so the generator is retrieval only: deterministic, testable, and free to run.

The one place a model would help is drafting answers to the reporter's questions. That is also where a mistake costs the most, so those blocks are left empty, marked `data-needs-answer`, and the tool refuses to call the page ready while any remain.

## Example

Same tool, two different requests:

| | Business Insider, AI attribution | Sportschau, GLP-1 in sport |
|---|---|---|
| Topics matched | ai-attribution, agentic-engineering | sports-science, endurance |
| Quote chosen | "They didn't want their best contributions footnoted as 'cowritten by Claude'." | "The data is too thin to call it doping, and too suggestive to call it nothing." |
| Top article | Business Insider, 13 Jul 2026 | Sportschau, 3 Sep 2026 |
| Badge | Your outlet, same subject | Your outlet, same subject |

Out of 18 press items and 6 quotes, it picked the right ones both times.

## How it picks

Each article is scored:

```
overlap x 10   matching topic tags
      + 6      same outlet as the reporter
   + 0/4/8     masthead tier
    + 0 to 5   recency, decaying half a point a month
```

The tier weight came from a failing test. Relevance plus recency alone put a Medium post above Business Insider because it was one day newer. On a page whose job is credibility, that order is wrong.

Single keywords match as prefixes, so `credit` catches `crediting` and `promotion` catches `promotions`, but `board` never matches `onboarding`.

If nothing matches, the page falls back to recent coverage and says so on screen. It never stretches an unrelated quote to fill space.

## Output

One HTML file, inline CSS, no third-party requests. Works emailed, saved to disk, or served from `/r/`. Carries `noindex, nofollow, noarchive` to match the contract in robots.txt, plus a `schema.org/Person` block built from the same facts file. Light and dark. Reporter input is escaped; there is a test that feeds it `<img src=x onerror=...>`.

## Two notes on scope

`robots.txt` tells me these pages exist. It does not tell me how they are made. At 901 commits a week there may already be a script behind them, so this is not a claim that anyone works by hand. It is an independent build of a pattern the site already proves works.

`/r/` is marked private and personal to each recipient, so I did not open any of those pages. Everything here comes from public sources: the press index, the about page, `llms.txt` and `robots.txt`.

## Run it

```bash
npm test          # 34 tests
npm run demo      # rebuild the example page
npm run verify:live   # test the deployed files
npm run serve     # http://localhost:8080
```

No dependencies. Node 18+.

## Files

```
data/thomas-facts.json   one source of truth
src/engine.js            scoring and selection, pure functions
src/render.js            packet to standalone HTML
index.html               the generator UI
scripts/                 demo build, live verification
test/                    34 tests
r/                       generated example
```
