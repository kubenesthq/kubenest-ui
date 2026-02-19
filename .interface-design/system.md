# KubeNest UI — Design System

**Product:** Railway-style developer platform for deploying apps across Kubernetes clusters.

**Who:** Developers and platform engineers managing cluster infrastructure and workload deployments. They're in focused, task-oriented mode — checking status, deploying apps, debugging.

**Feel:** Operational precision. Linear meets Vercel — clean white surfaces, information-dense without clutter, state communicated instantly through color and motion.

---

## Palette

| Token | Value | Usage |
|-------|-------|-------|
| Primary | blue-600 (`#2563EB`) | Actions, active nav, CTA buttons |
| Active surface | blue-50 | Active nav item background |
| Active text | blue-700 | Active nav item text |
| Base | white | Sidebar, cards, page backgrounds |
| Page bg | zinc-50 | Main content area background |
| Border | zinc-100 | Sidebar border, card borders (`border-zinc-200`) |
| Text primary | zinc-900 | Headings, bold values |
| Text secondary | zinc-600 | Body text, nav items |
| Text muted | zinc-400–500 | Labels, subtitles, table headers |
| Status: healthy | emerald-600 / emerald-50 | Connected clusters, 0 degraded |
| Status: warning | amber-500 | Pending state |
| Status: error | red-500 / red-50 | Disconnected, error, needs attention |
| Icon accent: clusters | blue-600 / blue-50 | Cluster-related stat cards |
| Icon accent: nodes | violet-600 / violet-50 | Infrastructure/nodes stat cards |

---

## Typography

**Font:** Inter (system — already loaded in `app/layout.tsx`)

| Role | Classes |
|------|---------|
| Page heading | `text-3xl font-bold tracking-tight text-zinc-900` |
| Page subtitle | `text-sm text-zinc-500 mt-1` |
| Card title | `text-base font-semibold text-zinc-900` |
| Stat label | `text-xs font-medium uppercase tracking-wide text-zinc-400` |
| Stat value | `text-3xl font-bold tracking-tight text-zinc-900` |
| Stat subtitle | `text-xs text-zinc-400` |
| Table header | `text-xs font-medium uppercase tracking-wide text-zinc-400` |
| Body | `text-sm text-zinc-600` |
| Section label (sidebar) | `text-xs font-medium uppercase tracking-wide text-zinc-300` |

---

## Layout Shell

**Sidebar width:** `w-56` (224px), fixed left, `z-30`

**Content area:** `ml-56`, `bg-zinc-50`, `min-h-screen`

**Page content padding:** `px-8 py-8`, `max-w-5xl` for dashboard-style pages

### Sidebar structure

1. **Logo bar** — `h-14`, blue icon + "KubeNest" wordmark
2. **Nav items** — active: `bg-blue-50 text-blue-700 font-medium`, inactive: `text-zinc-600 hover:bg-zinc-50`
3. **Section labels** — `text-xs uppercase tracking-wide text-zinc-300 px-3 py-1`
4. **User footer** — avatar (initials, `bg-zinc-200`), name + email, sign out button

**Auth routes** (`/login`, `/register`) — no sidebar, full-width layout

---

## Cards

```
border-zinc-200
transition-all duration-300 hover:shadow-md hover:-translate-y-0.5
```

**Stat card layout:**
- Icon in tinted rounded container (`rounded-lg p-2.5 bg-{color}-50`)
- Label: uppercase tracking-wide muted text
- Value: `text-3xl font-bold tracking-tight`
- Subtitle: `text-xs text-zinc-400`

---

## Tables

```
TableHeader → bg-zinc-50/60 row
TableHead   → text-xs font-medium uppercase tracking-wide text-zinc-400
```

---

## Motion

All motion uses `framer-motion`. **Established patterns:**

### `fadeInUp`
```ts
initial: { opacity: 0, y: 20 }
animate: { opacity: 1, y: 0 }
transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] }
```
Use for: page sections, headers, cards on mount.

### Staggered list
```ts
// each item: delay: 0.1 + index * 0.08
```
Use for: stat cards, any list of 2–6 items.

### Row slide-in (table rows)
```ts
initial: { opacity: 0, x: -8 }
animate: { opacity: 1, x: 0 }
transition: { duration: 0.3, delay: index * 0.06, ease: [0.25, 1, 0.5, 1] }
whileHover: { x: 4 }
```
Pattern: `const MotionTableRow = motion(TableRow)` (wrap shadcn TableRow)

### Status pulse (ClusterStatusBadge pattern)
```ts
// connected: { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] } — heartbeat
// pending:   { opacity: [1, 0.35, 1] }                     — breathing
// disconnected: undefined                                   — static
```
Use for: any live status indicator dot.

---

## Component Sources

Always use approved libraries. Current usage:
- **shadcn/ui** — Card, Button, Badge, Table, Dialog, Input, Form, Toaster
- **framer-motion** — Entrance animations, status pulse, hover states
- **lucide-react** — Icons throughout

---

## Status Colors (semantic)

| State | Badge variant | Dot animation |
|-------|---------------|---------------|
| connected | `success` (green) | heartbeat (scale + opacity) |
| pending | `warning` (amber) | breathing (opacity only) |
| disconnected | `destructive` (red) | none (static) |
| error | `destructive` (red) | none (static) |

---

## Pages Built

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/dashboard` | Animated — stat cards + cluster list |
| Cluster list | embedded in dashboard | Animated rows + status badge |
| App shell | all auth routes | Sidebar + content layout |

## To Apply Next

Priority order per SKILL.md:
1. ~~Dashboard~~ ✓
2. Clusters detail (`/clusters/:id`) — add fadeInUp, table row animations
3. Projects detail (`/projects/:id`) — add entrance animations
4. Workloads detail (`/workloads/:id`) — status pulse, live SSE indicators
5. Login page — center-card layout, subtle entrance animation
