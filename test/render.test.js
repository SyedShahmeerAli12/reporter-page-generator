import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildPacket } from '../src/engine.js';
import { escapeHtml, escapeJsonLd, buildJsonLd, renderPage } from '../src/render.js';

const facts = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/thomas-facts.json', import.meta.url)), 'utf8')
);
const NOW = Date.parse('2026-09-20T00:00:00Z');

const brief = {
  reporter: 'Jane Doe',
  outlet: 'Business Insider',
  topic: 'AI attribution and promotions',
  questions: '1. Who gets the credit?\n2. Does it delay raises?',
  deadline: '2026-09-23',
};

test('escapeHtml neutralises injection characters', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.equal(escapeHtml("O'Neill & Sons"), 'O&#39;Neill &amp; Sons');
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(0), '0');
});

test('escapeJsonLd escapes angle brackets so it cannot break out of a script tag', () => {
  const out = escapeJsonLd({ name: '</script><img onerror=1>' });
  assert.ok(!out.includes('</script>'));
  assert.ok(out.includes('\\u003c'));
});

test('buildJsonLd emits a valid Person block from the facts file only', () => {
  const ld = buildJsonLd(facts);
  assert.equal(ld['@type'], 'Person');
  assert.equal(ld.name, 'Thomas Prommer');
  assert.equal(ld.description, facts.bios.short);
  assert.ok(ld.award.some((a) => a.includes('Global CIO 2026')));
  assert.ok(ld.sameAs.includes('https://linkedin.com/in/thomasprommer'));
  assert.ok(JSON.parse(JSON.stringify(ld)), 'must be JSON-serialisable');
});

test('renderPage produces a complete, self-contained document', () => {
  const html = renderPage(buildPacket(brief, facts, { now: NOW }));
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('</html>'));
  assert.ok(!/src="https?:\/\/(?!prommer\.net)/.test(html), 'no third-party scripts or assets');
  assert.ok(!html.includes('<link rel="stylesheet"'), 'styles must be inline');
});

test('renderPage carries the noindex contract declared in robots.txt', () => {
  const html = renderPage(buildPacket(brief, facts, { now: NOW }));
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
});

test('renderPage personalises the greeting and the deadline', () => {
  const html = renderPage(buildPacket(brief, facts, { now: NOW }));
  assert.ok(html.includes('Hi Jane Doe'));
  assert.ok(html.includes('Business Insider'));
  assert.ok(html.includes('Deadline in 3 days'));
});

test('renderPage includes machine-readable JSON-LD', () => {
  const html = renderPage(buildPacket(brief, facts, { now: NOW }));
  const match = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, 'JSON-LD block must be present');
  const parsed = JSON.parse(match[1].replace(/\\u003c/g, '<'));
  assert.equal(parsed['@type'], 'Person');
  assert.equal(parsed.name, 'Thomas Prommer');
});

test('renderPage flags unanswered questions so a draft cannot be sent blind', () => {
  const html = renderPage(buildPacket(brief, facts, { now: NOW }));
  const pending = html.match(/data-needs-answer="true"/g) || [];
  assert.equal(pending.length, 2);
  assert.ok(html.includes('[Thomas: answer here before sending]'));
});

test('renderPage escapes hostile reporter input', () => {
  const html = renderPage(
    buildPacket(
      { reporter: '<img src=x onerror=alert(1)>', outlet: '"><script>bad()</script>', topic: 'ai strategy' },
      facts,
      { now: NOW }
    )
  );
  assert.ok(!html.includes('<img src=x'), 'reporter name must not render as markup');
  assert.ok(!html.includes('<script>bad()'), 'outlet must not render as markup');
  assert.ok(html.includes('&lt;img src=x'));
});

test('renderPage degrades gracefully when nothing matches', () => {
  const html = renderPage(
    buildPacket({ reporter: 'Sam Lee', outlet: 'The Baker', topic: 'sourdough' }, facts, { now: NOW })
  );
  assert.ok(html.includes('Hi Sam Lee'));
  assert.ok(html.includes("let's do this live"), 'should offer an interview rather than fake a quote');
  assert.ok(html.includes('Most recent coverage'));
});

test('renderPage never invents text outside the facts file', () => {
  const packet = buildPacket(brief, facts, { now: NOW });
  const html = renderPage(packet);
  // Every rendered quote and bio must appear verbatim in the source data.
  for (const q of packet.quotes) {
    assert.ok(facts.quotes.some((src) => src.text === q.text), 'quote must come from facts.json');
  }
  assert.ok(html.includes(facts.bios.oneLiner.slice(0, 40).replace(/&/g, '&amp;')));
});

test('renderPage always renders an avatar, even without a photo URL', () => {
  const noPhoto = JSON.parse(JSON.stringify(facts));
  noPhoto.person.photo = '';
  const html = renderPage(buildPacket(brief, noPhoto, { now: NOW }));
  assert.ok(html.includes('<div class="avatar">TP</div>'), 'falls back to initials, never a broken image');
});
