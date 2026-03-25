# KubeNest Demo Script

All data is stored in localStorage — no backend needed.

## Flow

### 1. Register a Cluster
**Page:** `/clusters/new`

- Enter name (e.g. `production-us-east`) + description
- Hit Register → instantly shows as "connected" with 3 nodes, k8s v1.30.2
- Redirects to cluster detail

### 2. Create a Project
**Page:** `/clusters/{id}/projects/new`

- Enter project name (e.g. `my-saas-app`)
- Hit Create → redirects to project detail

### 3. Deploy a Workload
**Page:** `/projects/{id}/workloads/new`

- Pick **Container Image** (e.g. `nginx:latest`) or **Git Repository**
- Fill: name, replicas, port, env vars
- Hit Deploy → redirects to workload detail

### 4. Attach Addons
**Page:** `/demo-workloads/{id}`

- Click **Attach Addon** → pick PostgreSQL, Redis, MongoDB, RabbitMQ, Kafka, MySQL
- Each addon auto-wires env vars (e.g. `DATABASE_URL=postgres://app:secret@postgres:5432/appdb`)
- Can attach multiple

### 5. Save as Stack Template
**Page:** `/demo-workloads/{id}` (same page)

- Click **Save as Stack Template**
- Name it (e.g. "Node.js + PostgreSQL")
- Preview shows workload + addons + env vars captured
- Save → stored in localStorage

### 6. Browse Stack Templates
**Page:** `/settings/stack-templates`
**Sidebar:** Settings → Stack Templates

- Your saved templates appear under "Your Templates"
- Built-in templates (Node+PG, Rails+Redis+PG, Django, FastAPI, etc.) below
- Each has a **Deploy Stack** button

### 7. Deploy a Stack from Template
**Page:** `/stacks/deploy?template={id}`

- Configure variables (app name, db name, storage, etc.)
- Hit Deploy → saved as a deployed stack

### 8. View All Apps
**Page:** `/apps`
**Sidebar:** Apps

- **Workloads** table: all workloads across projects with source, addons, status
- **Stacks** table: all deployed stacks with template, components, status
- Click a workload or stack to open its detail page

### 9. App Detail Pages (Workload or Stack)
**Pages:** `/demo-workloads/{id}` or `/apps/stacks/{id}`

Each detail page has three tabs:
- **Info** — configuration, addons, environment variables, components
- **Logs** — live application logs (dummy data, dark terminal view)
- **Metrics** — CPU and memory bar charts over last 30 minutes (dummy data)

## Sidebar Navigation

- Dashboard
- **Apps** (workloads + stacks)
- Register Cluster
- Addon Catalog
- **Stack Templates** (under Settings)
- Teams, RBAC, SSO, Settings

## Resetting Demo Data

Open browser console and run:
```js
localStorage.removeItem('demo_clusters');
localStorage.removeItem('demo_projects');
localStorage.removeItem('demo_workloads');
localStorage.removeItem('demo_stack_templates');
localStorage.removeItem('demo_deployed_stacks');
```
