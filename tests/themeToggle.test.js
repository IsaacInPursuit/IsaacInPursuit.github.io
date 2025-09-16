const React = require('react');
const { render, screen } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;

const ThemeToggleButton = require('../components/ThemeToggleButton.tsx').default;

function createMatchMedia(matches = false) {
  return jest.fn().mockImplementation((query) => {
    const listeners = new Set();
    return {
      matches,
      media: query,
      addEventListener: jest.fn((_, cb) => listeners.add(cb)),
      removeEventListener: jest.fn((_, cb) => listeners.delete(cb)),
      addListener: jest.fn((cb) => listeners.add(cb)),
      removeListener: jest.fn((cb) => listeners.delete(cb)),
      dispatchEvent: jest.fn((event) => {
        listeners.forEach((listener) => listener(event));
        return true;
      }),
    };
  });
}

describe('ThemeToggleButton', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.style.colorScheme = '';
    window.localStorage.clear();
    window.matchMedia = createMatchMedia(false);
  });

  test('clicking toggles between light and dark mode and updates storage', async () => {
    const user = userEvent.setup();
    render(React.createElement(ThemeToggleButton));

    const button = await screen.findByRole('button', { name: /dark mode/i });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem('theme-preference')).toBe('dark');
    expect(button).toHaveTextContent(/light mode/i);
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(window.localStorage.getItem('theme-preference')).toBe('light');
    expect(button).toHaveTextContent(/dark mode/i);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});
