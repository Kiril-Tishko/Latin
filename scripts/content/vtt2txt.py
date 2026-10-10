"""Turn YouTube auto-caption VTT (rolling, duplicated lines) into clean timestamped text.

Usage: python3 -I vtt2txt.py input.vtt > output.txt
"""
import re
import sys

def main(path):
    text = open(path, encoding="utf-8").read()
    blocks = text.split("\n\n")
    seen = []
    last = ""
    for block in blocks:
        lines = block.strip().splitlines()
        if not lines or "-->" not in lines[0]:
            continue
        start = lines[0].split(" --> ")[0][:8]
        for line in lines[1:]:
            clean = re.sub(r"<[^>]+>", "", line).strip()
            if not clean or clean == last:
                continue
            # rolling captions repeat the previous line; keep only new lines
            if seen and clean in seen[-3:]:
                continue
            seen.append(clean)
            last = clean
            print(f"[{start}] {clean}")

if __name__ == "__main__":
    main(sys.argv[1])
