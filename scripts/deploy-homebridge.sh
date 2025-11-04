#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required but not found in PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH." >&2
  exit 1
fi

PACKAGE_NAME="$(node -p "require('./package.json').name")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"

echo "Packaging ${PACKAGE_NAME}@${PACKAGE_VERSION}..."
TARBALL="$(npm pack --silent)"
echo "Created ${TARBALL}"

HB_HOST="${HB_HOST:-homebridge.local}"
HB_USER="${HB_USER:-pi}"
HB_DEST="${HB_DEST:-/home/pi}"
HB_PASSWORD="${HB_PASSWORD:-raspberry}"

REMOTE="${HB_USER}@${HB_HOST}"
REMOTE_TARBALL="${HB_DEST}/${TARBALL}"

echo "Uploading ${TARBALL} to ${REMOTE}:${HB_DEST}"
if command -v sshpass >/dev/null 2>&1; then
  sshpass -p "${HB_PASSWORD}" scp "${TARBALL}" "${REMOTE}:${HB_DEST}/"
else
  scp "${TARBALL}" "${REMOTE}:${HB_DEST}/"
fi

echo "Cleaning up local tarball..."
rm -f "${TARBALL}"

echo "Uploaded ${TARBALL} to ${REMOTE_TARBALL}."
