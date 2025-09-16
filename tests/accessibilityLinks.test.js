const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

function loadHtml(filename) {
  const filePath = path.join(__dirname, '..', filename);
  return fs.readFileSync(filePath, 'utf8');
}

describe('External link safety and accessibility affordances', () => {
  test('new-tab links provide rel="noopener noreferrer" for safety', () => {
    const files = ['index.html', 'contact-form.html'];

    files.forEach((file) => {
      const dom = new JSDOM(loadHtml(file));
      const anchors = Array.from(dom.window.document.querySelectorAll('a[target="_blank"]'));

      anchors.forEach((anchor) => {
        const rel = anchor.getAttribute('rel') || '';
        expect(rel).toContain('noopener');
        expect(rel).toContain('noreferrer');
      });

      const formsLinks = anchors.filter((anchor) => /forms\.gle/.test(anchor.href));
      formsLinks.forEach((anchor) => {
        expect(anchor.target).toBe('_blank');
      });
    });
  });

  test('skip link includes focus styles that reveal the control', () => {
    const html = loadHtml('index.html');
    const skipRule = html.match(/\.skip-link\s*{([\s\S]*?)}/);
    const focusRule = html.match(/\.skip-link:focus\s*{([\s\S]*?)}/);

    expect(skipRule).not.toBeNull();
    expect(skipRule[1]).toContain('opacity: 0');
    expect(skipRule[1]).toContain('pointer-events: none');

    expect(focusRule).not.toBeNull();
    expect(focusRule[1]).toContain('opacity: 1');
    expect(focusRule[1]).toContain('pointer-events: auto');
  });
});
