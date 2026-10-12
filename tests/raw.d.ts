// Files read as text in tests (Vite's ?raw imports).
declare module "*?raw" {
  const text: string;
  export default text;
}

/** Vite's glob import (vitest): the files matching a pattern. */
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
