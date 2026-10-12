// Writes the fixed texts to record, with their fingerprint, for scripts/audio/record.py.
import { writeFileSync } from "node:fs";
import { fingerprint, fixedTexts } from "../../src/audio/fixed";

const texts = fixedTexts();
const file = process.argv[2] ?? "texts.json";
writeFileSync(file, JSON.stringify({ fingerprint: fingerprint(texts), texts }, null, 1));
console.log(`${texts.length} texts → ${file}`);
