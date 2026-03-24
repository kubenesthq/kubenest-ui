# KubeNest UI

Next.js web interface for KubeNest. Cluster management, project organization, and workload deployment with real-time status updates.

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Build & Deploy

```bash
npm run build
npm start
npm run typecheck
npm run lint
```

## Environment

Create `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SSE_URL=http://localhost:8000/api/v1/stream
```

## Project Structure

```
app/           - Next.js App Router pages
components/    - React components (UI + domain)
hooks/         - Custom hooks (useAuth, useClusters, useSSE)
api/           - API client functions
store/         - Zustand state management
types/         - TypeScript types
lib/           - Utilities (api-client, constants)
```

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | User login |
| `/register` | User registration |
| `/dashboard` | Main dashboard |
| `/clusters` | Cluster list |
| `/clusters/new` | Register cluster |
| `/clusters/:id` | Cluster details + projects |
| `/clusters/:id/projects/new` | Create project |
| `/projects/:id` | Project details + workloads |
| `/projects/:id/workloads/new` | Deploy workload |
| `/workloads/:id` | Workload status (live) |

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS + shadcn/ui
- Zustand (state)
- TanStack Query (data fetching)
- React Hook Form + Zod (forms)
- Lucide React (icons)

## Real-time Updates

Workload status streams via SSE using `hooks/useSSE.ts`. Connect to `/api/v1/stream` endpoint.

## Common Tasks

**Add new page:**
1. Create route in `app/`
2. Add API calls in `api/`
3. Create components in `components/`

**Add UI component:**
Use shadcn CLI: `npx shadcn-ui@latest add <component>`

## Related Repos

KubeNest is a multi-repo project under the `kubenesthq` GitHub org:

| Repo | Path | Language | Purpose |
|------|------|----------|---------|
| **kubenest-backend** | `~/sb/kubenest-backend` | Python/FastAPI | Control plane API |
| **kubenest-hub** | `~/sb/kubenest-hub` | Go | WebSocket message broker between backend and operators |
| **kubenest-operator** | `~/sb/op3` | Go | Kubernetes operator (CRDs, app lifecycle) |
| **kubenest-contracts** | `~/sb/kubenest-contracts` | JSON Schema/YAML | Shared schemas, event definitions, API contracts |
| **kubenest-ui** (this) | `~/sb/kubenest-ui` | React/Next.js | Frontend web application |
| **kubenest-helm** | `~/sb/kubenest-helm` | Helm | Deployment charts |
| **kubenest-docs** | `~/sb/kubenest-docs` | — | Documentation |
| **kubenest-gitops** | `~/sb/kubenest-gitops` | — | GitOps configurations |

**Dependency flow:** `contracts` → `operator`, `backend`, `hub`. Backend ↔ Hub ↔ Operator. UI → Backend (REST + SSE).

## Implementation Status

**Done:**
- Auth (login/register)
- Cluster management (list, detail, register)
- Project management (list, detail, create)
- Workload deployment (deploy, detail, scale)
- Real-time SSE status updates
- Form validation (React Hook Form + Zod)
- Error handling

**TODO:**
- Addon system (definitions, instances)
- Observability dashboard
- GitOps integration views
- Production deployment docs

<!-- WEDNESDAY_SKILLS_START -->
## Wednesday Agent Skills

This project uses Wednesday Solutions agent skills for consistent code quality and design standards.

### Available Skills

<available_skills>
  <skill>
    <name>wednesday-design</name>
    <description>Design and UX guidelines for Wednesday Solutions projects. Covers visual design tokens, animation patterns, component standards, accessibility, and user experience best practices for React/Next.js applications. ENFORCES use of approved component libraries only.</description>
    <location>.wednesday/skills/wednesday-design/SKILL.md</location>
  </skill>
  <skill>
    <name>wednesday-dev</name>
    <description>Technical development guidelines for Wednesday Solutions projects. Enforces import ordering, complexity limits, naming conventions, TypeScript best practices, and code quality standards for React/Next.js applications.</description>
    <location>.wednesday/skills/wednesday-dev/SKILL.md</location>
  </skill>
</available_skills>

### How to Use Skills

When working on tasks, check if a relevant skill is available above. To activate a skill, read its SKILL.md file to load the full instructions.

For example:
- For code quality and development guidelines, read: .wednesday/skills/wednesday-dev/SKILL.md
- For design and UI component guidelines, read: .wednesday/skills/wednesday-design/SKILL.md

### Important

- The wednesday-design skill contains 492+ approved UI components. Always check the component library before creating custom components.
- The wednesday-dev skill enforces import ordering, complexity limits (max 8), and naming conventions.

<!-- WEDNESDAY_SKILLS_END -->