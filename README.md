# Reporter Page Generator

Turns a journalist's request into a tailored, unlisted response page for `prommer.net/r/` in about thirty seconds.

**Live tool:** _(URL added after deploy)_
**Example output:** `/r/jane-doe-business-insider/`

---

## Where this came from

I did not start from the homepage. I started from `prommer.net/robots.txt`, which contains this:

```
# Journalist response pages — one per reporter, unlisted by design and personal
# to the recipient. Never linked from the site; already noindex,nofollow.
Disallow: /r/
```

That is a deliberate, effective pattern: instead of replying to a reporter with an email, Thomas sends them a page built for them. It is almost certainly why the press page carries 18 placements across Business Insider, USA Today, CIO.com, AP and Sportschau — he is the easiest source in the inbox to work with.

The pattern deserves tooling. This is that tooling.

**What I am not claiming:** `robots.txt` tells me the pages exist. It does not tell me how they are produced. Given 901 commits a week, there may well already be a script behind them. So this is not "you do this by hand and I fixed it" — it is an independent implementation of a pattern the site already proves works, offered so the engineering can be judged on its own terms.

**What I deliberately did not do:** `/r/` is marked private and personal to each recipient. I did not open any of those pages. Everything here is built from public sources — the press index, the about page, `llms.txt` and `robots.txt`.

---

## The design decision that drives everything

A page a reporter quotes from must never contain a sentence a language model invented. A hallucinated quote attributed to a real executive in a real publication is not a bug you patch later — it is a correction, and possibly a retraction.

So **no generative model writes any output**. Every bio, quote, headline and date is copied verbatim out of `data/thomas-facts.json`. The judgement-shaped work — reading what a reporter asked about and deciding what is relevant — is done by keyword scoring over a curated topic vocabulary.

That choice buys four things:

| | |
|---|---|
| **Deterministic** | Same brief in, same page out. Diffs are meaningful. |
| **Testable** | 34 tests assert real ranking behaviour, not "it returned a string". |
| **Explainable** | The UI shows which topics matched and why each clipping was chosen. |
| **Free and offline** | No API key, no per-page cost, no vendor outage between Thomas and a deadline. |

Where a model *would* help is drafting answers to the reporter's actual questions. That is exactly where a mistake is most expensive, so the generator leaves those blocks empty, marks them `data-needs-answer`, and the UI refuses to call the page ready while any remain.

---

## How ranking works

**Topics** — the reporter's own words are scored against a vocabulary of ten topics. Single keywords match as prefixes, so `credit` catches `crediting` and `promotion` catches `promotions`; the leading boundary stays strict so `board` never matches `onboarding`. Top three topics win.

**Press** — each clipping scores:

```
overlap × 10   matching topic tags — relevance to what they asked
      + 6      same outlet — "you ran this before" is the strongest proof
   + 0/4/8     masthead tier — credibility outranks freshness
    + 0–5      recency, decaying half a point per month
```

The tier weight exists because of a failing test: ranking on relevance and recency alone put a Medium post above Business Insider because it was one day newer. For a page whose job is to establish credibility, that ordering is wrong.

**Quotes** — only quotes tagged to a matched topic are shown. If none match, the page says so and offers a live interview rather than stretching an unrelated quote.

**Failure is loud, never silent.** No topic match falls back to most-recent coverage *and* posts a notice saying that is what happened.

---

## Layout

```
data/thomas-facts.json   one source of truth — every fact on every page
src/engine.js            scoring and selection, pure functions, no DOM
src/render.js            packet -> standalone HTML page
index.html               the generator UI
scripts/build-demo.mjs   regenerates the committed example
test/                    34 tests
r/                       generated example output
```

The facts file is deliberately the only place a fact lives, so the same source can also drive the JSON-LD block, a press kit, or the existing `llms.txt`.

---

## Output properties

Each generated page is a single HTML file with inline CSS and no third-party requests — it works emailed as an attachment, saved to disk, or served from `/r/<slug>/`. It carries `noindex, nofollow, noarchive` to honour the contract already declared in `robots.txt`, ships a `schema.org/Person` JSON-LD block built from the same facts file, renders in light and dark, and falls back to an initials tile rather than ever showing a broken headshot. Reporter-supplied text is escaped on the way in — there is a test that feeds it `<img src=x onerror=...>`.

---

## Run it

```bash
npm test      # 34 tests
npm run demo  # regenerate the example page
npm run serve # http://localhost:8080
```

No dependencies. Node 18+.
