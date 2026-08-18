import type { JsonResume } from '@resume-studio/transformer';

export interface ThemeOpts {
  /** Extra CSS injected after base + theme sheet. */
  extraCss?: string;
  /** Optional inline `<style>` for @page rules, etc. */
  pageCss?: string;
  /** Font links to inject in <head>. */
  fontLinks?: string[];
}

export function esc(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function dateRange(start?: string, end?: string): string {
  const s = formatDate(start);
  const e = end ? formatDate(end) : 'Present';
  if (!s && !e) return '';
  return `${s} — ${e}`;
}

/**
 * Build a well-structured HTML document. Themes supply a CSS string and
 * optional wrapper class; the section markup is identical across themes so
 * the CSS carries all visual differentiation.
 */
export function buildDoc(resume: JsonResume, css: string, opts: ThemeOpts = {}): string {
  const b = resume.basics ?? {};
  const fontLinks = (opts.fontLinks ?? []).join('\n');
  const title = esc(b.name || 'Resume');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
${fontLinks}
<style>
${baseCss}
${css}
${opts.extraCss ?? ''}
${opts.pageCss ?? ''}
</style>
</head>
<body>
<main class="resume">
${headerBlock(resume)}
${summaryBlock(resume)}
${workBlock(resume)}
${educationBlock(resume)}
${skillsBlock(resume)}
${projectsBlock(resume)}
${volunteerBlock(resume)}
${certificatesBlock(resume)}
${languagesBlock(resume)}
${interestsBlock(resume)}
</main>
</body>
</html>`;
}

/** Minimal reset shared across themes. Everything else lives in theme CSS. */
const baseCss = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
img { max-width: 100%; height: auto; }
a { color: inherit; }
ul { margin: 0; padding: 0; list-style: none; }
.resume { max-width: 820px; margin: 0 auto; padding: 2.5rem; }
.section { margin-top: 1.75rem; }
.section-title { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.75rem; margin: 0 0 0.75rem; }
.entry { margin-bottom: 1rem; }
.entry-head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
.entry-title { font-weight: 600; }
.entry-sub { font-size: 0.85rem; opacity: 0.75; }
.entry-date { font-size: 0.8rem; opacity: 0.65; white-space: nowrap; }
.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.35rem; }
.tag { font-size: 0.72rem; padding: 0.1rem 0.5rem; border: 1px solid currentColor; border-radius: 999px; opacity: 0.75; }
.hl { margin: 0.4rem 0 0 1rem; }
.hl li { margin-bottom: 0.2rem; }
p { margin: 0.35rem 0; }
`;

function headerBlock(resume: JsonResume): string {
  const b = resume.basics ?? {};
  const loc = b.location ?? {};
  const locStr = [loc.city, loc.region, loc.countryCode].filter(Boolean).join(', ');
  const contact = [
    b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : '',
    b.phone ? esc(b.phone) : '',
    b.url ? `<a href="${esc(b.url)}">${esc(b.url)}</a>` : '',
    locStr ? esc(locStr) : '',
  ].filter(Boolean).join(' · ');
  const profiles = (b.profiles ?? [])
    .map((p) => `<a href="${esc(p.url)}">${esc(p.network || p.username)}</a>`)
    .join(' · ');
  return `<header class="header">
    <h1 class="name">${esc(b.name)}</h1>
    ${b.label ? `<p class="label">${esc(b.label)}</p>` : ''}
    ${contact ? `<p class="contact">${contact}</p>` : ''}
    ${profiles ? `<p class="profiles">${profiles}</p>` : ''}
  </header>`;
}

function summaryBlock(resume: JsonResume): string {
  const s = resume.basics?.summary;
  if (!s) return '';
  return `<section class="section summary">
    <h2 class="section-title">Summary</h2>
    <p>${esc(s)}</p>
  </section>`;
}

function workBlock(resume: JsonResume): string {
  const items = resume.work ?? [];
  if (items.length === 0) return '';
  return `<section class="section work">
    <h2 class="section-title">Experience</h2>
    ${items.map((w) => `<article class="entry">
      <div class="entry-head">
        <div>
          <div class="entry-title">${esc(w.position || '')}${w.position && w.name ? ' · ' : ''}<span class="entry-sub">${esc(w.name || '')}</span></div>
        </div>
        <div class="entry-date">${esc(dateRange(w.startDate, w.endDate))}</div>
      </div>
      ${w.summary ? `<p>${esc(w.summary)}</p>` : ''}
      ${(w.highlights ?? []).length > 0 ? `<ul class="hl">${w.highlights!.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    </article>`).join('')}
  </section>`;
}

function educationBlock(resume: JsonResume): string {
  const items = resume.education ?? [];
  if (items.length === 0) return '';
  return `<section class="section education">
    <h2 class="section-title">Education</h2>
    ${items.map((e) => `<article class="entry">
      <div class="entry-head">
        <div>
          <div class="entry-title">${esc(e.institution || '')}</div>
          <div class="entry-sub">${esc([e.studyType, e.area].filter(Boolean).join(', '))}</div>
        </div>
        <div class="entry-date">${esc(dateRange(e.startDate, e.endDate))}</div>
      </div>
      ${e.score ? `<p class="entry-sub">${esc(e.score)}</p>` : ''}
      ${(e.courses ?? []).length > 0 ? `<div class="tags">${e.courses!.map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>` : ''}
    </article>`).join('')}
  </section>`;
}

function skillsBlock(resume: JsonResume): string {
  const items = resume.skills ?? [];
  if (items.length === 0) return '';
  return `<section class="section skills">
    <h2 class="section-title">Skills</h2>
    ${items.map((s) => `<div class="entry">
      <div class="entry-head">
        <div class="entry-title">${esc(s.name)}${s.level ? ` <span class="entry-sub">· ${esc(s.level)}</span>` : ''}</div>
      </div>
      ${(s.keywords ?? []).length > 0 ? `<div class="tags">${s.keywords!.map((k) => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
    </div>`).join('')}
  </section>`;
}

function projectsBlock(resume: JsonResume): string {
  const items = resume.projects ?? [];
  if (items.length === 0) return '';
  return `<section class="section projects">
    <h2 class="section-title">Projects</h2>
    ${items.map((p) => `<article class="entry">
      <div class="entry-head">
        <div class="entry-title">${p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name)}</div>
        <div class="entry-date">${esc(dateRange(p.startDate, p.endDate))}</div>
      </div>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      ${(p.highlights ?? []).length > 0 ? `<ul class="hl">${p.highlights!.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      ${(p.keywords ?? []).length > 0 ? `<div class="tags">${p.keywords!.map((k) => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
    </article>`).join('')}
  </section>`;
}

function volunteerBlock(resume: JsonResume): string {
  const items = resume.volunteer ?? [];
  if (items.length === 0) return '';
  return `<section class="section volunteer">
    <h2 class="section-title">Volunteer</h2>
    ${items.map((v) => `<article class="entry">
      <div class="entry-head">
        <div>
          <div class="entry-title">${esc(v.position || '')}${v.position && v.organization ? ' · ' : ''}<span class="entry-sub">${esc(v.organization || '')}</span></div>
        </div>
        <div class="entry-date">${esc(dateRange(v.startDate, v.endDate))}</div>
      </div>
      ${v.summary ? `<p>${esc(v.summary)}</p>` : ''}
      ${(v.highlights ?? []).length > 0 ? `<ul class="hl">${v.highlights!.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
    </article>`).join('')}
  </section>`;
}

function certificatesBlock(resume: JsonResume): string {
  const items = resume.certificates ?? [];
  if (items.length === 0) return '';
  return `<section class="section certificates">
    <h2 class="section-title">Certificates</h2>
    ${items.map((c) => `<div class="entry">
      <div class="entry-head">
        <div class="entry-title">${c.url ? `<a href="${esc(c.url)}">${esc(c.name)}</a>` : esc(c.name)}</div>
        <div class="entry-date">${esc(formatDate(c.date))}</div>
      </div>
      ${c.issuer ? `<div class="entry-sub">${esc(c.issuer)}</div>` : ''}
      ${c.summary ? `<p>${esc(c.summary)}</p>` : ''}
    </div>`).join('')}
  </section>`;
}

function languagesBlock(resume: JsonResume): string {
  const items = resume.languages ?? [];
  if (items.length === 0) return '';
  return `<section class="section languages">
    <h2 class="section-title">Languages</h2>
    <div class="tags">
      ${items.map((l) => `<span class="tag">${esc(l.language)}${l.fluency ? ` · ${esc(l.fluency)}` : ''}</span>`).join('')}
    </div>
  </section>`;
}

function interestsBlock(resume: JsonResume): string {
  const items = resume.interests ?? [];
  if (items.length === 0) return '';
  return `<section class="section interests">
    <h2 class="section-title">Interests</h2>
    ${items.map((i) => `<div class="entry">
      <div class="entry-title">${esc(i.name)}</div>
      ${(i.keywords ?? []).length > 0 ? `<div class="tags">${i.keywords!.map((k) => `<span class="tag">${esc(k)}</span>`).join('')}</div>` : ''}
    </div>`).join('')}
  </section>`;
}
