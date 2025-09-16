const React = require('react');
const { render, screen, cleanup } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;

const FractalDemo = require('../components/FractalDemo.tsx').default;

function createMockContext() {
  const noop = () => {};
  return {
    canvas: {},
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    save: noop,
    restore: noop,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    arc: noop,
    fill: noop,
    closePath: noop,
    createRadialGradient: () => ({ addColorStop: noop }),
  };
}

describe('FractalDemo controls', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const originalInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  const originalDevicePixelRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

  beforeEach(() => {
    document.documentElement.style.setProperty('--fract-bg', '#001122');
    document.documentElement.style.setProperty('--fract-fg', '#eef2ff');

    HTMLCanvasElement.prototype.getContext = jest.fn(createMockContext);
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 720,
    });
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1.5,
    });
  });

  afterEach(() => {
    cleanup();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    window.matchMedia = originalMatchMedia;
    if (originalInnerWidth) {
      Object.defineProperty(window, 'innerWidth', originalInnerWidth);
    }
    if (originalInnerHeight) {
      Object.defineProperty(window, 'innerHeight', originalInnerHeight);
    }
    if (originalDevicePixelRatio) {
      Object.defineProperty(window, 'devicePixelRatio', originalDevicePixelRatio);
    }
  });

  test('launch button enables the overlay and sets pressed state', async () => {
    const user = userEvent.setup();
    const { container } = render(React.createElement(FractalDemo));

    const toggle = screen.getByRole('button', { name: /fractal demo/i });
    expect(toggle).toHaveAccessibleName('Fractal Demo');
    const overlay = container.querySelector('div.pointer-events-none');

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(overlay.className).toContain('opacity-0');

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveTextContent(/hide fractal/i);
    expect(overlay.className).toContain('opacity-100');
  });

  test('mode button cycles through available rendering modes', async () => {
    const user = userEvent.setup();
    render(React.createElement(FractalDemo));

    const modeButton = screen.getByRole('button', { name: /mode:/i });

    expect(modeButton.dataset.mode).toBe('aurora');
    expect(modeButton).toHaveAttribute('aria-label', expect.stringMatching(/aurora drift/i));

    await user.click(modeButton);
    expect(modeButton.dataset.mode).toBe('kaleidoscope');
    expect(modeButton).toHaveTextContent(/kaleidoscope/i);

    await user.click(modeButton);
    expect(modeButton.dataset.mode).toBe('golden');
    expect(modeButton).toHaveTextContent(/golden bloom/i);

    const toggle = screen.getByRole('button', { name: /hide fractal/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('shuffle activates the demo without throwing errors', async () => {
    const user = userEvent.setup();
    render(React.createElement(FractalDemo));

    const shuffleButton = screen.getByRole('button', { name: /shuffle fractal seed/i });

    await expect(user.click(shuffleButton)).resolves.toBeUndefined();

    const toggle = screen.getByRole('button', { name: /hide fractal/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('hide button closes the overlay after being opened', async () => {
    const user = userEvent.setup();
    const { container } = render(React.createElement(FractalDemo));

    const toggle = screen.getByRole('button', { name: /fractal demo/i });
    const overlay = container.querySelector('div.pointer-events-none');

    await user.click(toggle);
    expect(overlay.className).toContain('opacity-100');

    await user.click(toggle);
    expect(overlay.className).toContain('opacity-0');
  });
});
