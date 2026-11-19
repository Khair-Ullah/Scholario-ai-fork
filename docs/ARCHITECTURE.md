# Architecture

The target system uses a Next.js App Router client, a FastAPI JSON API, and a SQLAlchemy-managed relational database. Docker Compose runs PostgreSQL 16; `DATABASE_URL` selects the database (SQLite remains only for the isolated pytest suite).

`frontend/src/app` owns routes and layouts. `frontend/src/components` contains reusable interface elements. `backend/app/routers` owns HTTP contracts; `services` owns matching, imports, documents, AI, and payments; `models` and `db` own persistence. CSV ingestion is an explicit script and admin workflow.

## High-level summary

```mermaid
flowchart LR
  Student[Student browser] --> Web[Next.js frontend]
  Web --> API[FastAPI]
  API --> DB[(PostgreSQL 16)]
  API --> AI[AI provider adapter]
  API --> Pay[Payment provider adapter]
  API --> Mail[Email provider]
  Admin[Admin browser] --> Web
```

## Current system diagrams

Rendered diagrams are stored in [`diagrams/`](diagrams/) as both PNG and SVG, with editable Mermaid sources in `*.mmd`. Each diagram below shows the rendered image; the Mermaid source is in the collapsible block for editing.

### 1. Runtime and deployment topology

![Runtime and deployment topology](diagrams/runtime-topology.png)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart LR
  B["Browser<br/>localhost:3000"]

  subgraph HOST["Windows host - Docker Desktop / WSL2"]
    subgraph FE["frontend container<br/>node:22-alpine - Next.js 16 - :3000"]
      FEAPP["src/app<br/>App Router pages"]
      FEPROXY["proxy.ts middleware<br/>route guards"]
      FEAPI["lib/api.ts<br/>CSRF + refresh-on-401"]
    end

    subgraph BE["backend container<br/>python:3.12-slim - FastAPI - :8000"]
      BEMAIN["app/main.py<br/>CSRF - rate limit - headers - CORS"]
      BEROUTERS["app/routers/*<br/>API contracts"]
      BESVC["app/services/*<br/>matching - ai - import - audit"]
      BEDB["SQLAlchemy 2 + Alembic"]
    end

    DB[("PostgreSQL 16<br/>named volume: pgdata")]
    VFE["volumes: bind ./frontend<br/>+ node_modules + .next"]
    VBE["volumes: bind ./backend<br/>+ /data"]
  end

  EXT["External adapters<br/>AI: mock or Gemini<br/>Payments / Email (planned)"]

  B -->|HTTP| FEAPP
  FEAPP --- FEPROXY --- FEAPI
  FEAPI -->|"/api/* rewrite to http://backend:8000/api/*"| BEMAIN
  BEMAIN --> BEROUTERS --> BESVC --> BEDB --> DB
  BESVC --> EXT
  VFE -.-> FE
  VBE -.-> BE
```

</details>

### 2. Layered application architecture

![Layered application architecture](diagrams/layered-architecture.png)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TB
  subgraph CLIENT["CLIENT - Next.js App Router"]
    direction LR
    UI["Pages and layouts<br/>src/app/**"]
    COMP["Shared components<br/>AppShell + admin/components"]
    STORE["State<br/>Zustand + React Query"]
    CAPI["lib/api.ts<br/>CSRF + refresh + expiry redirect"]
  end

  subgraph SERVER["SERVER - FastAPI"]
    MW["Middleware<br/>CSRF - rate limit - headers - CORS"]
    RT["Routers<br/>auth - scholarships - student_data<br/>documents - ai - billing - admin - consultant"]
    SVC["Services<br/>matching - gpa - csv_import - export<br/>entitlements - settings - audit - auth_guard"]
    AI["AI registry<br/>Mock or Gemini"]
    SCH["Pydantic schemas"]
    ORM["SQLAlchemy models"]
  end

  subgraph DATA["DATA"]
    DB[("PostgreSQL 16")]
    MIG["Alembic migrations"]
    FILES[("Uploads / documents<br/>DATA_DIR")]
  end

  UI --> CAPI --> MW --> RT --> SVC
  RT --> SCH
  SVC --> ORM --> DB
  MIG --> DB
  SVC --> AI
  SVC --> FILES
  UI --- COMP
  UI --- STORE
```

</details>

### 3. Authentication, session, and CSRF flow

![Authentication session and CSRF flow](diagrams/auth-session-flow.png)

<details>
<summary>Mermaid source</summary>

```mermaid
sequenceDiagram
  actor U as User
  participant FE as Next.js client
  participant MW as proxy.ts
  participant API as FastAPI
  participant DB as Database

  U->>FE: open /dashboard
  FE->>MW: request
  alt no access_token cookie
    MW-->>U: redirect /login?next=/dashboard
  else cookie present
    MW-->>FE: allow
  end

  U->>FE: login with email + password (+ TOTP)
  FE->>API: POST /api/auth/login (CSRF header)
  API->>DB: verify bcrypt hash + check lockout
  API->>DB: store refresh token hash + issue access JWT
  API-->>FE: Set-Cookie access + refresh + csrftoken
  FE-->>U: dashboard

  FE->>API: API call with credentials + X-CSRF-Token
  API->>API: CSRF -> rate limit -> auth deps
  API->>DB: check jti denylist + token_version + active
  alt access token expired (401)
    FE->>API: POST /api/auth/refresh
    API-->>FE: new access cookie
    FE->>API: retry original request
  end

  U->>FE: logout
  FE->>API: POST /api/auth/logout
  API->>DB: revoke refresh + deny access jti
```

</details>

### 4. Scholarship matching flow

![Scholarship matching flow](diagrams/matching-request-flow.png)

<details>
<summary>Mermaid source</summary>

```mermaid
sequenceDiagram
  actor S as Student
  participant FE as Next.js
  participant API as /api/scholarships/match
  participant M as matching service
  participant DB as Database

  S->>FE: profile / filters
  FE->>API: POST /match
  API->>DB: load profile + active scholarships
  API->>M: match_scholarships(candidates, profile)
  Note over M: normalize level<br/>GPA to g4 then gpa_cap<br/>IELTS cap = min(ielts, gpa)<br/>filter level + tier + country + field
  M-->>API: eligible list ranked by<br/>selection ratio then deadline then funding
  API-->>FE: results + facets
  FE-->>S: ranked scholarships
```

</details>

### 5. Data model (core entities)

![Data model core entities](diagrams/data-model.png)

<details>
<summary>Mermaid source</summary>

```mermaid
erDiagram
  USERS ||--o| PROFILES : has
  USERS ||--o{ SAVED_SCHOLARSHIPS : saves
  SCHOLARSHIPS ||--o{ SAVED_SCHOLARSHIPS : appears_in
  USERS ||--o{ APPLICATIONS : tracks
  SCHOLARSHIPS ||--o{ APPLICATIONS : receives
  USERS ||--o{ CHECKLIST_ITEMS : owns
  USERS ||--o{ DOCUMENTS : owns
  TEMPLATES ||--o{ DOCUMENTS : starts_from
  DOCUMENTS ||--o{ DOCUMENT_VERSIONS : versions
  USERS ||--o{ CHAT_SESSIONS : starts
  CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ REFRESH_TOKENS : has
  USERS ||--o{ REVOKED_ACCESS_TOKENS : revokes
  USERS ||--o{ AUTH_ATTEMPTS : produces
  USERS ||--o{ SCHOLARSHIPS : owns
  USERS ||--o{ CONSULTANT_WARNINGS : receives
  USERS ||--o{ AUDIT_LOGS : acts
```

</details>

### 6. Roles and access map

![Roles and access map](diagrams/roles-access.png)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart LR
  STU["student"]
  CON["consultant"]
  ADM["super_admin"]

  STU --> S1["Student workspace<br/>/dashboard /onboarding<br/>/scholarships /saved /tracker<br/>/checklist /profile /templates<br/>/advisor /sop-reviewer<br/>/visa-travel /notifications<br/>/referral /billing"]
  CON --> C1["Consultant portal<br/>/consultant dashboards<br/>owned scholarships<br/>applicants<br/>warnings<br/>profile"]
  ADM --> A1["Admin panel<br/>/admin catalogue /users<br/>/consultants /templates<br/>/payments /settings<br/>/audit /warnings<br/>/data-quality"]
```

</details>

## Component responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Routes and layouts | `frontend/src/app` | Student, admin, and consultant pages plus route groups |
| Route guards | `frontend/src/proxy.ts` | Cookie-based redirects for protected, admin, and consultant routes |
| API client | `frontend/src/lib/api.ts` | CSRF header, refresh-on-401, session-expiry redirect |
| HTTP contracts | `backend/app/routers` | Validation and response shapes for every `/api/*` route |
| Business logic | `backend/app/services` | Matching, GPA, CSV import/export, entitlements, settings, audit, auth guard |
| AI | `backend/app/services/ai` | Provider registry with mock and Gemini adapters |
| Persistence | `backend/app/models`, `backend/app/db` | SQLAlchemy 2 models and session management |
| Schema evolution | `backend/alembic` | Versioned migrations run on backend startup |

Core entities: users have one profile; profiles match scholarships; users save scholarships and create applications/checklist items; documents belong to users and may reference templates and scholarships; chat sessions own messages; payments and audit records retain operational history. Scholarship IDs come from the source CSV and duplicate titles are valid. See [DATABASE.md](DATABASE.md) for role and ownership details.

## Match request flow

The API loads the authenticated student's profile, normalizes GPA, computes IELTS and GPA tier caps, filters active scholarships by level/tier and optional destination/field, then ranks and paginates the eligible set. Funding preferences and optional preferences are never exclusion filters. The detailed implementation is specified in [MATCHING_LOGIC.md](MATCHING_LOGIC.md).

## Regenerating diagrams

Each `docs/diagrams/*.mmd` file is the editable source for the matching `*.png` and `*.svg`. After editing a source, re-render it with any Mermaid CLI or a hosted renderer, then commit the updated image alongside the source.
