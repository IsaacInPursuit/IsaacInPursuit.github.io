const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const indexDomForScripts = new JSDOM(indexHtml);
const indexInlineScript = Array.from(indexDomForScripts.window.document.querySelectorAll('script'))
  .filter((script) => !script.src)
  .map((script) => script.textContent || '')
  .join('\n');

function createDom() {
  const formMarkup = `
    <form action="https://formspree.io/f/mkgnjopd" method="POST" data-form>
      <div>
        <label for="name">Name</label>
        <input id="name" name="name" required type="text" />
      </div>
      <div aria-hidden="true">
        <label class="sr-only" for="company">Company</label>
        <input id="company" name="company" type="text" data-honeypot />
      </div>
      <div>
        <label for="email">Email</label>
        <input id="email" name="email" required type="email" />
      </div>
      <div>
        <label for="message">Message</label>
        <textarea id="message" name="message" required></textarea>
      </div>
      <button type="submit">Send message</button>
      <p data-form-status role="status" aria-live="polite" class="hidden"></p>
    </form>
  `;

  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
      <button id="themeToggle" type="button">Theme</button>
      ${formMarkup}
      <span id="year"></span>
    </body></html>`,
    {
      url: 'https://isaacinpursuit.github.io/index.html',
      runScripts: 'outside-only',
      pretendToBeVisual: true,
    },
  );

  const { window } = dom;
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });

  return { dom, window, form: window.document.querySelector('form[data-form]') };
}

function runInlineScript(dom) {
  const script = new vm.Script(indexInlineScript, { filename: 'index-inline.js' });
  const context = dom.getInternalVMContext();
  script.runInContext(context);
}

function flushPromises(window) {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('Contact form validation', () => {
  test('valid submissions call Formspree endpoint and show success message', async () => {
    const { dom, window, form } = createDom();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    window.fetch = fetchMock;

    runInlineScript(dom);

    form.querySelector('#name').value = 'Isaac';
    form.querySelector('#email').value = 'isaac@example.com';
    form.querySelector('#message').value = 'Sharing a meaningful update about the project.';

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises(window);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('https://formspree.io/f/mkgnjopd', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Accept: 'application/json' }),
    }));

    const status = form.querySelector('[data-form-status]');
    expect(status.textContent).toContain('Thanks!');
    expect(status.classList.contains('hidden')).toBe(false);
    expect(status.classList.contains('text-brand-600')).toBe(true);

    const submitButton = form.querySelector('button[type="submit"]');
    expect(submitButton.disabled).toBe(false);
    expect(form.querySelector('#name').value).toBe('');
  });

  test('missing required input shows validation error and prevents submission', async () => {
    const { dom, window, form } = createDom();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    window.fetch = fetchMock;

    runInlineScript(dom);

    form.querySelector('#name').value = 'Isaac';
    form.querySelector('#email').value = '';
    form.querySelector('#message').value = '';

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises(window);

    expect(fetchMock).not.toHaveBeenCalled();

    const status = form.querySelector('[data-form-status]');
    expect(status.textContent).toBe('Email is required.');
    expect(status.classList.contains('hidden')).toBe(false);
    expect(status.classList.contains('text-red-600')).toBe(true);

    const emailField = form.querySelector('#email');
    const messageField = form.querySelector('#message');
    expect(emailField.getAttribute('aria-invalid')).toBe('true');
    expect(messageField.getAttribute('aria-invalid')).toBe('true');
  });

  test('honeypot input blocks spam submissions', async () => {
    const { dom, window, form } = createDom();
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    window.fetch = fetchMock;

    runInlineScript(dom);

    form.querySelector('#name').value = 'Isaac';
    form.querySelector('#email').value = 'isaac@example.com';
    form.querySelector('#message').value = 'A message that should pass validation.';
    form.querySelector('[data-honeypot]').value = 'bot entry';

    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises(window);

    expect(fetchMock).not.toHaveBeenCalled();

    const status = form.querySelector('[data-form-status]');
    expect(status.textContent).toBe('We could not verify your submission. Please refresh and try again.');
    expect(status.classList.contains('text-red-600')).toBe(true);
  });
});
