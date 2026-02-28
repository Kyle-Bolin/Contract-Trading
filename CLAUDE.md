# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Next.js dev server on localhost:3000
npm run build            # Static export to out/
npm run lint             # ESLint (eslint-config-next)
npm run test             # Vitest - run all tests
npm run test:watch       # Vitest - watch mode
npx vitest run src/lib/clients/finnhub  # Run tests in a specific directory

# Infrastructure (separate project in infra/)
cd infra && npm install  # CDK deps are separate from root
cd infra && npx cdk synth   # Synthesize CloudFormation
cd infra && npx cdk diff    # Preview changes
cd infra && npx cdk deploy  # Deploy all stacks

# Docker
docker compose up app    # Production build (nginx on port 3000)
docker compose up dev    # Dev server with volume mount
```

## Architecture

This app tracks U.S. government contract awards and generates stock trading signals for the companies that win them.

### Two separate TypeScript projects

The root is a **Next.js 16 static export** (React 19, Tailwind CSS 4). The `infra/` directory is a standalone **AWS CDK** project with its own `package.json`, `tsconfig.json`, and `node_modules`. The root `tsconfig.json` explicitly excludes `infra/`, and ESLint ignores it too. These two projects must not cross-import.

### CDK stack dependency graph

```
NetworkStack (S3 + CloudFront)
NotificationStack (SNS topics)
AuthStack (Cognito + Google/Apple IdPs)
DataStack (DynamoDB × 5 tables)
    ↓
ApiStack (API Gateway + Lambda) ← depends on Auth, Data, Notification
SchedulerStack (EventBridge daily rule) ← depends on Notification
```

Stacks are wired via shared props interfaces in `infra/lib/shared-props.ts`. Cross-stack references pass concrete constructs (e.g., `userPool`, `tables`, `alertTopic`), not string ARNs.

### Data pipeline flow

1. **EventBridge** triggers a daily Lambda that polls USAspending.gov for new contract awards
2. Awards are stored in DynamoDB `ContractAwards` table, deduped by `awardId`
3. The **ticker-mapping service** resolves company names to stock tickers via 4-layer lookup: manual overrides → SEC EDGAR exact match → fuzzy match (90% threshold) → Finnhub API fallback
4. The **signal engine** generates buy/hold/neutral indicators based on award-to-market-cap ratio (thresholds configurable via env vars `SIGNAL_STRONG_RATIO_THRESHOLD`, `SIGNAL_MODERATE_RATIO_THRESHOLD`)
5. Awards matching user watchlists/filters trigger SNS email alerts

### DynamoDB tables (all PAY_PER_REQUEST)

| Table | PK | SK | Notable GSIs |
|-------|----|----|-------------|
| ContractAwards | awardId | awardDate | ByRecipient, ByTicker, ByNaics |
| Companies | companyName | — | — |
| UserWatchlists | userId | ticker | — |
| UserFilters | userId | filterId | — |
| Alerts | userId | alertTimestamp | ByAward (dedup), TTL on expiresAt |

TypeScript interfaces for all tables are in `src/types/models.ts`.

### API clients

Both clients are in `src/lib/clients/` and follow the same patterns: typed request/response shapes, retry with exponential backoff, rate limiting.

- **USAspending** (`usaspending/`): No auth required. Throttled to 2 req/sec. Async generator for pagination.
- **Finnhub** (`finnhub/`): Requires `FINNHUB_API_KEY` env var. Token bucket rate limiter at 60 req/min.

### Key conventions

- **Path alias**: `@/` maps to `src/` (configured in both `tsconfig.json` and `vitest.config.ts`)
- **Commits**: Conventional Commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.)
- **CI**: GitHub Actions via reusable workflows from `KotaHusky/cicd-toolkit`. Turbo runs build/lint/test.
- **Static export**: `next.config.ts` sets `output: 'export'` — no SSR, no API routes in Next.js. Backend is API Gateway + Lambda.
- **Cognito auth**: Google and Apple IdP secrets are in AWS Secrets Manager (not env vars). The CDK `AuthStack` has explicit `node.addDependency()` calls on IdP constructs to prevent race conditions.
- **Finnhub market cap**: Returned in millions USD. The signal engine multiplies by 1,000,000 before computing ratios.
