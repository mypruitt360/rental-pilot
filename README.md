# Rental Pilot v0.3 — Buy Box

This build adds the first real Rental Pilot investing feature: **Buy Box**.

## New in v0.3
- Rental Pilot branding and Command Center
- Real Athens condo portfolio data for Units 140, 310 and 610
- August 2026 payment ledger seeded with the payments already reported
- One-click / quick payment modal
- Paid / due / partial balance status
- Income opportunity callout for vacancies
- Buy Box Analyzer that works backward to a maximum purchase price
- Buy / Negotiate / Pass recommendation based on your targets

## Buy Box logic
Rental Pilot calculates two maximum prices:
1. The maximum price supported by your target cap rate.
2. The maximum price supported by your target monthly cash flow after estimated debt service.

The recommended maximum purchase price is the lower of those two values.

## Run locally
```bash
npm install
npm run dev
```
Then open the localhost URL Vite shows.

## Build test
```bash
npm run build
```
