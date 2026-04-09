# IU Ophth Comp Model — FY2026

Physician compensation calculator and RVU productivity optimizer for **IU Health Ophthalmology, Adult Division** (Metro Region Academic Medicine).

Built from the 2026 Compensation Plan document. Every value is traceable to the source document.

## What It Does

- **Compensation Calculator** — Input your wRVU, FTE, rank, call weeks, and see total comp with full component breakdown
- **Reverse Calculator** — Set a target income → get required wRVU and daily schedule
- **RVU Planner** — Bidirectional: set schedule → get wRVU, or set wRVU → get schedule
- **Session Planner** — Build your daily encounter mix code-by-code
- **CPT Database** — Ophthalmology codes with editable wRVU values
- **Charts** — Comp vs wRVU curve, waterfall, efficiency comparisons

## Key Parameters (from document)

| Parameter | Value |
|---|---|
| Overall Rate | $44.90/wRVU |
| Quality Adjustment | -5.0% |
| AI (Academic Incentive) | -4.0% |
| Dept RAO | -6.0% |
| **Net Physician Comp Rate** | **$38.39/wRVU** |
| Academic Rank (Assoc Prof) | $15,000 |
| Academic Rank (Professor) | $30,000 |
| General Call (full week) | $5,000 |
| Chair Lever Pool | 19% of Pool |

## Getting Started

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

Output goes to `dist/` — deploy anywhere (Vercel, Netlify, GitHub Pages, etc.).

## Deploy to Vercel

```bash
npx vercel
```

Or connect the GitHub repo to Vercel for automatic deploys.

## Tech Stack

- React 18
- Vite 6
- Pure CSS (no Tailwind dependency)
- Zero backend — all computation is client-side

## Disclaimer

This tool is for personal reference and contract evaluation only. All values are derived from the FY2026 compensation plan document and should be verified against the original. Not financial or legal advice.
