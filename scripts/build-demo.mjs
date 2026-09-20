/*
 * Builds the committed example page at /r/jane-doe-business-insider/.
 * Run: npm run demo
 *
 * The example is generated, never hand-edited, so the page on the live site is
 * always exactly what the tool produces. A fixed clock keeps the output stable
 * across builds, which keeps the git diff meaningful.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPacket } from '../src/engine.js';
import { renderPage } from '../src/render.js';

const root = new URL('..', import.meta.url);
const facts = JSON.parse(readFileSync(fileURLToPath(new URL('data/thomas-facts.json', root)), 'utf8'));

const BRIEF = {
  reporter: 'Jane Doe',
  outlet: 'Business Insider',
  topic: 'AI attribution in engineering teams and its effect on promotions',
  questions: [
    '1. Are managers really crediting AI instead of the engineer who shipped the work?',
    '2. What does that do to promotion and raise cycles?',
    '3. How should a CTO measure contribution when the work is AI-paired?',
  ].join('\n'),
  deadline: '2026-09-23',
};

const NOW = Date.parse('2026-09-20T09:00:00Z');
const packet = buildPacket(BRIEF, facts, { now: NOW });
const outDir = fileURLToPath(new URL(`r/${packet.slug}/`, root));

mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + 'index.html', renderPage(packet), 'utf8');

console.log(`built  /r/${packet.slug}/`);
console.log(`topics ${packet.topics.map((t) => t.id).join(', ') || 'none'}`);
console.log(`press  ${packet.press.length} of ${facts.press.length}`);
console.log(`quotes ${packet.quotes.length} of ${facts.quotes.length}`);
