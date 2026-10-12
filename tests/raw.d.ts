// Files read as text in tests (Vite's ?raw imports).
declare module "*?raw" {
  const text: string;
  export default text;
}
