# Kubenest UI

Web interface for the Kubenest Kubernetes platform.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type check
npm run typecheck

# Lint
npm run lint
```

### Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SSE_URL=http://localhost:8000/api/v1/stream
```

## Project Structure

```
kubenest-ui/
├── app/                 # Next.js App Router pages
├── api/                 # API client functions
├── components/          # React components
│   └── ui/             # Base UI components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
├── store/              # Zustand stores
├── types/              # TypeScript types
└── public/             # Static assets
```

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- TanStack Query (data fetching)
- React Hook Form + Zod (forms)
- Radix UI (component primitives)
- Lucide React (icons)

## Features (In Development)

- User authentication
- Cluster management
- Project management
- Workload deployment
- Real-time status updates via SSE

## Related Repositories

- [kubenest-backend](https://github.com/kubenesthq/kubenest-backend) - REST API
- [kubenest-operator](https://github.com/kubenesthq/kubenest-operator) - Kubernetes Operator
- [kubenest-hub](https://github.com/kubenesthq/kubenest-hub) - WebSocket Hub
- [kubenest-contracts](https://github.com/kubenesthq/kubenest-contracts) - API Contracts
