/*
 * Renders a packet into a standalone journalist response page.
 *
 * Output is a single HTML file with inline CSS and no network dependencies, so
 * it works when saved to disk, emailed as an attachment, or dropped into
 * /r/<slug>/ on prommer.net. It carries noindex,nofollow to match the
 * convention already declared in prommer.net/robots.txt for that directory.
 */

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for safe embedding inside a <script> block. */
export function escapeJsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

function initials(name) {
  const parts = String(name || 'TP').trim().split(/\s+/);
  return ((parts[0]?.[0] || 'T') + (parts[1]?.[0] || 'P')).toUpperCase();
}

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** schema.org Person block, built only from the facts file. */
export function buildJsonLd(facts) {
  const p = facts.person;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    jobTitle: p.jobTitle,
    description: facts.bios.short,
    url: p.site,
    nationality: p.nationality,
    knowsLanguage: p.languages,
    alumniOf: facts.person.education,
    award: facts.awards.map((a) => `${a.name} (${a.by})`),
    worksFor: facts.roles.filter((r) => r.current).map((r) => ({ '@type': 'Organization', name: r.org })),
    sameAs: p.sameAs,
  };
}

export function renderPage(packet) {
  const f = packet.facts;
  const who = packet.reporter || 'there';
  const outletLine = packet.outlet ? ` at ${escapeHtml(packet.outlet)}` : '';
  const pendingCount = packet.questions.length;

  const questionsBlock = packet.questions.length
    ? `<section class="card">
      <h2>Your questions</h2>
      ${packet.questions
        .map(
          (q, i) => `<div class="qa">
        <p class="q"><span class="qn">${i + 1}</span>${escapeHtml(q)}</p>
        <p class="a" data-needs-answer="true">[Thomas: answer here before sending]</p>
      </div>`
        )
        .join('\n      ')}
    </section>`
    : '';

  const quotesBlock = packet.quotes.length
    ? `<section class="card">
      <h2>Already on the record <span class="sub">(quote these directly)</span></h2>
      ${packet.quotes
        .map(
          (q) => `<figure class="quote">
        <blockquote>${escapeHtml(q.text)}</blockquote>
        <figcaption>${escapeHtml(q.context)} <span class="src">${escapeHtml(q.source)}</span></figcaption>
        <button class="copy" data-copy="${escapeHtml(q.text)}">Copy quote</button>
      </figure>`
        )
        .join('\n      ')}
    </section>`
    : `<section class="card">
      <h2>Already on the record</h2>
      <p class="muted">Nothing previously published maps cleanly to this subject, so rather than stretch an old quote, let's do this live. Fifteen minutes is usually enough.</p>
    </section>`;

  const pressBlock = `<section class="card">
      <h2>Relevant prior coverage</h2>
      <ul class="press">
        ${packet.press
          .map(
            (p) => `<li>
          <a href="${escapeHtml(p.url)}" rel="noopener noreferrer" target="_blank">${escapeHtml(p.title)}</a>
          <span class="meta">${escapeHtml(p.outlet)} · ${escapeHtml(fmtDate(p.date))}</span>
          <span class="badge">${escapeHtml(p.why)}</span>
        </li>`
          )
          .join('\n        ')}
      </ul>
    </section>`;

  const bios = [
    ['One-liner', f.bios.oneLiner],
    ['Short (60 words)', f.bios.short],
    ['Full', f.bios.full],
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>For ${escapeHtml(packet.reporter || 'press')}${packet.outlet ? ' · ' + escapeHtml(packet.outlet) : ''} | Thomas Prommer</title>
<meta name="description" content="Press materials prepared for ${escapeHtml(packet.reporter || 'press')}${escapeHtml(outletLine)}.">
<script type="application/ld+json">
${escapeJsonLd(buildJsonLd(f))}
</script>
<style>
:root{
  --bg:#fbfaf8; --surface:#ffffff; --ink:#1a1a1a; --muted:#6b6b6b;
  --line:#e6e2dc; --accent:#1f6f5c; --accent-soft:#e8f2ef; --warn:#8a5a00; --warn-soft:#fdf3e0;
  --radius:12px; --maxw:720px;
}
:root:not([data-theme="light"]){ }
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#131414; --surface:#1c1d1d; --ink:#ececea; --muted:#9a9a97;
    --line:#2e3030; --accent:#57bfa4; --accent-soft:#16302a; --warn:#e0b063; --warn-soft:#332815;
  }
}
:root[data-theme="dark"]{
  --bg:#131414; --surface:#1c1d1d; --ink:#ececea; --muted:#9a9a97;
  --line:#2e3030; --accent:#57bfa4; --accent-soft:#16302a; --warn:#e0b063; --warn-soft:#332815;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font:16px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:var(--maxw); margin:0 auto; padding:40px 16px 72px}
.eyebrow{font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); font-weight:600; margin:0 0 10px}
h1{font-size:clamp(26px,5vw,36px); line-height:1.15; margin:0 0 8px; letter-spacing:-.02em}
h2{font-size:15px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin:0 0 16px; font-weight:600}
h2 .sub{text-transform:none; letter-spacing:0; font-weight:400}
.lede{color:var(--muted); margin:0 0 26px; font-size:17px}
.card{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:22px; margin:0 0 18px}
.ident{display:flex; gap:18px; align-items:center; flex-wrap:wrap}
.avatar{width:76px; height:76px; border-radius:50%; background:var(--accent-soft); color:var(--accent);
  display:grid; place-items:center; font-weight:700; font-size:24px; flex:none; overflow:hidden}
.avatar img{width:100%;height:100%;object-fit:cover}
.ident h3{margin:0 0 2px; font-size:19px}
.ident p{margin:0; color:var(--muted); font-size:14px}
.chip{display:inline-block; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600;
  background:var(--accent-soft); color:var(--accent); margin:0 6px 6px 0}
.chip.warn{background:var(--warn-soft); color:var(--warn)}
.bio{border-top:1px solid var(--line); padding-top:14px; margin-top:14px}
.bio:first-of-type{border-top:0; padding-top:0; margin-top:0}
.bio h4{margin:0 0 6px; font-size:13px; color:var(--muted); font-weight:600; letter-spacing:.04em; text-transform:uppercase}
.bio p{margin:0 0 10px}
.copy{background:transparent; border:1px solid var(--line); color:var(--ink); border-radius:8px;
  padding:6px 12px; font-size:13px; cursor:pointer; font-family:inherit; transition:.15s}
.copy:hover{border-color:var(--accent); color:var(--accent)}
.copy.done{background:var(--accent-soft); border-color:var(--accent); color:var(--accent)}
.quote{margin:0 0 18px; padding:0 0 18px; border-bottom:1px solid var(--line)}
.quote:last-child{border-bottom:0; padding-bottom:0; margin-bottom:0}
blockquote{margin:0 0 8px; font-size:18px; line-height:1.5; border-left:3px solid var(--accent); padding-left:14px}
figcaption{color:var(--muted); font-size:13px; margin-bottom:10px}
.src{display:block; font-style:italic}
.press{list-style:none; margin:0; padding:0}
.press li{padding:12px 0; border-top:1px solid var(--line)}
.press li:first-child{border-top:0; padding-top:0}
.press a{color:var(--ink); text-decoration:none; font-weight:600; display:block; margin-bottom:3px}
.press a:hover{color:var(--accent); text-decoration:underline}
.meta{color:var(--muted); font-size:13px; margin-right:8px}
.badge{display:inline-block; font-size:11px; padding:2px 8px; border-radius:999px;
  background:var(--accent-soft); color:var(--accent); font-weight:600}
.qa{border-top:1px solid var(--line); padding:14px 0}
.qa:first-of-type{border-top:0; padding-top:0}
.q{margin:0 0 8px; font-weight:600}
.qn{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%;
  background:var(--accent-soft); color:var(--accent); font-size:12px; margin-right:9px}
.a{margin:0; color:var(--muted)}
.a[data-needs-answer]{background:var(--warn-soft); color:var(--warn); padding:10px 12px; border-radius:8px; font-size:14px}
.cta{display:flex; gap:10px; flex-wrap:wrap; margin-top:4px}
.btn{display:inline-block; padding:11px 18px; border-radius:9px; text-decoration:none; font-weight:600; font-size:15px}
.btn.primary{background:var(--accent); color:#fff}
.btn.ghost{border:1px solid var(--line); color:var(--ink)}
.muted{color:var(--muted)}
footer{color:var(--muted); font-size:13px; text-align:center; margin-top:28px; line-height:1.8}
footer a{color:var(--muted)}
@media (max-width:480px){ .card{padding:18px} }
</style>
</head>
<body>
<div class="wrap">

  <p class="eyebrow">Prepared for you</p>
  <h1>Hi ${escapeHtml(who)}, everything you need is on this page.</h1>
  <p class="lede">${
    packet.subject
      ? `Put together for your piece on ${escapeHtml(packet.subject)}${outletLine}.`
      : `Put together for your piece${outletLine}.`
  } Bios, headshot, quotes you can use as-is, and prior coverage on your subject. Nothing here needs a follow-up email.</p>

  <div>
    ${packet.deadline.set ? `<span class="chip${packet.deadline.urgent ? ' warn' : ''}">${escapeHtml(packet.deadline.label)}</span>` : ''}
    ${packet.topics.map((t) => `<span class="chip">${escapeHtml(t.label)}</span>`).join('\n    ')}
  </div>

  <section class="card">
    <div class="ident">
      <div class="avatar">${
        f.person.photo && /\.(jpe?g|png|webp|avif)$/i.test(f.person.photo)
          ? `<img src="${escapeHtml(f.person.photo)}" alt="${escapeHtml(f.person.name)}">`
          : escapeHtml(initials(f.person.name))
      }</div>
      <div>
        <h3>${escapeHtml(f.person.name)}</h3>
        <p>${escapeHtml(f.person.jobTitle)} · ${escapeHtml(f.person.location)}</p>
        <p class="muted">${escapeHtml(f.awards.map((a) => a.name).join(' · '))}</p>
      </div>
    </div>
  </section>

  ${questionsBlock}

  ${quotesBlock}

  <section class="card">
    <h2>Bios <span class="sub">(pick a length, one click to copy)</span></h2>
    ${bios
      .map(
        ([label, text]) => `<div class="bio">
      <h4>${escapeHtml(label)}</h4>
      <p>${escapeHtml(text)}</p>
      <button class="copy" data-copy="${escapeHtml(text)}">Copy</button>
    </div>`
      )
      .join('\n    ')}
  </section>

  ${pressBlock}

  <section class="card">
    <h2>Next step</h2>
    <p class="muted">If you need a live quote, a different angle, or a higher-resolution headshot, the fastest route is a short call.</p>
    <div class="cta">
      <a class="btn primary" href="${escapeHtml(f.links.booking)}" rel="noopener">Book a 15-minute call</a>
      <a class="btn ghost" href="${escapeHtml(f.links.askTom)}" rel="noopener">Ask a question in writing</a>
    </div>
  </section>

  <footer>
    Prepared ${escapeHtml(new Date(packet.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))} for ${escapeHtml(packet.reporter || 'press')}${outletLine}.<br>
    Unlisted page. Not indexed, not linked from <a href="${escapeHtml(f.person.site)}">prommer.net</a>.
  </footer>
</div>

<script>
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy');
  if (!btn) return;
  var text = btn.getAttribute('data-copy') || '';
  var done = function () {
    var was = btn.textContent;
    btn.textContent = 'Copied';
    btn.classList.add('done');
    setTimeout(function () { btn.textContent = was; btn.classList.remove('done'); }, 1600);
  };
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done, fallback);
  } else { fallback(); }
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (err) { btn.textContent = 'Press Ctrl+C'; }
    document.body.removeChild(ta);
  }
});
</script>
</body>
</html>
`;
}
