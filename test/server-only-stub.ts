/**
 * Stand-in for the `server-only` package under Vitest.
 *
 * The real module throws on import unless it is being resolved for a React
 * Server Component, which a unit test never is. Aliasing it here (see
 * vitest.config.mts) lets server-side modules be tested directly; the genuine
 * guard is unaffected in the Next build, which is the place where a client
 * component importing server code would actually leak something.
 */
export {};
