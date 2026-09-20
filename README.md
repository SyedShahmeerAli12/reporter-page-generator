# Reporter Page Generator

**Live tool:** https://syedshahmeerali12.github.io/reporter-page-generator/
**Example page:** https://syedshahmeerali12.github.io/reporter-page-generator/r/jane-doe-business-insider/

Assessment answers: [ANSWERS.md](ANSWERS.md)

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

## Run it

```bash
npm test     # 34 tests
npm run demo # rebuild the example page
```

No dependencies. Node 18+.
