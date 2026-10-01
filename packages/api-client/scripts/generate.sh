#!/usr/bin/env bash
# Regenerates src/gen from the node API (cryptos-node/proto) and the fleet API
# (cryptos-manager/proto) at the commits pinned in proto-refs.env. Run it
# through `npm run generate`, which puts the pinned protoc-gen-es on PATH.
#
# CRYPTOS_NODE_PROTO_DIR / CRYPTOS_MANAGER_PROTO_DIR point at a local proto/
# directory instead, for trying an unmerged proto change.
set -euo pipefail

pkg="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=/dev/null
source "$pkg/proto-refs.env"

protos="$pkg/.protos"
rm -rf "$protos" "$pkg/src/gen"
mkdir -p "$protos/cryptos-node" "$protos/cryptos-manager"

fetch() {
  local repo="$1" ref="$2" local_dir="$3" dest="$4"
  if [[ -n "$local_dir" ]]; then
    echo "proto: $repo from $local_dir"
    cp -R "$local_dir/." "$dest/"
    return
  fi
  echo "proto: $repo at $ref"
  curl -sSfL "https://codeload.github.com/CryptOS-PKI/$repo/tar.gz/$ref" |
    tar -xz -C "$dest" --strip-components=2 --wildcards '*/proto/*'
}

fetch cryptos-node "$CRYPTOS_NODE_REF" "${CRYPTOS_NODE_PROTO_DIR:-}" "$protos/cryptos-node"
fetch cryptos-manager "$CRYPTOS_MANAGER_REF" "${CRYPTOS_MANAGER_PROTO_DIR:-}" "$protos/cryptos-manager"

cd "$pkg"
buf generate
