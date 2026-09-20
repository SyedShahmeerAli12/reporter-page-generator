/*
 * Relevance engine for journalist response pages.
 *
 * Design rule that drives everything below: a page a reporter will quote from
 * must never contain a sentence a language model invented. So this engine does
 * retrieval and ranking only. Every bio, quote and press line it emits is
 * copied verbatim out of thomas-facts.json. The model-shaped work -- reading a
 * reporter's request and deciding what matters -- is done by keyword scoring
 * over a curated topic vocabulary, which is deterministic, testable and
 * explainable. Nothing here can hallucinate an attribution.
 */

const MS_PER_DAY = 86400000;

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** URL- and filename-safe slug. Never empty. */
export function slugify(text) {
  const s = normalise(text)
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'unnamed';
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Match a keyword against already-normalised, space-padded text.
 *
 * Single words match as a prefix ("credit" hits "crediting", "promotion" hits
 * "promotions") because reporters write in prose, not in our vocabulary. The
 * leading boundary is kept strict so "board" never matches "onboarding".
 * Phrases match as substrings, where inflection is far less common.
 */
export function matchesKeyword(paddedText, keyword) {
  const needle = normalise(keyword);
  if (!needle) return false;
  if (needle.includes(' ')) return paddedText.includes(needle);
  return new RegExp('(?:^| )' + escapeRe(needle) + '[\\p{L}\\p{N}-]*(?= |$)', 'u').test(paddedText);
}

/**
 * Score every topic against the reporter's own words.
 * Returns topics sorted high-to-low, each with the keywords that actually hit
 * so the page can explain *why* it chose what it chose.
 */
export function scoreTopics(text, facts) {
  const hay = ' ' + normalise(text) + ' ';
  return facts.topics
    .map((topic) => {
      const hits = topic.keywords.filter((kw) => matchesKeyword(hay, kw));
      return { id: topic.id, label: topic.label, score: hits.length, hits };
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/** Recency boost: 5 points today, decaying by half a point a month, floor 0. */
export function recencyBoost(dateStr, now) {
  const then = Date.parse(dateStr);
  if (Number.isNaN(then)) return 0;
  const months = (now - then) / MS_PER_DAY / 30.44;
  return Math.max(0, 5 - months * 0.5);
}

/** Masthead weight. A reporter judging credibility cares more that Business
 *  Insider ran it than that a Medium post is one day newer. */
export const TIER_WEIGHT = { 1: 8, 2: 4, 3: 0 };

/**
 * Rank press items for this specific reporter.
 *  +10 per matching topic tag   -- relevance to what they asked
 *   +6 same outlet              -- "you ran this before" is the strongest proof
 * +0/4/8 masthead tier          -- credibility outranks freshness
 *   +0-5 recency                -- a 2024 clipping helps nobody
 */
export function selectPress(topicIds, outlet, facts, opts = {}) {
  const limit = opts.limit ?? 4;
  const now = opts.now ?? Date.now();
  const wanted = new Set(topicIds);
  const outletKey = normalise(outlet);

  const scored = facts.press.map((item) => {
    const overlap = (item.tags || []).filter((t) => wanted.has(t)).length;
    const sameOutlet =
      outletKey.length > 2 &&
      (normalise(item.outlet).includes(outletKey) || outletKey.includes(normalise(item.outlet)));
    const tier = TIER_WEIGHT[item.tier] ?? TIER_WEIGHT[2];
    const score = overlap * 10 + (sameOutlet ? 6 : 0) + tier + recencyBoost(item.date, now);
    return { ...item, score, overlap, sameOutlet, why: reasonFor(overlap, sameOutlet) };
  });

  return scored
    .filter((i) => i.overlap > 0 || i.sameOutlet)
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date))
    .slice(0, limit);
}

function reasonFor(overlap, sameOutlet) {
  if (sameOutlet && overlap) return 'Your outlet, same subject';
  if (sameOutlet) return 'Your outlet';
  return overlap > 1 ? 'Directly on your subject' : 'Related to your subject';
}

/** Pick quotes already on the record that match the reporter's subject. */
export function selectQuotes(topicIds, facts, limit = 3) {
  const wanted = new Set(topicIds);
  return facts.quotes
    .map((q) => ({ ...q, overlap: (q.tags || []).filter((t) => wanted.has(t)).length }))
    .filter((q) => q.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);
}

/** Days until deadline, plus a plain-English urgency label. */
export function readDeadline(deadline, now = Date.now()) {
  if (!deadline) return { set: false, label: 'No deadline given', urgent: false, days: null };
  const when = Date.parse(deadline);
  if (Number.isNaN(when)) return { set: false, label: 'No deadline given', urgent: false, days: null };
  const days = Math.ceil((when - now) / MS_PER_DAY);
  if (days < 0) return { set: true, days, label: 'Deadline has passed', urgent: true };
  if (days === 0) return { set: true, days, label: 'Deadline is today', urgent: true };
  if (days === 1) return { set: true, days, label: 'Deadline is tomorrow', urgent: true };
  return { set: true, days, label: `Deadline in ${days} days`, urgent: days <= 3 };
}

/**
 * Turn a reporter's request into a complete, ready-to-render packet.
 * Degrades loudly, never silently: if nothing matches the subject we fall back
 * to the most recent coverage and say so in `notices`.
 */
export function buildPacket(brief, facts, opts = {}) {
  const now = opts.now ?? Date.now();
  const reporter = String(brief.reporter || '').trim();
  const outlet = String(brief.outlet || '').trim();
  const subject = [brief.topic, brief.questions].filter(Boolean).join(' \n ');
  const notices = [];

  if (!reporter) notices.push('No reporter name given — the greeting falls back to a neutral one.');
  if (!outlet) notices.push('No outlet given — prior coverage for that outlet cannot be surfaced.');

  let topics = scoreTopics(subject, facts);
  if (topics.length === 0) {
    notices.push('No topic keywords matched. Showing most recent coverage instead of subject-matched coverage.');
  }
  topics = topics.slice(0, 3);
  const topicIds = topics.map((t) => t.id);

  let press = selectPress(topicIds, outlet, facts, { now, limit: 4 });
  if (press.length === 0) {
    press = [...facts.press]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4)
      .map((p) => ({ ...p, why: 'Most recent coverage', score: 0, overlap: 0, sameOutlet: false }));
  }

  const quotes = selectQuotes(topicIds, facts, 3);
  if (quotes.length === 0) {
    notices.push('No on-the-record quote matches this subject. Page asks for a live interview instead.');
  }

  const deadline = readDeadline(brief.deadline, now);

  return {
    slug: slugify([reporter, outlet].filter(Boolean).join(' ')),
    reporter,
    outlet,
    subject: String(brief.topic || '').trim(),
    questions: splitQuestions(brief.questions),
    topics,
    press,
    quotes,
    deadline,
    notices,
    generatedAt: new Date(now).toISOString(),
    facts,
  };
}

/** One question per line or per numbered item. */
export function splitQuestions(raw) {
  return String(raw || '')
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);
}
