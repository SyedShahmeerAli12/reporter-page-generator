# Assessment answers

Build: https://syedshahmeerali12.github.io/reporter-page-generator/



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

