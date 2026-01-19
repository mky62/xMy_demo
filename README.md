# xMy — Anonymous Ephemeral Chat

xMy is a **real-time anonymous chat application** where conversations self-destruct and no data is persisted.

## System Architecture

- **Anonymous by design** — no accounts, no registration
- **Ephemeral rooms** — auto-destruct after inactivity
- **No message persistence** — conversations exist only in memory
- **Server-authoritative state** — all validation and ownership handled server-side

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS
- **Backend:** Node.js + Express + WebSocket (ws)
- **Deployment:** Vercel (static frontend + WebSocket server)

## Quick Start

```bash
# Install dependencies
npm install

# Run both client and server
npm run dev

# Or run individually
npm run client  # http://localhost:5173
npm run server  # ws://localhost:8080
```

## Development Phases

See [PHASES.md](./PHASES.md) for detailed development roadmap and security hardening plan.

## Deployment

Configure Vercel with:
- Root Directory: `/`
- Framework Preset: `Other`
- Build Command: `cd client && npm install && npm run build`
- Output Directory: `client/dist`

## Security & Privacy

- No user data persistence
- Room-based isolation
- Server-side authority enforcement
- Ephemeral identity via sessionIds

## License

MIT
