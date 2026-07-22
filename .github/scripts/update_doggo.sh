#!/usr/bin/env bash

set -Eeuo pipefail

REPO="mr-karan/doggo"
MAKEFILE="doggo/Makefile"

echo "Checking doggo release..."

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

wget -q \
    "https://codeload.github.com/mr-karan/doggo/tar.gz/v${LATEST}" \
    -O "$TMPDIR/code.tar.gz"

PKG_HASH=$(sha256sum "$TMPDIR/code.tar.gz" | awk '{print $1}')

sed -i \
    "s/^PKG_VERSION:=.*/PKG_VERSION:=${LATEST}/" \
    "$MAKEFILE"

sed -i \
    "s/^PKG_HASH:=.*/PKG_HASH:=${PKG_HASH}/" \
    "$MAKEFILE"

echo "doggo updated to ${LATEST}"