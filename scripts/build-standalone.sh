#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STANDALONE_DIR="${ROOT_DIR}/standalone"
WEBDIST_DIR="${STANDALONE_DIR}/webdist"
RELEASE_DIR="${ROOT_DIR}/release"

SKIP_NPM_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-npm-build)
      SKIP_NPM_BUILD=1
      ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--skip-npm-build]" >&2
      exit 1
      ;;
  esac
done

# Locate Go binary (PATH or user-local ~/.local/opt/go or ~/.local/bin/go)
if command -v go >/dev/null 2>&1; then
  GO_BIN="$(command -v go)"
elif [ -x "${HOME}/.local/opt/go/bin/go" ]; then
  GO_BIN="${HOME}/.local/opt/go/bin/go"
elif [ -x "${HOME}/.local/bin/go" ]; then
  GO_BIN="${HOME}/.local/bin/go"
else
  echo "Error: Go toolchain not found in PATH or ~/.local/opt/go/bin/go." >&2
  exit 1
fi

PKG_VERSION="$(node -e "const p=require('${ROOT_DIR}/package.json'); console.log(p.version);")"
GIT_SHORT="$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || echo 'nogit')"
APP_VERSION="${CHM_VERSION:-v${PKG_VERSION}-${GIT_SHORT}}"
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git -C "${ROOT_DIR}" log -1 --format=%ct 2>/dev/null || date -u +%s)}"

if [ "${SKIP_NPM_BUILD}" -eq 0 ]; then
  echo "[1/5] Building production web bundle (dist/)..."
  (cd "${ROOT_DIR}" && npm run build)
else
  echo "[1/5] Skipping npm run build (using existing dist/)..."
fi

if [ ! -f "${ROOT_DIR}/dist/index.html" ]; then
  echo "Error: dist/index.html not found. Run npm run build first." >&2
  exit 1
fi

# Back up tracked placeholder webdist/index.html and restore it on exit so working tree stays clean
ORIG_PLACEHOLDER="$(cat "${WEBDIST_DIR}/index.html")"
cleanup() {
  find "${WEBDIST_DIR}" -mindepth 1 ! -name '.gitignore' ! -name 'index.html' -exec rm -rf {} +
  printf '%s' "${ORIG_PLACEHOLDER}" > "${WEBDIST_DIR}/index.html"
}
trap cleanup EXIT

echo "[2/5] Staging production dist/ into standalone/webdist/..."
find "${WEBDIST_DIR}" -mindepth 1 ! -name '.gitignore' ! -name 'index.html' -exec rm -rf {} +
cp -R "${ROOT_DIR}/dist/." "${WEBDIST_DIR}/"
rm -f "${WEBDIST_DIR}/_headers" "${WEBDIST_DIR}/_redirects"

echo "[3/5] Running Go tests against staged webdist..."
(cd "${STANDALONE_DIR}" && "${GO_BIN}" test ./...)

mkdir -p "${RELEASE_DIR}"
LINUX_BIN="certified-handmade-linux-amd64"
WIN_BIN="certified-handmade-windows-amd64.exe"

echo "[4/5] Compiling portable standalone binaries (${APP_VERSION})..."
(
  cd "${STANDALONE_DIR}"
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "${GO_BIN}" build \
    -trimpath \
    -ldflags="-s -w -X main.appVersion=${APP_VERSION}" \
    -o "${RELEASE_DIR}/${LINUX_BIN}" \
    .

  CGO_ENABLED=0 GOOS=windows GOARCH=amd64 "${GO_BIN}" build \
    -trimpath \
    -ldflags="-s -w -X main.appVersion=${APP_VERSION}" \
    -o "${RELEASE_DIR}/${WIN_BIN}" \
    .
)

chmod +x "${RELEASE_DIR}/${LINUX_BIN}"

echo "[5/5] Creating reproducible release archives and SHA256SUMS.txt..."
LINUX_STAGE="${RELEASE_DIR}/stage-linux"
WIN_STAGE="${RELEASE_DIR}/stage-windows"
rm -rf "${LINUX_STAGE}" "${WIN_STAGE}"
mkdir -p "${LINUX_STAGE}" "${WIN_STAGE}"

cp "${RELEASE_DIR}/${LINUX_BIN}" "${LINUX_STAGE}/"
cp "${STANDALONE_DIR}/README-STANDALONE.txt" "${LINUX_STAGE}/"
cp "${STANDALONE_DIR}/certified-handmade-standalone.desktop" "${LINUX_STAGE}/"
cp "${ROOT_DIR}/LICENSE" "${LINUX_STAGE}/"
cp "${ROOT_DIR}/SPEC.md" "${LINUX_STAGE}/"

cp "${RELEASE_DIR}/${WIN_BIN}" "${WIN_STAGE}/"
cp "${STANDALONE_DIR}/README-STANDALONE.txt" "${WIN_STAGE}/"
cp "${ROOT_DIR}/LICENSE" "${WIN_STAGE}/"
cp "${ROOT_DIR}/SPEC.md" "${WIN_STAGE}/"

LINUX_TAR="certified-handmade-standalone-${APP_VERSION}-linux-amd64.tar.gz"
WIN_ZIP="certified-handmade-standalone-${APP_VERSION}-windows-amd64.zip"

tar \
  --sort=name \
  --mtime="@${SOURCE_DATE_EPOCH}" \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -C "${LINUX_STAGE}" \
  -czf "${RELEASE_DIR}/${LINUX_TAR}" \
  .

python3 - "${WIN_STAGE}" "${RELEASE_DIR}/${WIN_ZIP}" "${SOURCE_DATE_EPOCH}" <<'PY'
import os
import sys
import time
import zipfile

stage_dir, out_zip, epoch_str = sys.argv[1], sys.argv[2], sys.argv[3]
epoch = max(315532800, int(epoch_str)) # ZIP epoch minimum 1980-01-01
dt = time.gmtime(epoch)[:6]

files = []
for root, _, names in os.walk(stage_dir):
    for name in sorted(names):
        full = os.path.join(root, name)
        rel = os.path.relpath(full, stage_dir).replace(os.sep, '/')
        files.append((rel, full))
files.sort()

with zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for rel, full in files:
        zi = zipfile.ZipInfo(rel, date_time=dt)
        zi.create_system = 0
        zi.external_attr = (0o755 if rel.endswith('.exe') else 0o644) << 16
        with open(full, 'rb') as f:
            zf.writestr(zi, f.read())
PY

rm -rf "${LINUX_STAGE}" "${WIN_STAGE}"

(
  cd "${RELEASE_DIR}"
  sha256sum "${LINUX_BIN}" "${WIN_BIN}" "${LINUX_TAR}" "${WIN_ZIP}" > SHA256SUMS.txt
)

echo "Standalone build complete in ${RELEASE_DIR}:"
ls -lh "${RELEASE_DIR}"
cat "${RELEASE_DIR}/SHA256SUMS.txt"
