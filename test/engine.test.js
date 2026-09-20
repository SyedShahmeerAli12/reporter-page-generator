import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  normalise,
  matchesKeyword,
  slugify,
  scoreTopics,
  recencyBoost,
  selectPress,
  selectQuotes,
  readDeadline,
  splitQuestions,
  buildPacket,
} from '../src/engine.js';

const facts = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/thomas-facts.json', import.meta.url)), 'utf8')
);

// Fixed clock so every recency assertion is reproducible.
const NOW = Date.parse('2026-09-20T00:00:00Z');

test('normalise lowercases and strips punctuation', () => {
  assert.equal(normalise('  AI, Attribution!  '), 'ai attribution');
  assert.equal(normalise(null), '');
  assert.equal(normalise(undefined), '');
});

test('matchesKeyword matches inflections but respects word starts', () => {
  const hay = ' bosses are crediting ai and delaying promotions after onboarding ';
  assert.equal(matchesKeyword(hay, 'credit'), true, 'credit -> crediting');
  assert.equal(matchesKeyword(hay, 'promotion'), true, 'promotion -> promotions');
  assert.equal(matchesKeyword(hay, 'board'), false, 'board must not hit onboarding');
  assert.equal(matchesKeyword(hay, 'hyrox'), false);
  assert.equal(matchesKeyword(' ai strategy work ', 'ai strategy'), true, 'phrases match as substrings');
  assert.equal(matchesKeyword(hay, ''), false);
});

test('slugify produces safe slugs and never returns empty', () => {
  assert.equal(slugify('Jane Doe Business Insider'), 'jane-doe-business-insider');
  assert.equal(slugify('  ///  '), 'unnamed');
  assert.equal(slugify(''), 'unnamed');
  assert.match(slugify("Jörg O'Neill / Der Spiegel"), /^[a-z0-9ö-]+$/iu);
});

test('scoreTopics finds the right topic from a reporter brief', () => {
  const ranked = scoreTopics(
    'Are bosses crediting AI instead of employees, and is it delaying promotions?',
    facts
  );
  assert.ok(ranked.length > 0, 'expected at least one topic match');
  assert.equal(ranked[0].id, 'ai-attribution');
  assert.ok(ranked[0].hits.includes('credit'));
});

test('scoreTopics returns empty for an unrelated brief', () => {
  assert.deepEqual(scoreTopics('best sourdough starter hydration ratio', facts), []);
});

test('scoreTopics is case and punctuation insensitive', () => {
  const a = scoreTopics('HYROX vs CrossFit', facts);
  const b = scoreTopics('hyrox, crossfit!!', facts);
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].id, 'endurance');
});

test('recencyBoost decays with age and floors at zero', () => {
  const fresh = recencyBoost('2026-09-20', NOW);
  const older = recencyBoost('2026-04-19', NOW);
  const ancient = recencyBoost('2015-01-01', NOW);
  assert.ok(fresh > older, 'newer item should score higher');
  assert.equal(ancient, 0);
  assert.ok(fresh <= 5);
  assert.equal(recencyBoost('not-a-date', NOW), 0);
});

test('selectPress prefers items tagged with the matched topic', () => {
  const picks = selectPress(['ai-attribution'], '', facts, { now: NOW, limit: 4 });
  assert.ok(picks.length > 0);
  assert.ok(picks.every((p) => p.tags.includes('ai-attribution')));
  assert.equal(picks[0].outlet, 'Business Insider');
});

test('selectPress ranks a major masthead above a fresher low-tier post', () => {
  const picks = selectPress(['ai-attribution'], '', facts, { now: NOW, limit: 4 });
  const bi = picks.findIndex((p) => p.outlet === 'Business Insider');
  const medium = picks.findIndex((p) => p.outlet === 'Medium');
  assert.ok(bi > -1 && medium > -1, 'both items should be selected');
  assert.ok(bi < medium, 'Business Insider (tier 1) must outrank Medium (tier 3) despite being a day older');
});

test('every press item carries a tier so ranking is never silently defaulted', () => {
  const untiered = facts.press.filter((p) => ![1, 2, 3].includes(p.tier));
  assert.deepEqual(untiered, [], 'all press entries must declare tier 1, 2 or 3');
});

test("selectPress boosts the reporter's own outlet", () => {
  const withOutlet = selectPress(['careers'], 'Spiceworks', facts, { now: NOW, limit: 6 });
  assert.equal(withOutlet[0].outlet, 'Spiceworks');
  assert.equal(withOutlet[0].sameOutlet, true);
  assert.equal(withOutlet[0].why, 'Your outlet, same subject');
});

test('selectPress surfaces an outlet match even with no topic overlap', () => {
  const picks = selectPress([], 'CTO Craft', facts, { now: NOW, limit: 4 });
  assert.equal(picks.length, 1);
  assert.equal(picks[0].outlet, 'CTO Craft');
  assert.equal(picks[0].why, 'Your outlet');
});

test('selectPress respects the limit', () => {
  const picks = selectPress(['ai-strategy'], '', facts, { now: NOW, limit: 2 });
  assert.equal(picks.length, 2);
});

test('selectPress returns nothing when nothing is relevant', () => {
  assert.deepEqual(selectPress([], '', facts, { now: NOW }), []);
});

test('selectQuotes only returns quotes on the matched subject', () => {
  const quotes = selectQuotes(['ai-attribution'], facts, 3);
  assert.ok(quotes.length > 0);
  assert.ok(quotes.every((q) => q.tags.includes('ai-attribution')));
  assert.match(quotes[0].text, /cowritten by Claude/);
});

test('selectQuotes returns empty rather than an off-topic quote', () => {
  assert.deepEqual(selectQuotes(['nonexistent-topic'], facts, 3), []);
});

test('readDeadline labels urgency correctly', () => {
  assert.equal(readDeadline('2026-09-20', NOW).label, 'Deadline is today');
  assert.equal(readDeadline('2026-09-21', NOW).label, 'Deadline is tomorrow');
  assert.equal(readDeadline('2026-09-19', NOW).label, 'Deadline has passed');
  assert.equal(readDeadline('2026-09-25', NOW).urgent, false);
  assert.equal(readDeadline('2026-09-22', NOW).urgent, true);
  assert.equal(readDeadline('', NOW).set, false);
  assert.equal(readDeadline('garbage', NOW).set, false);
});

test('splitQuestions handles numbered, bulleted and blank lines', () => {
  const out = splitQuestions('1. First?\n\n2) Second?\n- Third?\n• Fourth?\n   \n');
  assert.deepEqual(out, ['First?', 'Second?', 'Third?', 'Fourth?']);
  assert.deepEqual(splitQuestions(''), []);
});

test('buildPacket assembles a complete packet for a real brief', () => {
  const packet = buildPacket(
    {
      reporter: 'Jane Doe',
      outlet: 'Business Insider',
      topic: 'AI attribution and promotions',
      questions: '1. Who gets the credit?\n2. Does it delay raises?',
      deadline: '2026-09-23',
    },
    facts,
    { now: NOW }
  );

  assert.equal(packet.slug, 'jane-doe-business-insider');
  assert.equal(packet.topics[0].id, 'ai-attribution');
  assert.equal(packet.questions.length, 2);
  assert.ok(packet.press.length > 0);
  assert.ok(packet.quotes.length > 0);
  assert.equal(packet.deadline.urgent, true);
  assert.deepEqual(packet.notices, []);
});

test('buildPacket falls back to recency and says so when nothing matches', () => {
  const packet = buildPacket(
    { reporter: 'Sam Lee', outlet: 'The Baker', topic: 'sourdough hydration' },
    facts,
    { now: NOW }
  );
  assert.equal(packet.topics.length, 0);
  assert.equal(packet.press.length, 4, 'should still show recent coverage');
  assert.ok(packet.press.every((p) => p.why === 'Most recent coverage'));
  assert.ok(packet.notices.some((n) => /No topic keywords matched/.test(n)));
  assert.ok(packet.notices.some((n) => /No on-the-record quote/.test(n)));
});

test('buildPacket warns on missing reporter and outlet', () => {
  const packet = buildPacket({ topic: 'AI strategy' }, facts, { now: NOW });
  assert.ok(packet.notices.some((n) => /No reporter name/.test(n)));
  assert.ok(packet.notices.some((n) => /No outlet/.test(n)));
  assert.equal(packet.slug, 'unnamed');
});

test('buildPacket caps topics at three', () => {
  const packet = buildPacket(
    { reporter: 'X', outlet: 'Y', topic: 'ai strategy cio cto attribution careers hyrox identity crypto agentic' },
    facts,
    { now: NOW }
  );
  assert.ok(packet.topics.length <= 3);
});
