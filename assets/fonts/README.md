# OG Xbox dashboard font

The original Xbox (2001) dashboard used Microsoft's custom **Convection**
typeface. It is **not** freely redistributable, so it is intentionally **not**
committed to this (public) repo.

## To use the real font

If you have the Convection font (e.g. installed on your machine via Microsoft
brand resources), it is picked up automatically — the CSS uses
`local("Convection")` first.

To bundle it for everyone on your own machine without installing, drop a web
font here (these filenames are git-ignored so they will never be committed):

```
assets/fonts/convection.woff2
assets/fonts/convection.woff
assets/fonts/convection.ttf
```

## Fallback

When Convection is unavailable, the site falls back to **Chakra Petch**
(SIL Open Font License, loaded from Google Fonts) — the closest freely
redistributable match to Convection's squared, chamfered letterforms.
