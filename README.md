# valeriogalano.it

![GitHub Pages Status](https://github.com/valeriogalano/valeriogalano.it/actions/workflows/hugo.yml/badge.svg)

## Local development
`$ hugo server -D`

## Smoke tests

Run static smoke checks against the built `public/` output:

```
bash scripts/smoke_public.sh
```

Optionally build then check (requires Hugo installed):

```
bash scripts/smoke_public.sh --build
```
