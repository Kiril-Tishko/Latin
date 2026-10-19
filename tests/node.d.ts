// The few Node functions the tests use (the project has no Node types: the
// page runs in a browser). tests/pace.test.ts runs the phone routine's helper.
declare module "node:fs" {
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string): void;
  export function existsSync(path: string): boolean;
}
declare module "node:os" {
  export function tmpdir(): string;
}
declare module "node:path" {
  export function join(...parts: string[]): string;
}
declare module "node:child_process" {
  export function execFileSync(cmd: string, args: string[], opts: { env?: Record<string, string>; encoding: "utf8" }): string;
}
