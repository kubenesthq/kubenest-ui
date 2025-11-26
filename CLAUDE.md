# CLAUDE.md - Kubenest UI

## 🎯 PRIORITY: Build Minimal Viable Product First!

**Current Focus**: Simple, functional UI to demonstrate end-to-end workflow.

## Component Overview

The Kubenest UI is the web interface for the Kubenest platform. Users interact with clusters, projects, and workloads through this interface.

## Related Repositories

- **kubenest-backend**: REST API backend (https://github.com/kubenesthq/kubenest-backend)
- **kubenest-operator**: Kubernetes operator (https://github.com/kubenesthq/kubenest-operator)
- **kubenest-hub**: WebSocket message broker (https://github.com/kubenesthq/kubenest-hub)
- **kubenest-contracts**: API schemas and types (https://github.com/kubenesthq/kubenest-contracts)

## Technology Stack (Recommended)

```yaml
Framework: Next.js 14+ (App Router) + TypeScript
Routing: File-based routing (built-in)
Rendering: Server Components + Client Components
State Management: Zustand (simpler than Redux for MVP)
API Client: TanStack Query (React Query)
UI Components: shadcn/ui (Tailwind + Radix UI)
Forms: React Hook Form + Zod
Real-time: EventSource (SSE) for status updates
Styling: Tailwind CSS
Icons: Lucide React
```

**Why Next.js for MVP?**
- Fast development with App Router
- Server-side rendering for better performance
- Built-in routing and optimization
- Modern, type-safe
- Minimal boilerplate
- Great DX with TypeScript

## MVP User Journey

1. **Login/Register** → User authenticates
2. **Dashboard** → See list of clusters
3. **Register Cluster** → Add a new cluster, get install command
4. **View Cluster** → See cluster status and projects
5. **Create Project** → Create new project in cluster
6. **View Project** → See workloads in project
7. **Deploy Workload** → Deploy a container image
8. **Monitor Status** → Watch real-time deployment status

## MVP Pages

### 1. Auth Pages
- `/login` - Login form
- `/register` - Registration form

### 2. Dashboard
- `/` - Cluster list, "Add Cluster" button

### 3. Cluster Pages
- `/clusters/:id` - Cluster detail, project list
- `/clusters/new` - Register new cluster form

### 4. Project Pages
- `/clusters/:clusterId/projects/new` - Create project form
- `/projects/:id` - Project detail, workload list

### 5. Workload Pages
- `/projects/:projectId/workloads/new` - Deploy workload form
- `/workloads/:id` - Workload detail with live status

## Project Structure

```
kubenest-ui/
├── public/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Dashboard (/)
│   │   ├── login/
│   │   │   └── page.tsx     # Login page
│   │   ├── register/
│   │   │   └── page.tsx     # Register page
│   │   ├── clusters/
│   │   │   ├── page.tsx     # Cluster list
│   │   │   ├── new/
│   │   │   │   └── page.tsx # New cluster
│   │   │   └── [id]/
│   │   │       ├── page.tsx # Cluster detail
│   │   │       └── projects/
│   │   │           └── new/
│   │   │               └── page.tsx # New project
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── page.tsx # Project detail
│   │   │       └── workloads/
│   │   │           └── new/
│   │   │               └── page.tsx # New workload
│   │   └── workloads/
│   │       └── [id]/
│   │           └── page.tsx # Workload detail
│   ├── api/                 # API client
│   │   ├── client.ts        # Fetch config
│   │   ├── auth.ts          # Auth endpoints
│   │   ├── clusters.ts      # Cluster endpoints
│   │   ├── projects.ts      # Project endpoints
│   │   └── workloads.ts     # Workload endpoints
│   ├── components/          # Reusable components
│   │   ├── ui/              # shadcn components
│   │   ├── Layout.tsx
│   │   ├── Navbar.tsx
│   │   └── StatusBadge.tsx
│   ├── hooks/               # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useClusters.ts
│   │   ├── useProjects.ts
│   │   ├── useWorkloads.ts
│   │   └── useSSE.ts        # For real-time updates
│   ├── store/               # Zustand stores
│   │   └── authStore.ts
│   ├── types/               # TypeScript types
│   │   └── api.ts           # Generated from contracts
│   └── lib/
│       └── utils.ts
├── .env.example
├── .env.development
├── .env.production
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── Dockerfile
└── README.md
```

## Quick Start

```bash
# Create Next.js project
npx create-next-app@latest kubenest-ui --typescript --tailwind --app --no-src-dir
cd kubenest-ui

# Install dependencies
npm install zustand @tanstack/react-query
npm install lucide-react

# Setup shadcn/ui
npx shadcn@latest init

# Start dev server
npm run dev
```

## Environment Configuration

```bash
# .env.local (for development)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SSE_URL=http://localhost:8000/api/v1/stream
```

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.kubenest.io
NEXT_PUBLIC_SSE_URL=https://api.kubenest.io/api/v1/stream
```

## API Integration

### API Client Setup

```typescript
// src/api/client.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}/api/v1${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Handle auth errors
  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  get: (url: string) => fetchWithAuth(url),
  post: (url: string, data: any) =>
    fetchWithAuth(url, { method: 'POST', body: JSON.stringify(data) }),
  patch: (url: string, data: any) =>
    fetchWithAuth(url, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (url: string) =>
    fetchWithAuth(url, { method: 'DELETE' }),
};
```

### React Query Setup

```typescript
// src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000, // 30 seconds
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// src/app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### Example: Workload List

```typescript
// src/hooks/useWorkloads.ts
import { useQuery } from '@tanstack/react-query';
import { getWorkloads } from '../api/workloads';

export function useWorkloads(projectId: string) {
  return useQuery({
    queryKey: ['workloads', projectId],
    queryFn: () => getWorkloads(projectId),
    enabled: !!projectId,
  });
}

// src/api/workloads.ts
import { apiClient } from './client';
import type { Workload } from '../types/api';

export async function getWorkloads(projectId: string): Promise<Workload[]> {
  const { data } = await apiClient.get(`/projects/${projectId}/workloads`);
  return data;
}

// src/app/projects/[id]/page.tsx
'use client';

import { useWorkloads } from '@/hooks/useWorkloads';

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { data: workloads, isLoading, error } = useWorkloads(params.id);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading workloads</div>;

  return (
    <div>
      <h1>Workloads</h1>
      {workloads?.map(workload => (
        <WorkloadCard key={workload.id} workload={workload} />
      ))}
    </div>
  );
}
```

## Real-time Status Updates (SSE)

```typescript
// src/hooks/useSSE.ts
'use client';

import { useEffect, useState } from 'react';

export function useWorkloadStatus(workloadId: string) {
  const [status, setStatus] = useState<string>('unknown');

  useEffect(() => {
    const SSE_URL = process.env.NEXT_PUBLIC_SSE_URL;
    const eventSource = new EventSource(
      `${SSE_URL}/workloads/${workloadId}`,
      { withCredentials: true }
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus(data.phase);
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [workloadId]);

  return status;
}

// Usage in component
'use client';

function WorkloadStatus({ workloadId }: { workloadId: string }) {
  const status = useWorkloadStatus(workloadId);

  return (
    <StatusBadge status={status}>
      {status}
    </StatusBadge>
  );
}
```

## Key Components

### 1. Status Badge

```tsx
// src/components/StatusBadge.tsx
import { Badge } from '@/components/ui/badge';

type Status = 'Pending' | 'Deploying' | 'Running' | 'Failed' | 'Degraded';

const statusColors: Record<Status, string> = {
  Pending: 'bg-gray-500',
  Deploying: 'bg-blue-500',
  Running: 'bg-green-500',
  Failed: 'bg-red-500',
  Degraded: 'bg-yellow-500',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge className={statusColors[status]}>
      {status}
    </Badge>
  );
}
```

### 2. Deploy Workload Form

```tsx
// src/app/projects/[id]/workloads/new/page.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

const workloadSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  image: z.string().min(1),
  replicas: z.number().int().min(0).max(100).default(1),
  port: z.number().int().min(1).max(65535).optional(),
});

type WorkloadForm = z.infer<typeof workloadSchema>;

export default function NewWorkloadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<WorkloadForm>({
    resolver: zodResolver(workloadSchema),
    defaultValues: { replicas: 1 },
  });

  const createMutation = useMutation({
    mutationFn: (data: WorkloadForm) => createWorkload(params.id, data),
    onSuccess: (workload) => {
      router.push(`/workloads/${workload.id}`);
    },
  });

  const onSubmit = (data: WorkloadForm) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register('name')}
        placeholder="my-app"
        error={errors.name?.message}
      />
      <Input
        {...register('image')}
        placeholder="nginx:1.25"
        error={errors.image?.message}
      />
      <Input
        type="number"
        {...register('replicas', { valueAsNumber: true })}
        error={errors.replicas?.message}
      />
      <Button type="submit" loading={createMutation.isPending}>
        Deploy
      </Button>
    </form>
  );
}
```

## MVP Implementation Checklist

### Week 1: Foundation & Auth
- [ ] Setup Next.js 14+ with App Router + TypeScript
- [ ] Setup Tailwind CSS (included in setup)
- [ ] Install shadcn/ui components
- [ ] Create root layout with Navbar
- [ ] Build login page (app/login/page.tsx)
- [ ] Build register page (app/register/page.tsx)
- [ ] Setup auth store (Zustand)
- [ ] Setup API client with auth
- [ ] Setup React Query provider

### Week 2: Core Features
- [ ] Dashboard page (cluster list)
- [ ] Register cluster page + copy install command
- [ ] Cluster detail page (project list)
- [ ] Create project form
- [ ] Project detail page (workload list)
- [ ] Deploy workload form
- [ ] Workload detail page

### Week 3: Real-time Updates
- [ ] SSE hook for workload status
- [ ] Live status updates on workload detail page
- [ ] Polling fallback if SSE fails
- [ ] Loading states
- [ ] Error handling

### Week 4: Polish
- [ ] Responsive design
- [ ] Form validation
- [ ] Empty states
- [ ] Error pages (404, 500)
- [ ] Docker build
- [ ] Demo preparation

## Defer to Post-MVP

- ❌ Dark mode
- ❌ Multi-language support
- ❌ Advanced filtering/search
- ❌ Bulk operations
- ❌ User settings
- ❌ Team management
- ❌ RBAC UI
- ❌ Metrics/charts
- ❌ Logs viewer
- ❌ Shell access
- ❌ Resource limits UI
- ❌ Addon management
- ❌ Stack deployment UI

## TypeScript Types

Generate from contracts:

```bash
# In contracts repo
npm install -g openapi-typescript

# Generate types
npx openapi-typescript api/openapi.yaml -o ../kubenest-ui/src/types/api.ts
```

Then use in UI:

```typescript
import type { Workload, WorkloadCreate } from '@/types/api';
```

## Deployment

### Docker

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Next.js static export - serve files
  location / {
    try_files $uri $uri/ $uri.html /index.html;
  }

  # Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

### Build & Run

```bash
# Build
docker build -t kubenest-ui \
  --build-arg NEXT_PUBLIC_API_URL=https://api.kubenest.io \
  --build-arg NEXT_PUBLIC_SSE_URL=https://api.kubenest.io/api/v1/stream \
  .

# Run
docker run -p 3000:80 kubenest-ui
```

## Success Criteria

✅ User can register and login
✅ User can add a cluster (shows install command)
✅ User can create a project
✅ User can deploy a workload
✅ User sees real-time status updates
✅ All forms have validation
✅ Mobile-responsive
✅ Fast page load (< 2s)
✅ TypeScript with no `any` types
✅ Accessible (keyboard navigation, ARIA labels)

---

**REMEMBER**: Keep it simple! A working MVP is better than a perfect design that never ships.

## Example Flow

1. User visits `http://localhost:3000`
2. Redirected to `/login`
3. Registers → `/register`
4. Logs in → redirected to `/` (dashboard)
5. Clicks "Add Cluster" → `/clusters/new`
6. Enters cluster name → gets `kubectl apply` command
7. Copies command, runs in terminal
8. Operator connects, cluster shows "Connected"
9. Clicks cluster → `/clusters/:id`
10. Clicks "Create Project" → `/clusters/:id/projects/new`
11. Enters project name → project created
12. Clicks "Deploy Workload" → `/projects/:id/workloads/new`
13. Enters image `nginx:1.25`, replicas `2`
14. Submits → redirected to `/workloads/:id`
15. Status shows: Pending → Deploying → Running ✅
16. User celebrates! 🎉

# Claude Code Configuration - SPARC Development Environment

## 🚨 CRITICAL: CONCURRENT EXECUTION & FILE MANAGEMENT

**ABSOLUTE RULES**:
1. ALL operations MUST be concurrent/parallel in a single message
2. **NEVER save working files, text/mds and tests to the root folder**
3. ALWAYS organize files in appropriate subdirectories
4. **USE CLAUDE CODE'S TASK TOOL** for spawning agents concurrently, not just MCP

### ⚡ GOLDEN RULE: "1 MESSAGE = ALL RELATED OPERATIONS"

**MANDATORY PATTERNS:**
- **TodoWrite**: ALWAYS batch ALL todos in ONE call (5-10+ todos minimum)
- **Task tool (Claude Code)**: ALWAYS spawn ALL agents in ONE message with full instructions
- **File operations**: ALWAYS batch ALL reads/writes/edits in ONE message
- **Bash commands**: ALWAYS batch ALL terminal operations in ONE message
- **Memory operations**: ALWAYS batch ALL memory store/retrieve in ONE message

### 🎯 CRITICAL: Claude Code Task Tool for Agent Execution

**Claude Code's Task tool is the PRIMARY way to spawn agents:**
```javascript
// ✅ CORRECT: Use Claude Code's Task tool for parallel agent execution
[Single Message]:
  Task("Research agent", "Analyze requirements and patterns...", "researcher")
  Task("Coder agent", "Implement core features...", "coder")
  Task("Tester agent", "Create comprehensive tests...", "tester")
  Task("Reviewer agent", "Review code quality...", "reviewer")
  Task("Architect agent", "Design system architecture...", "system-architect")
```

**MCP tools are ONLY for coordination setup:**
- `mcp__claude-flow__swarm_init` - Initialize coordination topology
- `mcp__claude-flow__agent_spawn` - Define agent types for coordination
- `mcp__claude-flow__task_orchestrate` - Orchestrate high-level workflows

### 📁 File Organization Rules

**NEVER save to root folder. Use these directories:**
- `/src` - Source code files
- `/tests` - Test files
- `/docs` - Documentation and markdown files
- `/config` - Configuration files
- `/scripts` - Utility scripts
- `/examples` - Example code

## Project Overview

This project uses SPARC (Specification, Pseudocode, Architecture, Refinement, Completion) methodology with Claude-Flow orchestration for systematic Test-Driven Development.

## SPARC Commands

### Core Commands
- `npx claude-flow sparc modes` - List available modes
- `npx claude-flow sparc run <mode> "<task>"` - Execute specific mode
- `npx claude-flow sparc tdd "<feature>"` - Run complete TDD workflow
- `npx claude-flow sparc info <mode>` - Get mode details

### Batchtools Commands
- `npx claude-flow sparc batch <modes> "<task>"` - Parallel execution
- `npx claude-flow sparc pipeline "<task>"` - Full pipeline processing
- `npx claude-flow sparc concurrent <mode> "<tasks-file>"` - Multi-task processing

### Build Commands
- `npm run build` - Build project
- `npm run test` - Run tests
- `npm run lint` - Linting
- `npm run typecheck` - Type checking

## SPARC Workflow Phases

1. **Specification** - Requirements analysis (`sparc run spec-pseudocode`)
2. **Pseudocode** - Algorithm design (`sparc run spec-pseudocode`)
3. **Architecture** - System design (`sparc run architect`)
4. **Refinement** - TDD implementation (`sparc tdd`)
5. **Completion** - Integration (`sparc run integration`)

## Code Style & Best Practices

- **Modular Design**: Files under 500 lines
- **Environment Safety**: Never hardcode secrets
- **Test-First**: Write tests before implementation
- **Clean Architecture**: Separate concerns
- **Documentation**: Keep updated

## 🚀 Available Agents (54 Total)

### Core Development
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Swarm Coordination
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### Consensus & Distributed
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### Performance & Optimization
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub & Repository
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC Methodology
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### Specialized Development
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### Testing & Validation
`tdd-london-swarm`, `production-validator`

### Migration & Planning
`migration-planner`, `swarm-init`

## 🎯 Claude Code vs MCP Tools

### Claude Code Handles ALL EXECUTION:
- **Task tool**: Spawn and run agents concurrently for actual work
- File operations (Read, Write, Edit, MultiEdit, Glob, Grep)
- Code generation and programming
- Bash commands and system operations
- Implementation work
- Project navigation and analysis
- TodoWrite and task management
- Git operations
- Package management
- Testing and debugging

### MCP Tools ONLY COORDINATE:
- Swarm initialization (topology setup)
- Agent type definitions (coordination patterns)
- Task orchestration (high-level planning)
- Memory management
- Neural features
- Performance tracking
- GitHub integration

**KEY**: MCP coordinates the strategy, Claude Code's Task tool executes with real agents.

## 🚀 Quick Setup

```bash
# Add MCP servers (Claude Flow required, others optional)
claude mcp add claude-flow npx claude-flow@alpha mcp start
claude mcp add ruv-swarm npx ruv-swarm mcp start  # Optional: Enhanced coordination
claude mcp add flow-nexus npx flow-nexus@latest mcp start  # Optional: Cloud features
```

## MCP Tool Categories

### Coordination
`swarm_init`, `agent_spawn`, `task_orchestrate`

### Monitoring
`swarm_status`, `agent_list`, `agent_metrics`, `task_status`, `task_results`

### Memory & Neural
`memory_usage`, `neural_status`, `neural_train`, `neural_patterns`

### GitHub Integration
`github_swarm`, `repo_analyze`, `pr_enhance`, `issue_triage`, `code_review`

### System
`benchmark_run`, `features_detect`, `swarm_monitor`

### Flow-Nexus MCP Tools (Optional Advanced Features)
Flow-Nexus extends MCP capabilities with 70+ cloud-based orchestration tools:

**Key MCP Tool Categories:**
- **Swarm & Agents**: `swarm_init`, `swarm_scale`, `agent_spawn`, `task_orchestrate`
- **Sandboxes**: `sandbox_create`, `sandbox_execute`, `sandbox_upload` (cloud execution)
- **Templates**: `template_list`, `template_deploy` (pre-built project templates)
- **Neural AI**: `neural_train`, `neural_patterns`, `seraphina_chat` (AI assistant)
- **GitHub**: `github_repo_analyze`, `github_pr_manage` (repository management)
- **Real-time**: `execution_stream_subscribe`, `realtime_subscribe` (live monitoring)
- **Storage**: `storage_upload`, `storage_list` (cloud file management)

**Authentication Required:**
- Register: `mcp__flow-nexus__user_register` or `npx flow-nexus@latest register`
- Login: `mcp__flow-nexus__user_login` or `npx flow-nexus@latest login`
- Access 70+ specialized MCP tools for advanced orchestration

## 🚀 Agent Execution Flow with Claude Code

### The Correct Pattern:

1. **Optional**: Use MCP tools to set up coordination topology
2. **REQUIRED**: Use Claude Code's Task tool to spawn agents that do actual work
3. **REQUIRED**: Each agent runs hooks for coordination
4. **REQUIRED**: Batch all operations in single messages

### Example Full-Stack Development:

```javascript
// Single message with all agent spawning via Claude Code's Task tool
[Parallel Agent Execution]:
  Task("Backend Developer", "Build REST API with Express. Use hooks for coordination.", "backend-dev")
  Task("Frontend Developer", "Create React UI. Coordinate with backend via memory.", "coder")
  Task("Database Architect", "Design PostgreSQL schema. Store schema in memory.", "code-analyzer")
  Task("Test Engineer", "Write Jest tests. Check memory for API contracts.", "tester")
  Task("DevOps Engineer", "Setup Docker and CI/CD. Document in memory.", "cicd-engineer")
  Task("Security Auditor", "Review authentication. Report findings via hooks.", "reviewer")

  // All todos batched together
  TodoWrite { todos: [...8-10 todos...] }

  // All file operations together
  Write "backend/server.js"
  Write "frontend/App.jsx"
  Write "database/schema.sql"
```

## 📋 Agent Coordination Protocol

### Every Agent Spawned via Task Tool MUST:

**1️⃣ BEFORE Work:**
```bash
npx claude-flow@alpha hooks pre-task --description "[task]"
npx claude-flow@alpha hooks session-restore --session-id "swarm-[id]"
```

**2️⃣ DURING Work:**
```bash
npx claude-flow@alpha hooks post-edit --file "[file]" --memory-key "swarm/[agent]/[step]"
npx claude-flow@alpha hooks notify --message "[what was done]"
```

**3️⃣ AFTER Work:**
```bash
npx claude-flow@alpha hooks post-task --task-id "[task]"
npx claude-flow@alpha hooks session-end --export-metrics true
```

## 🎯 Concurrent Execution Examples

### ✅ CORRECT WORKFLOW: MCP Coordinates, Claude Code Executes

```javascript
// Step 1: MCP tools set up coordination (optional, for complex tasks)
[Single Message - Coordination Setup]:
  mcp__claude-flow__swarm_init { topology: "mesh", maxAgents: 6 }
  mcp__claude-flow__agent_spawn { type: "researcher" }
  mcp__claude-flow__agent_spawn { type: "coder" }
  mcp__claude-flow__agent_spawn { type: "tester" }

// Step 2: Claude Code Task tool spawns ACTUAL agents that do the work
[Single Message - Parallel Agent Execution]:
  // Claude Code's Task tool spawns real agents concurrently
  Task("Research agent", "Analyze API requirements and best practices. Check memory for prior decisions.", "researcher")
  Task("Coder agent", "Implement REST endpoints with authentication. Coordinate via hooks.", "coder")
  Task("Database agent", "Design and implement database schema. Store decisions in memory.", "code-analyzer")
  Task("Tester agent", "Create comprehensive test suite with 90% coverage.", "tester")
  Task("Reviewer agent", "Review code quality and security. Document findings.", "reviewer")

  // Batch ALL todos in ONE call
  TodoWrite { todos: [
    {id: "1", content: "Research API patterns", status: "in_progress", priority: "high"},
    {id: "2", content: "Design database schema", status: "in_progress", priority: "high"},
    {id: "3", content: "Implement authentication", status: "pending", priority: "high"},
    {id: "4", content: "Build REST endpoints", status: "pending", priority: "high"},
    {id: "5", content: "Write unit tests", status: "pending", priority: "medium"},
    {id: "6", content: "Integration tests", status: "pending", priority: "medium"},
    {id: "7", content: "API documentation", status: "pending", priority: "low"},
    {id: "8", content: "Performance optimization", status: "pending", priority: "low"}
  ]}

  // Parallel file operations
  Bash "mkdir -p app/{src,tests,docs,config}"
  Write "app/package.json"
  Write "app/src/server.js"
  Write "app/tests/server.test.js"
  Write "app/docs/API.md"
```

### ❌ WRONG (Multiple Messages):
```javascript
Message 1: mcp__claude-flow__swarm_init
Message 2: Task("agent 1")
Message 3: TodoWrite { todos: [single todo] }
Message 4: Write "file.js"
// This breaks parallel coordination!
```

## Performance Benefits

- **84.8% SWE-Bench solve rate**
- **32.3% token reduction**
- **2.8-4.4x speed improvement**
- **27+ neural models**

## Hooks Integration

### Pre-Operation
- Auto-assign agents by file type
- Validate commands for safety
- Prepare resources automatically
- Optimize topology by complexity
- Cache searches

### Post-Operation
- Auto-format code
- Train neural patterns
- Update memory
- Analyze performance
- Track token usage

### Session Management
- Generate summaries
- Persist state
- Track metrics
- Restore context
- Export workflows

## Advanced Features (v2.0.0)

- 🚀 Automatic Topology Selection
- ⚡ Parallel Execution (2.8-4.4x speed)
- 🧠 Neural Training
- 📊 Bottleneck Analysis
- 🤖 Smart Auto-Spawning
- 🛡️ Self-Healing Workflows
- 💾 Cross-Session Memory
- 🔗 GitHub Integration

## Integration Tips

1. Start with basic swarm init
2. Scale agents gradually
3. Use memory for context
4. Monitor progress regularly
5. Train patterns from success
6. Enable hooks automation
7. Use GitHub tools first

## Support

- Documentation: https://github.com/ruvnet/claude-flow
- Issues: https://github.com/ruvnet/claude-flow/issues
- Flow-Nexus Platform: https://flow-nexus.ruv.io (registration required for cloud features)

---

Remember: **Claude Flow coordinates, Claude Code creates!**

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Never save working files, text/mds and tests to the root folder.
