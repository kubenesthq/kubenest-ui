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
Framework: React 18 + TypeScript
Build Tool: Vite
Routing: React Router v6
State Management: Zustand (simpler than Redux for MVP)
API Client: TanStack Query (React Query)
UI Components: shadcn/ui (Tailwind + Radix UI)
Forms: React Hook Form + Zod
Real-time: EventSource (SSE) for status updates
Styling: Tailwind CSS
Icons: Lucide React
```

**Why these choices for MVP?**
- Fast development
- Modern, type-safe
- Minimal boilerplate
- Great DX

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
│   ├── main.tsx             # App entry point
│   ├── App.tsx              # Main app component
│   ├── routes.tsx           # Route definitions
│   ├── api/                 # API client
│   │   ├── client.ts        # Axios/Fetch config
│   │   ├── auth.ts          # Auth endpoints
│   │   ├── clusters.ts      # Cluster endpoints
│   │   ├── projects.ts      # Project endpoints
│   │   └── workloads.ts     # Workload endpoints
│   ├── components/          # Reusable components
│   │   ├── ui/              # shadcn components
│   │   ├── Layout.tsx
│   │   ├── Navbar.tsx
│   │   └── StatusBadge.tsx
│   ├── pages/               # Page components
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── clusters/
│   │   │   ├── ClusterListPage.tsx
│   │   │   ├── ClusterDetailPage.tsx
│   │   │   └── NewClusterPage.tsx
│   │   ├── projects/
│   │   │   ├── ProjectDetailPage.tsx
│   │   │   └── NewProjectPage.tsx
│   │   └── workloads/
│   │       ├── WorkloadDetailPage.tsx
│   │       └── NewWorkloadPage.tsx
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
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
├── Dockerfile
└── README.md
```

## Quick Start

```bash
# Create project
npm create vite@latest kubenest-ui -- --template react-ts
cd kubenest-ui

# Install dependencies
npm install react-router-dom zustand @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react

# Setup shadcn/ui
npx shadcn-ui@latest init

# Start dev server
npm run dev
```

## Environment Configuration

```bash
# .env.development
VITE_API_URL=http://localhost:8000
VITE_SSE_URL=http://localhost:8000/api/v1/stream
```

```bash
# .env.production
VITE_API_URL=https://api.kubenest.io
VITE_SSE_URL=https://api.kubenest.io/api/v1/stream
```

## API Integration

### API Client Setup

```typescript
// src/api/client.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### React Query Setup

```typescript
// src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      retry: 1,
    },
  },
});

root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
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

// src/pages/workloads/WorkloadListPage.tsx
import { useWorkloads } from '../../hooks/useWorkloads';

export function WorkloadListPage({ projectId }: { projectId: string }) {
  const { data: workloads, isLoading, error } = useWorkloads(projectId);

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
import { useEffect, useState } from 'react';

export function useWorkloadStatus(workloadId: string) {
  const [status, setStatus] = useState<string>('unknown');

  useEffect(() => {
    const SSE_URL = import.meta.env.VITE_SSE_URL;
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
// src/pages/workloads/NewWorkloadPage.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';

const workloadSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  image: z.string().min(1),
  replicas: z.number().int().min(0).max(100).default(1),
  port: z.number().int().min(1).max(65535).optional(),
});

type WorkloadForm = z.infer<typeof workloadSchema>;

export function NewWorkloadPage({ projectId }: { projectId: string }) {
  const { register, handleSubmit, formState: { errors } } = useForm<WorkloadForm>({
    resolver: zodResolver(workloadSchema),
    defaultValues: { replicas: 1 },
  });

  const createMutation = useMutation({
    mutationFn: (data: WorkloadForm) => createWorkload(projectId, data),
    onSuccess: (workload) => {
      navigate(`/workloads/${workload.id}`);
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
- [ ] Setup Vite + React + TypeScript
- [ ] Setup Tailwind CSS
- [ ] Install shadcn/ui components
- [ ] Create basic layout (Navbar, Container)
- [ ] Build login page
- [ ] Build register page
- [ ] Setup auth store (Zustand)
- [ ] Setup API client with auth interceptors

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

  # React Router - serve index.html for all routes
  location / {
    try_files $uri $uri/ /index.html;
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
docker build -t kubenest-ui .

# Run
docker run -p 3000:80 \
  -e VITE_API_URL=https://api.kubenest.io \
  kubenest-ui
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
