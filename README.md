# merridashers

Single-page GitHub Pages site: a fullscreen, muted, randomly chosen background
video with a dark grunge treatment and a small logo in the bottom-right.

## Per-video tuning

Open [script.js](./script.js). The `videos` array near the top holds one entry
per file in `bg/`. Each entry has these effect multipliers, where `1` is the
default, `0` turns the effect off and `2` doubles it:

| Key | Controls |
| --- | --- |
| `shake` | handheld camera jitter |
| `cuts` | how often rips/tears fire, and the strength of the cut flashes |
| `grain` | moving film grain |
| `grime` | dust, scratches and dragged flecks |
| `blotches` | large dark patches of dirt |
| `stripes` | fast motion streaks and banding |

`luma` is the measured brightness of the source video and is used to keep every
clip at a consistent on-screen level; leave it unless replacing the video file.

Values fade in over ~1.2s as each clip crossfades into the next.

## Social sharing

The Open Graph / Twitter tags in [index.html](./index.html) point to
`https://merridashers.org/` and use [MD Text dark.png](./img/MD%20Text%20dark.png)
as the preview image — a version of the logo with the white lettering changed to
black so it stays visible against typical light social-media cards. If the site
moves to a different URL, update the absolute URLs in those tags.
