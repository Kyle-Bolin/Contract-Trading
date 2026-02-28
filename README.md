# Contract Trading

Track U.S. government contract awards and generate stock trading signals for publicly traded companies that win them.

## What It Does

- Polls [USAspending.gov](https://usaspending.gov) daily for new federal contract awards
- Maps winning companies to stock tickers (SEC EDGAR + fuzzy matching + Finnhub)
- Generates simple directional trading signals (buy/hold/neutral) based on award-to-market-cap ratio and contract pipeline momentum
- Sends email alerts via SNS when watchlist companies or filter criteria match new awards
- Dashboard for browsing awards, managing watchlists, and configuring alert filters

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Hosting | AWS S3 + CloudFront (static export) |
| Auth | Amazon Cognito (Google + Apple sign-in) |
| API | API Gateway + Lambda |
| Database | DynamoDB (5 tables, pay-per-request) |
| Notifications | SNS email alerts |
| Scheduling | EventBridge (daily polling) |
| Infrastructure | AWS CDK (TypeScript) |
| CI/CD | GitHub Actions via [cicd-toolkit](https://github.com/KotaHusky/cicd-toolkit) |
| Container | Docker (GHCR) |

## Project Structure

```
.
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components
│   ├── lib/
│   │   ├── clients/
│   │   │   ├── finnhub/        # Finnhub stock API client
│   │   │   └── usaspending/    # USAspending.gov API client
│   │   └── services/
│   │       ├── signal-engine/  # Trading signal generator
│   │       └── ticker-mapping/ # Company name -> stock ticker resolver
│   └── types/                  # Shared TypeScript types
├── infra/                      # AWS CDK infrastructure
│   ├── bin/                    # CDK app entry point
│   └── lib/                    # Stack definitions
│       ├── network-stack.ts    # S3 + CloudFront
│       ├── auth-stack.ts       # Cognito
│       ├── data-stack.ts       # DynamoDB tables
│       ├── api-stack.ts        # API Gateway + Lambda
│       ├── notification-stack.ts # SNS
│       └── scheduler-stack.ts  # EventBridge
└── .github/workflows/          # CI/CD pipelines
```

## Getting Started

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- AWS account with CDK bootstrapped
- Finnhub API key ([free tier](https://finnhub.io))

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build    # Static export to out/
npm run lint     # ESLint
npm run test     # Vitest (54 tests)
```

### Infrastructure

```bash
cd infra
npm install
npx cdk synth    # Synthesize CloudFormation templates
npx cdk deploy   # Deploy all stacks
```

### Docker

```bash
docker compose up app      # Production build on port 3000
docker compose up dev      # Dev server with hot reload
```

## Data Sources

| Source | Auth | Data Lag | Usage |
|--------|------|----------|-------|
| [USAspending.gov API](https://api.usaspending.gov) | None | 1-3 days | Contract awards, recipient/parent company data |
| [SEC EDGAR](https://www.sec.gov/files/company_tickers.json) | None | Static | Company name to ticker mapping |
| [Finnhub](https://finnhub.io) | API key (free) | Real-time | Stock quotes, symbol lookup, company profiles |

## Trading Signal

The signal engine generates a simple directional indicator based on:

1. **Award-to-Market-Cap Ratio** -- >5% strong, 1-5% moderate, <1% neutral
2. **Pipeline Momentum** -- trending award count over 30/60/90 days

> **Disclaimer:** This is an informational tool only and does not constitute financial advice. Past contract awards do not guarantee future stock performance.
