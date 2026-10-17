# 글꼴 줄이기(CHM-75): 원본 Galmuri11(tools/fonts/, 배포 · 앱에 안 든다)에서 쓰는 글자만 남긴 woff2를 assets/fonts/에 쓴다.
# 남기는 글자: KS X 1001 한글 2,350 + 출력 ASCII + src/**/*.js · index.html · privacy.html · style.css · manifest.webmanifest의 모든 글자.
# 파일 이름에 내용 해시를 붙이고(오래 캐시해도 되게) style.css @font-face를 고친다. 덮은 글자표는 tools/fonts/glyphs.json(test/fonts.test.js가 읽는다).
# 돌리기: fonttools · brotli가 든 파이썬으로 — python3 -m venv .venv && .venv/bin/pip install fonttools brotli && .venv/bin/python tools/fonts.py
# 그 뒤 node tools/preload.mjs(index.html의 미리 받기 줄)도 다시 돌린다.
import hashlib
import json
import pathlib
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'tools' / 'fonts'
OUT_DIR = ROOT / 'assets' / 'fonts'
FONTS = ['Galmuri11', 'Galmuri11-Bold']
FILES = ['index.html', 'privacy.html', 'style.css', 'manifest.webmanifest']


def used_chars():
    paths = sorted((ROOT / 'src').rglob('*.js')) + [ROOT / f for f in FILES]
    out = set()
    for p in paths:
        out.update(ch for ch in p.read_text(encoding='utf-8') if ord(ch) >= 0x20)
    return out


def ksx_hangul():
    out = set()
    for hi in range(0xB0, 0xC9):
        for lo in range(0xA1, 0xFF):
            out.add(bytes([hi, lo]).decode('euc-kr'))
    return out


def main():
    want = used_chars() | ksx_hangul() | {chr(c) for c in range(0x20, 0x7F)}
    covered = None
    absent = set()
    fonts = {}
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    for name in FONTS:
        font = TTFont(SRC_DIR / f'{name}.woff2', recalcTimestamp=False)
        have = {chr(c) for c in font.getBestCmap()}
        keep = want & have
        absent |= want - have
        covered = keep if covered is None else covered & keep
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.recalc_timestamp = False
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=sorted(ord(c) for c in keep))
        sub.subset(font)
        tmp = OUT_DIR / f'{name}.tmp.woff2'
        subset.save_font(font, str(tmp), opts)
        data = tmp.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        out = OUT_DIR / f'{name}.{digest[:8]}.woff2'
        for old in OUT_DIR.glob(f'{name}.*.woff2'):
            if old != tmp and re.fullmatch(re.escape(name) + r'\.[0-9a-f]{8}\.woff2', old.name):
                old.unlink()
        tmp.rename(out)
        rel = f'assets/fonts/{out.name}'
        fonts[rel] = {'sha256': digest, 'bytes': len(data), 'glyphs': len(keep)}
        css, n = re.subn(r'url\("assets/fonts/' + re.escape(name) + r'(\.[0-9a-f]{8})?\.woff2"\)', f'url("{rel}")', css)
        if n != 1:
            sys.exit(f'style.css에서 {name}의 @font-face를 하나 찾지 못했다({n}개)')
        print(f'{rel}: {len(keep)}자 {len(data)} B')
    (ROOT / 'style.css').write_text(css, encoding='utf-8')
    glyphs = {
        'fonts': fonts,
        'covered': ''.join(sorted(covered)),
        'missingInSource': ''.join(sorted(absent - covered)),
    }
    (SRC_DIR / 'glyphs.json').write_text(json.dumps(glyphs, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'덮은 글자 {len(covered)} · 원본 둘 중 하나라도 없는 글자 {len(glyphs["missingInSource"])}: {glyphs["missingInSource"]}')


main()
