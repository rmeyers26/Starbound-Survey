// A tiny logging helper (spec: "console in development, silent in production").
// import.meta.env.DEV is true under `npm run dev` and false in a production build.
export function log(...messages: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log('[Starbound]', ...messages);
  }
}
