# OG boot video (drop-in)

**Currently installed:** `og-boot.webm` — the OG Xbox boot animation, supplied by
the operator. This is what the OG-mode intro plays.

The OG intro looks for these files, in the operator's chosen format:

    assets/video/og-boot.mp4      (used first if present)
    assets/video/og-boot.webm     (used if there is no mp4, or mp4 can't decode)

When one exists, the OG intro plays it fullscreen **with its own audio**
(respecting the site mute toggle) instead of the built-in animation. Press any
key / button (or click) to skip. If neither file is present — or none can be
decoded — the intro automatically falls back to the original animated boot
sequence (with the classic X mark).

### Replacing or removing the video
- **Replace:** overwrite `og-boot.webm` (or add an `og-boot.mp4`) with your own
  licensed file.
- **Remove:** delete the video file(s); the intro reverts to the animation.

Passle itself ships no footage of its own — any boot video here is operator-provided
and its use is the operator's rights decision.

Tips:
- Keep it short (a few seconds). H.264 mp4 plays everywhere; webm is smaller.
- To shrink/transcode: `ffmpeg -i source.webm -vf scale=1280:-2 -c:v libx264 -crf 23 -c:a aac -b:a 128k og-boot.mp4`

