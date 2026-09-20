// Integration test against the DEPLOYED artefacts, not the local copies.
const B = 'https://syedshahmeerali12.github.io/reporter-page-generator';
const load = async (p) => {
  const src = await fetch(B + p).then((r) => { if (!r.ok) throw new Error(p + ' HTTP ' + r.status); return r.text(); });
  return import('data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64'));
};

const engine = await load('/src/engine.js');
const render = await load('/src/render.js');
const facts = await fetch(B + '/data/thomas-facts.json').then((r) => r.json());
console.log('loaded live modules + facts:', facts.press.length, 'press items');

// Exactly the brief the UI pre-fills on load.
const d = new Date(); d.setDate(d.getDate() + 3);
const packet = engine.buildPacket({
  reporter: 'Jane Doe',
  outlet: 'Business Insider',
  topic: 'AI attribution in engineering teams and its effect on promotions',
  questions: '1. Are managers really crediting AI instead of the engineer who shipped the work?\n2. What does that do to promotion and raise cycles?\n3. How should a CTO measure contribution when the work is AI-paired?',
  deadline: d.toISOString().slice(0, 10),
}, facts);
const html = render.renderPage(packet);

const checks = [
  ['slug', packet.slug === 'jane-doe-business-insider'],
  ['topic matched', packet.topics[0]?.id === 'ai-attribution'],
  ['BI ranked first', packet.press[0]?.outlet === 'Business Insider'],
  ['Medium not above BI', !packet.press.some((p,i)=>p.outlet==='Medium' && i===0)],
  ['3 questions parsed', packet.questions.length === 3],
  ['quotes found', packet.quotes.length > 0],
  ['deadline urgent', packet.deadline.urgent === true],
  ['no notices', packet.notices.length === 0],
  ['html complete', html.startsWith('<!doctype html>') && html.includes('</html>')],
  ['noindex present', html.includes('noindex, nofollow, noarchive')],
  ['json-ld present', html.includes('"@type": "Person"')],
  ['3 answer slots', (html.match(/data-needs-answer="true"/g) || []).length === 3],
];

let bad = 0;
for (const [n, ok] of checks) { console.log((ok ? 'PASS  ' : 'FAIL  ') + n); if (!ok) bad++; }

// Second run must be byte-identical.
const again = render.renderPage(engine.buildPacket({
  reporter: 'Jane Doe', outlet: 'Business Insider',
  topic: 'AI attribution in engineering teams and its effect on promotions',
  questions: '1. Are managers really crediting AI instead of the engineer who shipped the work?\n2. What does that do to promotion and raise cycles?\n3. How should a CTO measure contribution when the work is AI-paired?',
  deadline: d.toISOString().slice(0, 10),
}, facts, { now: Date.parse(packet.generatedAt) }), facts);
const det = again.length === render.renderPage(engine.buildPacket({
  reporter: 'Jane Doe', outlet: 'Business Insider',
  topic: 'AI attribution in engineering teams and its effect on promotions',
  questions: '1. Are managers really crediting AI instead of the engineer who shipped the work?\n2. What does that do to promotion and raise cycles?\n3. How should a CTO measure contribution when the work is AI-paired?',
  deadline: d.toISOString().slice(0, 10),
}, facts, { now: Date.parse(packet.generatedAt) }), facts).length;
console.log((det ? 'PASS  ' : 'FAIL  ') + 'deterministic on repeat'); if (!det) bad++;

console.log(bad ? `\n${bad} FAILED` : '\nALL LIVE CHECKS PASSED');
process.exit(bad ? 1 : 0);
