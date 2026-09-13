#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Animate the imagegen artwork with a slow, seamless six-second breath.
# The single source frame produces 96 frames; phase zero is also the static
# reduced-motion cover. 640px is sufficient for both header and thumbnail use.
# Source prompt and provenance: docs/FAVORITES-ARTWORK.md.
"${MEDIA_FFMPEG_BIN:-ffmpeg}" -hide_banner -y \
  -i assets/images/favorites/heart-source.png \
  -vf "scale=1280:1280:flags=lanczos,zoompan=z='1.015-0.015*cos(2*PI*on/96)':x='iw/2-iw/zoom/2':y='ih*0.44-ih*0.44/zoom':d=96:s=640x640:fps=16" \
  -frames:v 96 -an -c:v libwebp_anim -quality 82 -compression_level 6 -loop 0 \
  assets/images/favorites/heart.webp

# A separate still also honors Reduce Motion in browsers, where an animated
# image cannot be paused reliably with an autoplay property alone.
"${MEDIA_FFMPEG_BIN:-ffmpeg}" -hide_banner -y \
  -i assets/images/favorites/heart-source.png -vf 'scale=640:640:flags=lanczos' \
  -frames:v 1 -c:v libwebp -quality 85 \
  assets/images/favorites/heart-still.webp
