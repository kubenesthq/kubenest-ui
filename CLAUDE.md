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
