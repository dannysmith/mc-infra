import type { FC, PropsWithChildren } from "hono/jsx";

const Layout: FC<PropsWithChildren<{ title?: string }>> = ({
  title,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title ? `${title} - MC Dashboard` : "MC Dashboard"}</title>
      <link rel="stylesheet" href="/styles/output.css" />
      <script
        src="https://unpkg.com/htmx.org@2.0.4"
        integrity="sha384-HGfztofotfshcF7+8n44JQL2oJmowVChPTg48S+jvZoztPfvwD79OC/LTtG6dMp+"
        crossorigin="anonymous"
      ></script>
    </head>
    <body class="bg-bg text-text min-h-screen" hx-boost="true">
      <header class="border-b border-border px-6 py-4">
        <nav class="mx-auto flex max-w-6xl items-center gap-6">
          <a
            href="/"
            class="text-text-heading text-lg font-bold no-underline hover:text-link"
          >
            MC Dashboard
          </a>
        </nav>
      </header>
      <main class="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </body>
  </html>
);

export default Layout;
