#!/usr/bin/env bash

set -Eeuo pipefail

echo "Updating submodules..."

git submodule sync --recursive

git submodule update \
    --init \
    --remote \
    --recursive

echo "Submodule update finished"