# 글꼴 줄이기(CHM-75 · 안 3 CHM-77): 원본 글꼴에서 쓰는 글자만 남긴 woff2를 assets/fonts/에 쓴다.
# 글꼴 둘: Black Han Sans(굵은 글 — 숫자 · 제목 · 단추) · IBM Plex Sans KR Medium(보통 글 — 본문 · 효과 · 말풍선). 둘 다 SIL OFL 1.1.
# Plex는 예약 글꼴 이름(Reserved Font Name "Plex")이 있어, 고친(줄이고 ‹ ›를 더한) 파일은 이름 표 · CSS 이름을 Chainmate Sans KR로 바꾼다(OFL 3항).
# 바꾼 것과 원본은 assets/fonts/README.txt에 적는다(이 도구가 쓴다).
# 원본은 google/fonts의 고정 커밋에서 curl로 받아 tools/fonts/src/(git 밖)에 두고 sha256을 맞춘다. 배포 · 앱에는 줄인 파일과 OFL만 든다.
# 남기는 글자: 출력 ASCII + src/**/*.js · index.html · privacy.html · style.css · manifest.webmanifest의 모든 글자(KS X 1001 한글 전체는 넣지 않는다 —
#   화면에 그리는 바깥 글은 아이디(a-z0-9_)와 목록에서 뽑는 순위 이름뿐이다). Plex KR에 없는 ‹ ›는 IBM Plex Sans(같은 500 굵기)에서 옮겨 넣는다.
# Black Han Sans에 없는 기호(· → … ★ 등)는 그리는 쪽 글꼴 줄(text.js)이 Plex KR로 넘긴다 — 그래서 덮은 글자표(covered)는 Plex KR 파일이 기준이다.
# 파일 이름에 내용 해시를 붙이고(오래 캐시해도 되게) style.css @font-face를 고친다. 덮은 글자표는 tools/fonts/glyphs.json(test/fonts.test.js가 읽는다).
# 돌리기(저장소 밖 임시 환경 — 설치 없이 uv 캐시로): uv run --no-project --with fonttools --with brotli python tools/fonts.py
# 그 뒤 node tools/preload.mjs(index.html의 미리 받기 줄)와 node tools/fontwidths.mjs(연기 시험의 글 폭 표)도 다시 돌린다.
import hashlib
import json
import pathlib
import re
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / 'tools' / 'fonts' / 'src'
OUT_DIR = ROOT / 'assets' / 'fonts'
FILES = ['index.html', 'privacy.html', 'style.css', 'manifest.webmanifest']
COMMIT = 'e7db6ca603fd4862010383ff17ffd6cc4ffac1c0'  # google/fonts main, 2026-10-24
BASE = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl'
SOURCES = {
    'BlackHanSans-Regular.ttf': ('blackhansans/BlackHanSans-Regular.ttf', '31960809284026681774a8e52dc19ebcad26cf69b0ad9d560f288296fbb52739'),
    'OFL-BlackHanSans.txt': ('blackhansans/OFL.txt', 'c324192c8b3a988bae45a9a7e4ac1258b684739003bda114e0523423440457c9'),
    'IBMPlexSansKR-Medium.ttf': ('ibmplexsanskr/IBMPlexSansKR-Medium.ttf', '4a7130f56ce50bf10f9d383f624e50bad2c80bebc63e51f4269ece2c7d919166'),
    'OFL-IBMPlex.txt': ('ibmplexsanskr/OFL.txt', '7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da'),
    'IBMPlexSans-VF.ttf': ('ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf', '3b031aa4216174205bd8471f88a49b91f093169e9e87bd5262242bc5967fe2e3'),
}
# 내보낼 글꼴: (파일 이름 앞, CSS 글꼴 이름, 원본)
FONTS = [('BlackHanSans', 'Black Han Sans', 'BlackHanSans-Regular.ttf'), ('ChainmateSansKR-Medium', 'Chainmate Sans KR', 'IBMPlexSansKR-Medium.ttf')]
# 예약 이름을 쓰지 않는 새 이름(이름 표의 글꼴 이름 · 전체 이름 · PostScript 이름 · 고유 ID)
RENAME = {'IBMPlexSansKR': 'ChainmateSansKR', 'IBM Plex Sans KR': 'Chainmate Sans KR'}
RENAME_IDS = {1, 3, 4, 6, 16, 18, 21}
BORROW = '‹›'  # Plex KR에 없어 IBM Plex Sans에서 옮기는 글자
LICENSES = ['OFL-BlackHanSans.txt', 'OFL-IBMPlex.txt']


def fetch():
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    for name, (rel, sha) in SOURCES.items():
        p = SRC_DIR / name
        if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest() != sha:
            subprocess.run(['curl', '-sSfL', '-o', str(p), f'{BASE}/{rel}'], check=True)
        got = hashlib.sha256(p.read_bytes()).hexdigest()
        if got != sha:
            sys.exit(f'{name}: sha256이 다르다({got})')


def used_chars():
    paths = sorted((ROOT / 'src').rglob('*.js')) + [ROOT / f for f in FILES]
    out = set()
    for p in paths:
        out.update(ch for ch in p.read_text(encoding='utf-8') if ord(ch) >= 0x20)
    return out | {chr(c) for c in range(0x20, 0x7F)}


# IBM Plex Sans(가변)를 500 굵기 · 보통 폭으로 굳혀 BORROW 글자의 모양 · 폭을 Plex KR에 옮긴다(둘 다 1000 upem · TrueType)
def borrow(font):
    donor = instancer.instantiateVariableFont(TTFont(SRC_DIR / 'IBMPlexSans-VF.ttf'), {'wght': 500, 'wdth': 100})
    dcmap = donor.getBestCmap()
    order = list(font.getGlyphOrder())
    for ch in BORROW:
        src = dcmap[ord(ch)]
        g = donor['glyf'][src]
        if g.isComposite():
            sys.exit(f'{ch}: 겹 글리프는 옮기지 않는다')
        name = f'borrow.{src}'
        font['glyf'][name] = g
        font['hmtx'][name] = donor['hmtx'][src]
        order.append(name)
        for t in font['cmap'].tables:
            if t.isUnicode():
                t.cmap[ord(ch)] = name
    font.setGlyphOrder(order)
    font['glyf'].glyphOrder = order


# 고친 글꼴의 이름 표: 글꼴을 가리키는 이름에서 예약 이름을 뺀다(저작권 · 라이선스 줄은 그대로)
def rename(font):
    for rec in font['name'].names:
        if rec.nameID not in RENAME_IDS:
            continue
        v = rec.toUnicode()
        for a, b in RENAME.items():
            v = v.replace(a, b)
        if 'Plex' in v:
            sys.exit(f'이름 {rec.nameID}에 Plex가 남았다: {v}')
        rec.string = v


# 줄인 파일 곁의 알림(OFL 2항 · 3항: 라이선스를 함께 두고, 고친 것은 예약 이름을 쓰지 않는다)
README = '''Fonts in this folder are subsets made by tools/fonts.py. Both are licensed under the SIL Open Font License 1.1.

BlackHanSans.<hash>.woff2
  Black Han Sans, Copyright 2015 The Black Han Sans Project Authors. Unchanged except for subsetting.
  Source: https://github.com/google/fonts/blob/{commit}/ofl/blackhansans/BlackHanSans-Regular.ttf
  License: OFL-BlackHanSans.txt

ChainmateSansKR-Medium.<hash>.woff2  (font name: Chainmate Sans KR)
  Modified from IBM Plex Sans KR Medium, Copyright 2017 IBM Corp. with Reserved Font Name "Plex".
  Changes: subset to the characters the game uses; added the glyphs U+2039 and U+203A from IBM Plex Sans
  (weight 500, width 100); renamed so the modified font does not use the Reserved Font Name.
  Sources: https://github.com/google/fonts/blob/{commit}/ofl/ibmplexsanskr/IBMPlexSansKR-Medium.ttf
           https://github.com/google/fonts/blob/{commit}/ofl/ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf
  License: OFL-IBMPlex.txt
'''


def main():
    fetch()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    want = used_chars()
    fonts = {}
    have_all = {}
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    for stem, family, src in FONTS:
        font = TTFont(SRC_DIR / src, recalcTimestamp=False)
        if src.startswith('IBMPlexSansKR'):
            borrow(font)
            rename(font)
        have = {chr(c) for c in font.getBestCmap()}
        keep = want & have
        have_all[stem] = keep
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
        tmp = OUT_DIR / f'{stem}.tmp.woff2'
        subset.save_font(font, str(tmp), opts)
        data = tmp.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        out = OUT_DIR / f'{stem}.{digest[:8]}.woff2'
        for old in OUT_DIR.glob(f'{stem}.*.woff2'):
            if old != tmp and re.fullmatch(re.escape(stem) + r'\.[0-9a-f]{8}\.woff2', old.name):
                old.unlink()
        tmp.rename(out)
        rel = f'assets/fonts/{out.name}'
        fonts[rel] = {'family': family, 'sha256': digest, 'bytes': len(data), 'glyphs': len(keep)}
        css, n = re.subn(r'url\("assets/fonts/' + re.escape(stem) + r'(\.[0-9a-f]{8})?\.woff2"\)', f'url("{rel}")', css)
        if n != 1:
            sys.exit(f'style.css에서 {stem}의 @font-face를 하나 찾지 못했다({n}개)')
        print(f'{rel}: {len(keep)}자 {len(data)} B')
    # 라이선스 글은 줄 끝을 LF로(원본 OFL-IBMPlex.txt는 CRLF — 다시 돌려도 저장소 파일과 같은 바이트)
    for lic in LICENSES:
        (OUT_DIR / lic).write_bytes((SRC_DIR / lic).read_bytes().replace(b'\r\n', b'\n'))
    (OUT_DIR / 'README.txt').write_text(README.format(commit=COMMIT), encoding='utf-8')
    (ROOT / 'style.css').write_text(css, encoding='utf-8')
    # 덮은 글자 = 보통 글(Plex KR) 파일에 든 글자. 굵은 글은 없는 글자를 Plex KR로 넘긴다
    covered = have_all['ChainmateSansKR-Medium']
    absent = want - covered
    glyphs = {
        'fonts': fonts,
        'covered': ''.join(sorted(covered)),
        'boldFallback': ''.join(sorted(covered - have_all['BlackHanSans'])),
        'missingInSource': ''.join(sorted(absent)),
    }
    (ROOT / 'tools' / 'fonts' / 'glyphs.json').write_text(json.dumps(glyphs, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'덮은 글자 {len(covered)} · 굵은 글이 Plex KR로 넘기는 글자 {len(glyphs["boldFallback"])} · 원본에 없는 글자 {len(absent)}: {glyphs["missingInSource"]}')
    print(f'합 {sum(f["bytes"] for f in fonts.values())} B')


main()
