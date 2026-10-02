#!/bin/sh
# 앱에 넣을 정적 파일을 desktop/dist에 모은다. 게임은 저장소 루트의 파일 그대로(빌드 없음).
# docs · tools · test · node_modules는 넣지 않는다. 어느 폴더에서 불러도 된다.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
dist="$here/dist"
rm -rf "$dist"
mkdir -p "$dist"
cp "$root/index.html" "$root/style.css" "$root/manifest.webmanifest" "$dist/"
rsync -a --exclude '.DS_Store' "$root/src" "$root/assets" "$dist/"
# 앱 판: 사람 판 기록(CHM-50)에 남길 커밋 해시를 모은 사본에만 적는다(저장소의 src/version.js는 null 그대로)
commit=$(git -C "$root" rev-parse --short HEAD 2>/dev/null || true)
if [ -n "$commit" ]; then sed -i.bak "s/COMMIT = null/COMMIT = '$commit'/" "$dist/src/version.js" && rm -f "$dist/src/version.js.bak"; fi
echo "모음: $dist ($(find "$dist" -type f | wc -l | tr -d ' ')개 파일)"
