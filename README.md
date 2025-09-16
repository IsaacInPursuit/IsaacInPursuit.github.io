# IsaacInPursuit.github.io

A hybrid personal website that blends statically generated pages with a small Next.js app for the interactive contact form. The project is built around Tailwind CSS for styling and forwards contact submissions to Formspree.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- npm (bundled with Node.js)

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Build Tailwind CSS**
   ```bash
   npm run build:css
   ```
   The command compiles `styles/tailwind-input.css` into `styles/tailwind.css`, which is referenced by the static HTML pages.
3. **Run the Next.js app locally**
   ```bash
   npm run dev
   ```
   The development server serves the content in the `app/` directory, including the `/api/contact` route used by the contact form component. Visit the printed localhost URL to preview the page.

## Environment Variables

The contact API forwards submissions to Formspree. Override the default endpoint by creating an `.env.local` file in the project root:

```bash
FORMSPREE_ENDPOINT=https://formspree.io/f/your-form-id
```

If the variable is not set, the handler falls back to the repository's default Formspree form ID.

## Project Structure

- `app/` – Next.js application files (layout, main page, API route for contact form).
- `components/` – React components shared by the Next.js app.
- `styles/` – Tailwind CSS input and compiled stylesheet for the static pages.
- `projects/`, `content/`, `*.html` – Legacy static pages that are still deployed alongside the app.
- `workers/` – Web workers used by the fractal demos.

## Useful Scripts

| Command           | Description                                   |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the Next.js development server.         |
| `npm run build`   | Create a production build of the Next.js app. |
| `npm run start`   | Run the production build locally.             |
| `npm run build:css` | Compile Tailwind CSS for the static pages.    |

## Deployment Notes

- GitHub Pages can continue to serve the static HTML files in the repository root.
- Hosting the Next.js app (for example on Vercel) enables the enhanced `/api/contact` route with validation and rate limiting.

