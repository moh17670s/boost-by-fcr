# Boost by FCR — boostbyfcr.se

Website rebuild for Boost by FC Rosengård. Umbraco 13 headless CMS + React frontends.

## Architecture

```
Umbraco 13 (headless)  →  Delivery API (JSON)  →  React frontends
```

## Monorepo Structure

```
apps/
  cms/            — Umbraco 13 CMS (P1: Marcus, P3: Robert)
  public-site/    — Public React SPA (P2: Anthony)
  locked-area/    — Locked Metodmaterial React SPA (P4: Mohand)
packages/
  shared-types/   — Shared TypeScript types (auto-generated from Umbraco)
.github/
  workflows/      — CI/CD pipelines
```

## Team

| Role | Person | Responsibility |
|------|--------|----------------|
| P1 | Marcus Karlsson | Umbraco 13 setup, document types, Delivery API, custom endpoints |
| P2 | Anthony Foran | Public React frontend, all pages, SEO, accessibility |
| P3 | Robert Czuchra (TL) | Umbraco backoffice customization, Anna's UX, training |
| P4 | Mohand | Locked area, Metodmaterial, CI/CD, deployment |

## Branch Strategy

- `main` — protected, requires PR review
- `develop` — integration branch
- `feature/pX-description` — individual feature branches

## PR Rules

- Every merge to `main` requires 1 approved review
- Review your own domain last — fresh eyes catch more
- Cross-cutting changes (shared-types, CI/CD) → Team Leader reviews

## Tech Stack

### Backend (apps/cms)
- .NET 8, Umbraco 13 (LTS), SQLite (dev), Azure SQL/Hetzner (prod)

### Frontend (apps/public-site, apps/locked-area)
- React 18, TypeScript 5, Vite, Tailwind CSS, shadcn/ui, TanStack Query

### Infrastructure
- GitHub Actions CI/CD, Azure or Hetzner hosting, Cloudflare DNS
