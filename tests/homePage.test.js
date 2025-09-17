const React = require('react');
const { render, screen, cleanup } = require('@testing-library/react');

jest.mock('next/link', () => {
  const React = require('react');
  return React.forwardRef(({ href, children, prefetch, ...rest }, ref) =>
    React.createElement(
      'a',
      {
        ...rest,
        href: typeof href === 'string' ? href : href?.pathname ?? '#',
        ref,
      },
      children,
    ),
  );
});

const pageModule = require('../app/page.tsx');
const Page = pageModule.default;
const { projects } = pageModule;

afterEach(() => {
  cleanup();
});

describe('Homepage', () => {
  test('Book a Call CTA points to Google Calendar booking', () => {
    render(React.createElement(Page));

    const bookLink = screen.getByRole('link', { name: /book a call/i });
    expect(bookLink).toHaveAttribute('href', 'https://calendar.app.google/V6WfbjRRDxbFr6X69');
  });

  test('footer displays the current year', () => {
    render(React.createElement(Page));

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(`© ${currentYear} Isaac Johnston`)).toBeInTheDocument();
  });

  test('projects section renders a card for each project', () => {
    render(React.createElement(Page));

    projects.forEach((project) => {
      const projectLink = screen.getByRole('link', { name: new RegExp(project.title, 'i') });
      expect(projectLink).toHaveAttribute('href', project.href);
      expect(screen.getByText(project.description)).toBeInTheDocument();
    });
  });
});
