/**
 * Post-processors applied to theme HTML output.
 * The upstream `nimbus-tech/scripts/generateResumeFiles/render.ts` performs a
 * larger set of rewrites (asset inlining, print CSS injection). MVP keeps it
 * lightweight: inject a viewport meta tag and a small CSS reset so the iframe
 * preview matches print/browser output more closely.
 */

const INJECT_HEAD = `
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
`;

export function postProcess(html: string): string {
  if (!html) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${INJECT_HEAD}</head>`);
  }
  // Some themes return partial HTML — wrap it.
  return `<!doctype html><html><head>${INJECT_HEAD}</head><body>${html}</body></html>`;
}
