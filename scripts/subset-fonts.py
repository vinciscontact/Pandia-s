# Rebuilds the two self-hosted font files in public/fonts from @fontsource-variable/anek-tamil.
#   pip install fonttools brotli
#   python scripts/subset-fonts.py
# Latin keeps weight 100-800 and width 75-100% (condensed headlines + normal body).
# Tamil keeps the whole Tamil block + the rupee sign at normal width.
import io
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SRC = "node_modules/@fontsource-variable/anek-tamil/files"
OUT = "public/fonts"


def make(src, out, wdth, unicodes):
    font = TTFont(os.path.join(SRC, src), lazy=False)
    opts = subset.Options()
    opts.layout_features = ["*"]  # Tamil needs its shaping rules
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=unicodes)
    sub.subset(font)
    # subset first, then pin the width axis (the other order trips over lazy-loaded tables)
    buf = io.BytesIO()
    font.flavor = None
    font.save(buf)
    buf.seek(0)
    font = instancer.instantiateVariableFont(TTFont(buf), {"wdth": wdth}, updateFontNames=False)
    font.flavor = "woff2"
    path = os.path.join(OUT, out)
    font.save(path)
    print(f"{path}: {os.path.getsize(path) // 1024} KB")


latin = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2122, 0x2212]
)
tamil = list(range(0x0B80, 0x0C00)) + [0x200C, 0x200D, 0x25CC, 0x20B9]

make("anek-tamil-latin-standard-normal.woff2", "anek-latin.woff2", (75, 100), latin)
make("anek-tamil-tamil-standard-normal.woff2", "anek-tamil.woff2", 100, tamil)
