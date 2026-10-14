#!/bin/sh
# Render the favicons and the social card from icon.svg and tools/og.svg.
# Needs rsvg-convert (librsvg) and python3 with Pillow for the .ico. Run from
# the repo root; commit the outputs (games-meta STANDARD.md §9).
set -e
# The card's words are Menlo, as every Tactical card's are. Without it,
# rsvg-convert quietly takes whatever face fontconfig offers, and a card
# rendered that way once shipped in another font; refuse instead.
font=$(fc-match -f '%{family}' Menlo)
[ "$font" = Menlo ] || { echo "render-icons: Menlo is not installed (fontconfig offers $font); not rendering the card" >&2; exit 1; }
tmp=$(mktemp -d)
rsvg-convert -w 16 -h 16 icon.svg -o favicon-16x16.png
rsvg-convert -w 32 -h 32 icon.svg -o favicon-32x32.png
rsvg-convert -w 48 -h 48 icon.svg -o "$tmp/48.png"
python3 - "$tmp/48.png" <<'PY'
import sys
from PIL import Image
Image.open(sys.argv[1]).save("favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
PY
rm -rf "$tmp"
rsvg-convert -w 1200 -h 630 tools/og.svg -o og.png
echo "rendered favicon-16x16.png favicon-32x32.png favicon.ico og.png"
