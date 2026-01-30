# 🚀 Space Launch Tracker

Real-time space launch data agent powered by [SpaceDevs Launch Library 2](https://thespacedevs.com/llapi).

Built with the [Lucid Agents SDK](https://github.com/daydreamsai/lucid-agents) and monetized via [x402 protocol](https://x402.org).

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `overview` | **FREE** | Next 5 upcoming launches - try before you buy |
| `lookup` | $0.001 | Look up specific launch by ID or search term |
| `search` | $0.002 | Search launches by agency, rocket, or mission type |
| `upcoming` | $0.002 | Get launches within a time window (1-30 days) |
| `astronaut` | $0.003 | Look up astronaut by name (bio, stats, missions) |
| `report` | $0.005 | Comprehensive report: launches, events, agency stats |

## Data Source

All data is fetched in real-time from the SpaceDevs Launch Library 2 API:
- 370+ upcoming launches
- 853+ astronauts
- 348+ space agencies
- 34+ upcoming events

## Usage

### Try the free endpoint:
```bash
curl -X POST https://your-deployment.railway.app/entrypoints/overview/invoke \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Search for SpaceX launches:
```bash
curl -X POST https://your-deployment.railway.app/entrypoints/search/invoke \
  -H "Content-Type: application/json" \
  -d '{"agency": "SpaceX", "limit": 5}'
```

### Look up an astronaut:
```bash
curl -X POST https://your-deployment.railway.app/entrypoints/astronaut/invoke \
  -H "Content-Type: application/json" \
  -d '{"name": "Thomas Pesquet"}'
```

## Local Development

```bash
bun install
PAYMENTS_RECEIVABLE_ADDRESS=0xYourWallet \
FACILITATOR_URL=https://facilitator.daydreams.systems \
NETWORK=base \
bun run dev
```

## Deploy to Railway

```bash
railway login
railway init
railway variables set \
  PAYMENTS_RECEIVABLE_ADDRESS=0xYourWallet \
  FACILITATOR_URL=https://facilitator.daydreams.systems \
  NETWORK=base
railway up
```

## License

MIT
