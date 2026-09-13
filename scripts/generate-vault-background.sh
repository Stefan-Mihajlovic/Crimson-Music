#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Grade the original video before encoding: deeper violet shadows and bright
# particle cores. Keep the existing 640x360 / 12 fps budget and seamless loop.
# Override MEDIA_FFMPEG_BIN when ffmpeg is not on PATH.
"${MEDIA_FFMPEG_BIN:-ffmpeg}" -hide_banner -y \
  -i assets/videos/TheVaultBg.mp4 \
  -an \
  -vf 'fps=12,scale=640:360:flags=lanczos,hue=h=-12:s=1.4,eq=contrast=1.22:brightness=-0.025:gamma=0.95' \
  -c:v libwebp_anim -quality 85 -compression_level 6 -loop 0 \
  assets/images/home/vault-background.webp
