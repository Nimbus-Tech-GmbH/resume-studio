import { describe, expect, it } from 'vitest';
import { postProcess } from './postProcess';

describe('postProcess', () => {
  it('injects head content before </head> in a full document', () => {
    const html = '<!doctype html><html><head><title>t</title></head><body></body></html>';
    const out = postProcess(html);
    expect(out).toContain('<meta name="viewport"');
    expect(out.indexOf('<meta name="viewport"')).toBeLessThan(out.indexOf('</head>'));
    expect(out).toContain('<title>t</title>');
  });

  it('wraps partial HTML output in a full document', () => {
    const out = postProcess('<p>hello</p>');
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('<meta name="viewport"');
    expect(out).toContain('<body><p>hello</p></body>');
  });

  it('returns empty input unchanged', () => {
    expect(postProcess('')).toBe('');
  });
});
