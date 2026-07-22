#!/usr/bin/env bash

set -Eeuo pipefail

REPO="svenshi/oxidns"
MAKEFILE="oxidns/Makefile"

echo "Checking OxiDNS release..."

LATEST=$(gh release view \
    --repo "$REPO" \
    --json tagName \
    --jq '.tagName')

LATEST="${LATEST#v}"

if [[ -z "$LATEST" ]]; then
    echo "Failed to get latest version"
    exit 1
fi

CURRENT=$(grep '^PKG_VERSION:=' "$MAKEFILE" | cut -d= -f2)

echo "Current : $CURRENT"
echo "Latest  : $LATEST"

if [[ "$CURRENT" == "$LATEST" ]]; then
    echo "Already up to date"
    exit 0
fi

TMPDIR=$(mktemp -d)
cd "$TMPDIR"

gh release download "v${LATEST}" \
    --repo "$REPO" \
    --pattern "oxidns-x86_64-unknown-linux-gnu.tar.gz"

gh release download "v${LATEST}" \
    --repo "$REPO" \
    --pattern "oxidns-x86_64-unknown-linux-musl.tar.gz"

gh release download "v${LATEST}" \
    --repo "$REPO" \
    --pattern "oxidns-aarch64-unknown-linux-gnu.tar.gz"

gh release download "v${LATEST}" \
    --repo "$REPO" \
    --pattern "oxidns-aarch64-unknown-linux-musl.tar.gz"

HASH_X86_64_GLIBC=$(sha256sum oxidns-x86_64-unknown-linux-gnu.tar.gz | awk '{print $1}')
HASH_X86_64_MUSL=$(sha256sum oxidns-x86_64-unknown-linux-musl.tar.gz | awk '{print $1}')
HASH_AARCH64_GLIBC=$(sha256sum oxidns-aarch64-unknown-linux-gnu.tar.gz | awk '{print $1}')
HASH_AARCH64_MUSL=$(sha256sum oxidns-aarch64-unknown-linux-musl.tar.gz | awk '{print $1}')

cd "$GITHUB_WORKSPACE"

sed -i \
    "s/^PKG_VERSION:=.*/PKG_VERSION:=${LATEST}/" \
    "$MAKEFILE"

sed -i \
    "s/^PKG_HASH_X86_64_GLIBC:=.*/PKG_HASH_X86_64_GLIBC:=${HASH_X86_64_GLIBC}/" \
    "$MAKEFILE"

sed -i \
    "s/^PKG_HASH_X86_64_MUSL:=.*/PKG_HASH_X86_64_MUSL:=${HASH_X86_64_MUSL}/" \
    "$MAKEFILE"

sed -i \
    "s/^PKG_HASH_AARCH64_GLIBC:=.*/PKG_HASH_AARCH64_GLIBC:=${HASH_AARCH64_GLIBC}/" \
    "$MAKEFILE"

sed -i \
    "s/^PKG_HASH_AARCH64_MUSL:=.*/PKG_HASH_AARCH64_MUSL:=${HASH_AARCH64_MUSL}/" \
    "$MAKEFILE"

echo "OxiDNS updated to ${LATEST}"