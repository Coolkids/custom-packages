#!/usr/bin/env bash

set -Eeuo pipefail

REPO_URL="https://github.com/Coolkids/custom-ruleset.git"
MAKEFILE="singbox-ruleset/Makefile"
PKG_NAME="singbox-ruleset"

echo "Checking custom-ruleset..."

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

SOURCE_DIR="$WORK_DIR/source"
git init -q "$SOURCE_DIR"
git -C "$SOURCE_DIR" remote add origin "$REPO_URL"
git -C "$SOURCE_DIR" fetch -q --depth=1 origin refs/heads/main
git -C "$SOURCE_DIR" checkout -q --detach FETCH_HEAD

LATEST_SHA="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
if [[ ! "$LATEST_SHA" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Failed to get the latest commit from $REPO_URL"
    exit 1
fi

SOURCE_EPOCH="$(git -C "$SOURCE_DIR" show -s --format=%ct HEAD)"
SOURCE_DATE="$(date -u -d "@$SOURCE_EPOCH" +%Y.%m.%d)"
LATEST_VERSION="${SOURCE_DATE}~${LATEST_SHA:0:8}"
SOURCE_SUBDIR="${PKG_NAME}-${LATEST_VERSION}"
SOURCE_FILE="${SOURCE_SUBDIR}.tar.gz"

# Match OpenWrt's git source archive generation so PKG_MIRROR_HASH is valid
# for PKG_SOURCE_PROTO:=git and a GitHub source URL.
git -C "$SOURCE_DIR" config core.abbrev 8
git -C "$SOURCE_DIR" archive --format=tar HEAD \
    --output="$WORK_DIR/${SOURCE_SUBDIR}.tar.git"

tar --numeric-owner --owner=0 --group=0 --ignore-failed-read \
    -C "$SOURCE_DIR" -f "$WORK_DIR/${SOURCE_SUBDIR}.tar.git" \
    -r .git .gitmodules 2>/dev/null

mkdir "$WORK_DIR/$SOURCE_SUBDIR"
tar -C "$WORK_DIR/$SOURCE_SUBDIR" -xf "$WORK_DIR/${SOURCE_SUBDIR}.tar.git"
(
    cd "$WORK_DIR/$SOURCE_SUBDIR"
    git submodule update --init --recursive
    rm -rf .git .gitmodules
)

(
    cd "$WORK_DIR"
    tar --numeric-owner --owner=0 --group=0 --mode=a-s --sort=name \
        --mtime="@$SOURCE_EPOCH" -c "$SOURCE_SUBDIR" |
        gzip -nc > "$SOURCE_FILE"
)

MIRROR_HASH="$(sha256sum "$WORK_DIR/$SOURCE_FILE" | awk '{ print $1 }')"
CURRENT_SHA="$(sed -n 's/^PKG_SOURCE_VERSION:=//p' "$MAKEFILE" | head -n 1)"
CURRENT_VERSION="$(sed -n 's/^PKG_VERSION:=//p' "$MAKEFILE" | head -n 1)"
CURRENT_HASH="$(sed -n 's/^PKG_MIRROR_HASH:=//p' "$MAKEFILE" | head -n 1)"

echo "Current version : $CURRENT_VERSION"
echo "Latest version  : $LATEST_VERSION"
echo "Current source  : $CURRENT_SHA"
echo "Latest source   : $LATEST_SHA"

if [[ "$CURRENT_SHA" == "$LATEST_SHA" && \
      "$CURRENT_VERSION" == "$LATEST_VERSION" && \
      "$CURRENT_HASH" == "$MIRROR_HASH" ]]; then
    echo "Already up to date"
    exit 0
fi

sed -i "s/^PKG_VERSION:=.*/PKG_VERSION:=${LATEST_VERSION}/" "$MAKEFILE"
sed -i "s/^PKG_SOURCE_VERSION:=.*/PKG_SOURCE_VERSION:=${LATEST_SHA}/" "$MAKEFILE"
sed -i "s/^PKG_MIRROR_HASH:=.*/PKG_MIRROR_HASH:=${MIRROR_HASH}/" "$MAKEFILE"

echo "singbox-ruleset updated to ${LATEST_VERSION} (${LATEST_SHA})"
