import type { JsonResume } from '@resume-studio/transformer';
import { buildDoc } from './shared.js';

export type ThemeRenderer = (resume: JsonResume) => string;

// ─── developer-mono ─────────────────────────────────────────────────────
const developerMono: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace; background: #0d1117; color: #c9d1d9; font-size: 13px; line-height: 1.55; }
a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }
.resume { background: #0d1117; }
.name { font-size: 1.6rem; margin: 0; color: #f0f6fc; }
.name::before { content: '$ whoami '; color: #7ee787; opacity: 0.7; }
.label { color: #8b949e; margin: 0.25rem 0 0.75rem; }
.label::before { content: '# '; color: #7ee787; }
.contact, .profiles { font-size: 0.8rem; color: #8b949e; }
.section-title { color: #7ee787; border-bottom: 1px solid #30363d; padding-bottom: 0.3rem; }
.section-title::before { content: '// '; opacity: 0.5; }
.entry-title { color: #f0f6fc; }
.entry-sub { color: #8b949e; }
.entry-date { color: #6e7681; }
.tag { color: #58a6ff; border-color: #30363d; background: #161b22; border-radius: 3px; }
.hl li::marker { content: '→ '; color: #7ee787; }
`, { fontLinks: ['<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">'] });

// ─── flat ────────────────────────────────────────────────────────────────
const flat: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Roboto', system-ui, sans-serif; background: #ecf0f1; color: #2c3e50; font-size: 14px; }
.resume { background: #fff; margin: 2rem auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.name { font-size: 2rem; margin: 0; color: #2c3e50; font-weight: 500; }
.label { color: #3498db; margin: 0.25rem 0 1rem; font-weight: 500; }
.contact, .profiles { font-size: 0.85rem; color: #7f8c8d; }
.section-title { color: #3498db; border-left: 4px solid #3498db; padding-left: 0.6rem; font-size: 0.85rem; }
.entry-title { color: #2c3e50; }
.tag { background: #3498db; color: white; border: none; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">'] });

// ─── modern-classic ──────────────────────────────────────────────────────
const modernClassic: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Source Sans 3', sans-serif; color: #1a1a1a; background: #fafaf7; font-size: 14px; line-height: 1.6; }
.resume { background: #fff; margin: 2rem auto; }
.name { font-family: 'Playfair Display', serif; font-size: 2.4rem; margin: 0; font-weight: 700; }
.label { font-family: 'Playfair Display', serif; font-style: italic; color: #666; margin: 0.2rem 0 1rem; }
.header { border-bottom: 2px solid #1a1a1a; padding-bottom: 1rem; margin-bottom: 1rem; }
.contact, .profiles { font-size: 0.85rem; color: #555; }
.section-title { font-family: 'Playfair Display', serif; font-size: 1rem; color: #1a1a1a; letter-spacing: 0.15em; }
.entry-title { font-weight: 600; }
.tag { border-color: #999; color: #555; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">'] });

// ─── writers-portfolio ───────────────────────────────────────────────────
const writersPortfolio: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'EB Garamond', Georgia, serif; color: #2b2b2b; background: #f7f2e9; font-size: 16px; line-height: 1.75; }
.resume { max-width: 680px; background: #fdfaf3; padding: 3.5rem; }
.name { font-size: 2.8rem; font-weight: 400; margin: 0; font-style: italic; letter-spacing: -0.01em; }
.label { color: #8a6a3f; margin: 0.5rem 0 1.5rem; font-size: 1.1rem; }
.header { text-align: center; border-bottom: 1px solid #d9c9a8; padding-bottom: 1.5rem; }
.contact, .profiles { text-align: center; font-size: 0.9rem; color: #6b5b40; }
.section-title { font-size: 0.75rem; color: #8a6a3f; text-align: center; letter-spacing: 0.3em; margin: 2rem 0 1rem; }
.entry-title { font-weight: 600; font-size: 1.05rem; }
.entry-sub { font-style: italic; }
.tag { border: none; background: none; padding: 0; opacity: 0.7; font-style: italic; }
.tag::after { content: ','; }
.tag:last-child::after { content: ''; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">'] });

// ─── nordic-minimal ──────────────────────────────────────────────────────
const nordicMinimal: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Inter', system-ui, sans-serif; color: #2e3440; background: #eceff4; font-size: 13.5px; line-height: 1.65; }
.resume { max-width: 780px; background: #fff; padding: 4rem 3.5rem; }
.name { font-size: 1.75rem; font-weight: 300; margin: 0; letter-spacing: -0.02em; color: #2e3440; }
.label { color: #4c566a; margin: 0.3rem 0 1rem; font-weight: 400; }
.contact, .profiles { font-size: 0.8rem; color: #4c566a; }
.section { margin-top: 2.5rem; }
.section-title { color: #5e81ac; font-weight: 500; }
.entry-title { font-weight: 500; color: #2e3440; }
.entry-sub { color: #4c566a; }
.entry-date { color: #81a1c1; }
.tag { border-color: #d8dee9; color: #4c566a; background: #eceff4; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500&display=swap" rel="stylesheet">'] });

// ─── graph-paper-grid ────────────────────────────────────────────────────
const graphPaperGrid: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'IBM Plex Mono', monospace; color: #1a1a1a; font-size: 13px; line-height: 1.6;
  background-color: #fafcff;
  background-image:
    linear-gradient(to right, #cfd8dc 1px, transparent 1px),
    linear-gradient(to bottom, #cfd8dc 1px, transparent 1px);
  background-size: 24px 24px; }
.resume { background: rgba(255,255,255,0.85); border: 1.5px solid #1a1a1a; }
.name { font-size: 1.8rem; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
.label { margin: 0.25rem 0 1rem; }
.header { border-bottom: 1.5px solid #1a1a1a; padding-bottom: 0.75rem; }
.section-title { border-bottom: 1px dashed #1a1a1a; padding-bottom: 0.25rem; color: #1a1a1a; }
.entry-title { font-weight: 600; }
.tag { border-radius: 0; border-width: 1px; background: #fff; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">'] });

// ─── monochrome-noir ─────────────────────────────────────────────────────
const monochromeNoir: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #e5e5e5; font-size: 14px; line-height: 1.65; }
.resume { background: #0a0a0a; }
a { color: #fafafa; text-decoration: underline; text-decoration-color: #525252; }
.name { font-size: 2.5rem; font-weight: 200; margin: 0; letter-spacing: -0.03em; color: #fafafa; }
.label { color: #a3a3a3; margin: 0.3rem 0 1rem; font-weight: 300; }
.header { border-bottom: 1px solid #262626; padding-bottom: 1.25rem; }
.contact, .profiles { font-size: 0.82rem; color: #737373; }
.section-title { color: #737373; }
.entry-title { color: #fafafa; font-weight: 500; }
.entry-sub { color: #a3a3a3; }
.entry-date { color: #525252; }
.tag { border-color: #404040; color: #a3a3a3; background: #171717; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;500&display=swap" rel="stylesheet">'] });

// ─── new-york-editorial ──────────────────────────────────────────────────
const newYorkEditorial: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Chomsky', 'Times New Roman', serif; color: #121212; background: #f5f1e8; font-size: 15px; line-height: 1.6; }
.resume { background: #fdfbf5; max-width: 780px; padding: 3rem; column-rule: 1px solid #ccc; }
.name { font-family: 'Chomsky', 'UnifrakturCook', serif; font-size: 3.2rem; margin: 0; text-align: center; font-weight: 400; letter-spacing: -0.01em; }
.label { text-align: center; font-family: 'Playfair Display', serif; font-style: italic; margin: 0.25rem 0; color: #444; }
.header { border-top: 3px double #121212; border-bottom: 3px double #121212; padding: 1rem 0; margin-bottom: 1.5rem; }
.contact, .profiles { text-align: center; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.15em; color: #555; }
.section-title { font-family: 'Playfair Display', serif; font-size: 0.95rem; text-align: center; border-bottom: 1px solid #121212; padding-bottom: 0.3rem; letter-spacing: 0.2em; }
.entry-title { font-weight: 700; font-family: 'Playfair Display', serif; }
.summary p, .entry p { text-align: justify; hyphens: auto; }
.tag { border: none; background: none; padding: 0 0.2rem; opacity: 0.7; font-variant: small-caps; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=UnifrakturCook:wght@700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">'] });

// ─── claude ──────────────────────────────────────────────────────────────
const claude: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Styrene B', 'Inter', system-ui, sans-serif; color: #191919; background: #f5f4ee; font-size: 14px; line-height: 1.65; }
.resume { background: #faf9f5; max-width: 800px; padding: 3rem; border-radius: 8px; }
.name { font-family: 'Copernicus', 'Tiempos Text', Georgia, serif; font-size: 2.2rem; font-weight: 500; margin: 0; letter-spacing: -0.02em; color: #191919; }
.label { color: #cc785c; margin: 0.35rem 0 1.25rem; font-weight: 500; }
.header { border-bottom: 1px solid #e5e2d5; padding-bottom: 1.25rem; }
.contact, .profiles { font-size: 0.85rem; color: #5a5751; }
a { color: #cc785c; text-decoration: none; border-bottom: 1px solid rgba(204,120,92,0.3); }
.section-title { color: #cc785c; font-weight: 500; }
.entry-title { color: #191919; font-weight: 600; }
.entry-sub { color: #5a5751; }
.entry-date { color: #8a8880; }
.tag { border-color: #e5e2d5; color: #5a5751; background: #f5f4ee; border-radius: 6px; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lora:wght@500&display=swap" rel="stylesheet">'] });

// ─── brutalist ───────────────────────────────────────────────────────────
const brutalist: ThemeRenderer = (r) =>
  buildDoc(r, `
body { font-family: 'Space Mono', 'Courier New', monospace; color: #000; background: #ff0; font-size: 13px; line-height: 1.5; }
.resume { background: #fff; border: 6px solid #000; padding: 2rem; box-shadow: 12px 12px 0 #000; margin: 2rem auto; }
.name { font-size: 2.6rem; margin: 0; text-transform: uppercase; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
.label { background: #000; color: #ff0; display: inline-block; padding: 0.15rem 0.5rem; margin: 0.5rem 0 1rem; font-weight: 700; text-transform: uppercase; }
.header { border-bottom: 4px solid #000; padding-bottom: 1rem; }
.contact, .profiles { font-size: 0.8rem; text-transform: uppercase; font-weight: 700; }
a { text-decoration: underline; text-decoration-thickness: 2px; }
.section-title { background: #000; color: #ff0; padding: 0.3rem 0.6rem; margin: 2rem 0 1rem; font-size: 0.85rem; font-weight: 700; }
.entry-title { text-transform: uppercase; font-weight: 700; }
.entry-date { font-weight: 700; }
.tag { border: 2px solid #000; border-radius: 0; background: #ff0; color: #000; font-weight: 700; text-transform: uppercase; }
.hl li::marker { content: '▸ '; }
`, { fontLinks: ['<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">'] });

export const themes = {
  'developer-mono': developerMono,
  flat,
  'modern-classic': modernClassic,
  'writers-portfolio': writersPortfolio,
  'nordic-minimal': nordicMinimal,
  'graph-paper-grid': graphPaperGrid,
  'monochrome-noir': monochromeNoir,
  'new-york-editorial': newYorkEditorial,
  claude,
  brutalist,
} as const;
