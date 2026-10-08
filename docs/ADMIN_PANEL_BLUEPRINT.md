# Scholario — Admin Panel Rebuild Blueprint

> **Purpose:** Single source of truth for the admin panel rebuild. If the machine dies mid-work, open this file, read §9 Resume Instructions, and continue from the first unchecked item.
>
> **Status legend:** `[ ]` pending · `[~]` in progress · `[x]` done · `[!]` blocked
>
> **Progress log is append-only** (§8). Never delete past entries.

---

## 1. Goal & Non-Goals

**Goal:** A complete, secure admin panel where one admin can manage the entire platform —
catalogue (9,338 scholarships), users/roles, data quality, document templates, announcements,
payments/plans, settings/feature flags, audit trail, and AI oversight — with security controls
(rate limiting, CSRF, server-side route guard, audit capture, self-lockout protection).

**Non-Goals (this build):**
- No visual re-theme. Admin uses the **same light teal palette as the student app** (decision AD-2). Dark/custom theme is deferred to a later scope.
- No real payment gateway integration (checkout remains `503 PAYMENTS_DISABLED`; only manual grants + transfer queue).
- No real LLM provider wiring (AI stays on `AI_PROVIDER=mock`; we only surface usage stats).
- No student-app changes beyond what CSRF client support and shared API helper require.

---

## 2. Current-State Audit (verified 2026-10-07)

### 2.1 What exists
| Area | Reality |
|---|---|
| Endpoints | 8 admin endpoints in `backend/app/routers/admin.py` (`stats`, `scholarships` list/PATCH/import-csv, `universities/unmapped` + country PATCH, `users` list/PATCH) + `POST /api/auth/admin/login` |
| Role enforcement | `require_admin` (`admin.py:18-23`) on all 8 handlers — ✅ correct, 403 + `X-Error-Code: AUTH_ADMIN_REQUIRED` |
| Role source | DB read per request (no role claim in JWT) — forgery-safe, instant revocation |
| Tests | `tests/test_admin.py` (111 L, 3 tests), `tests/test_auth.py` (admin login gates) |
| UI pages | `frontend/src/app/admin/{login,layout.tsx,dashboard,scholarships,data-quality,users}` — 4 content pages |
| Admin nav | 4 links only (`layout.tsx:17-22`) |

### 2.2 Gap list (spec §18 `SCHOLARIO_MASTER_PROMPT.md` has 9 pages; we have 4)
| # | Spec item | Status |
|---|---|---|
| 18.1 | Dashboard: real `new_today`, signups/day chart, top-10 saved, latest signups, AI calls, revenue | ❌ (`new_today` hardcoded 0 at `admin.py:48`, no charts) |
| 18.2 | Scholarships: full-row edit, sort, filters, bulk, CSV **export**, import **preview→confirm** | ❌ (4 editable fields, no sort/filter/bulk/export/dry-run) |
| 18.3 | Data quality: 4 queues (unmapped / no deadline / no URL / IELTS w/o band) | ❌ (only unmapped, 1 queue) |
| 18.4 | Users: detail drawer (profile, onboarding, activity), impersonate read-only, reset onboarding | ❌ (list + plan/active only) |
| 18.5 | Templates CRUD | ❌ (no endpoints) |
| 18.6 | Payments page (list, filter, refunds notes, manual grants, transfer approval) | ❌ |
| 18.7 | Announcements → broadcast notifications | ❌ |
| 18.8 | Settings: feature flags, free-tier limits, AI provider status | ❌ |
| 18.9 | Audit log viewer | ❌ (no capture either) |
| + | AI oversight (sessions, tokens) | ❌ |
| + | Role promote/demote | ❌ (`AdminUserPatch` has no `role`) |

### 2.3 Security findings
| Control | Status | Plan |
|---|---|---|
| `require_admin` on endpoints | ✅ present (8/8) | keep + cover new endpoints |
| Rate limiting | ❌ `slowapi` in requirements, never wired | M0.1 |
| CSRF token | ❌ none (only SameSite=Lax) | M0.2 double-submit |
| Audit log | ❌ zero capture | M0.3 |
| Self-lockout guard | ❌ admin can deactivate self | M0.4 |
| Last-admin protection | ❌ | M0.4 |
| Server-side admin route guard | ❌ client-side only, no `middleware.ts` | M0.5 |
| Security headers | ❌ | M0.6 |
| Input validation | ✅ Pydantic bounds, bleach on import | keep |
| Privilege escalation | ✅ none found (register can't set role) | keep |

---

## 3. Architecture Decisions

| ID | Decision | Rationale |
|---|---|---|
| **AD-1** | Shared session cookie for admin+student (same `access_token`/`refresh_token`), guarded by `require_admin` (API) + `middleware.ts` (routes) | Simplest model that gives defense-in-depth; separate cookie tenancy is over-engineering now. Admin login endpoint already enforces `admin_only`. |
| **AD-2** | **No re-theme.** Admin reuses existing light teal palette (`.admin-*` classes in `globals.css`) | User decision — avoid scope creep; theming comes later as its own scope. |
| **AD-3** | Rate limits via `slowapi`, keyed by client IP; tiers: `auth 5/min`, `admin-login 3/min`, `ai 20/min`, `general 60/min` | Spec §11 L477/504. 429 body follows error contract: `{detail, code:"RATE_LIMITED"}`. |
| **AD-4** | CSRF double-submit: `csrftoken` HttpOnly=false cookie + required `X-CSRF-Token` header on POST/PATCH/PUT/DELETE | Spec §20. GET/HEAD untouched. Exempt: none in browser flow; `api.ts` auto-attaches header from cookie. |
| **AD-5** | Audit capture = helper called explicitly in admin handlers (not a magic decorator) | Explicit = readable, easy to test, no import side effects. `services/audit.py::log_audit(db, actor, action, entity, entity_id, diff)`. |
| **AD-6** | New admin code lives in `backend/app/routers/admin.py` until it exceeds ~600 lines, then split into `routers/admin/` package (stats, scholarships, users, content, ops) | Keeps existing imports/tests stable during the build. |
| **AD-7** | Frontend: single typed client `src/admin/api.ts` + small primitives in `src/admin/components/` | Current pattern duplicates fetch logic per page (audit finding E). |
| **AD-8** | Blueprint checkboxes updated **as each item completes**, before the next starts | Guarantees resume-doc accuracy. |
| **AD-9** | Migration `0009_admin_foundation` adds exactly two new tables — `audit_logs` and `settings` (key/value); no existing-table changes | Keeps revert safe; settings storage was a late requirement (M1.8) folded into the same migration. |
| **AD-10** | Broadcast notifications are inserted in chunks of 500 with a single commit | 9k+ users ⇒ avoid one huge transaction / memory spike. |

---

## 4. Modules & Task Breakdown

### M0 — Security Foundation 🔒 (FIRST)

**M0.1 Rate limiting** `backend/app/core/ratelimit.py` (new), `backend/app/main.py`
- [x] Instantiate `Limiter(key_func=get_remote_address)` with storage (memory for dev; env-overridable)
- [x] Decorators: `@limiter.limit("5/minute")` on `/api/auth/login`, `/api/auth/register`
- [x] `@limiter.limit("3/minute")` on `/api/auth/admin/login`
- [x] `@limiter.limit("20/minute")` on `/api/ai/*` routes
- [x] `@limiter.limit("60/minute")` default on app
- [x] Custom 429 handler → `{detail: "...", code: "RATE_LIMITED"}` (matches `main.py:47-50` contract)
- [x] Tests: 6th login attempt → 429 `RATE_LIMITED`

**M0.2 CSRF double-submit** `backend/app/core/csrf.py` (new), `main.py`, `frontend/src/lib/api.ts`
- [x] `ensure_csrf_cookie` middleware: set `csrftoken` cookie (readable JS, SameSite=Lax, 30-min refresh) if absent
- [x] Middleware: for methods POST/PATCH/PUT/DELETE — compare `X-CSRF-Token` header vs cookie (hmac.compare_digest) → else 403 `CSRF_FAILED`
- [x] Exempt paths: none required (all browser flows carry cookies); health excluded by method (GET)
- [x] `api.ts`: read `csrftoken` cookie, attach header on every mutating request (incl. raw FormData upload path)
- [x] Tests: mutation without header → 403 `CSRF_FAILED`; with valid header → 200

**M0.3 Audit log** `backend/app/models/audit.py` (new), `backend/app/alembic/versions/0009_admin_foundation.py`, `backend/app/services/audit.py`
- [x] Model `AuditLog`: `id`, `actor_id` FK-users, `actor_email`, `action` (e.g. `scholarship.update`), `entity` (`scholarship|user|template|announcement|settings|payment|import|auth`), `entity_id` (str), `diff` JSON `{before, after}`, `ip`, `created_at` (indexed: `(created_at)`, `(actor_id)`, `(entity)`)
- [x] `log_audit(db, *, actor, action, entity, entity_id, before, after, ip)` — diff = only changed keys
- [x] Wire into every M0/M1 mutating admin handler (incl. login success/failed as `auth.login` / `auth.login_failed`)
- [x] Tests: PATCH scholarship → row exists with before/after

**M0.4 Lockout guards** `backend/app/routers/admin.py`
- [x] `PATCH /users/{id}`: 400 `SELF_LOCKOUT` if `id == actor.id` and (`is_active=false` or `role` changed away from admin)
- [x] Demote guard: if target is admin and new role != admin → count active admins; if 1 → 409 `LAST_ADMIN`
- [x] Tests: both guards + normal path still works

**M0.5 Frontend route guard** `frontend/src/middleware.ts` (new)
- [x] Matcher `["/admin/:path*"]` (exclude `/admin/login`)
- [x] No `access_token` cookie → redirect `/admin/login?next=...`
- [x] (Role can't be known server-side without JWT claim; API `require_admin` remains the authority — middleware is defense-in-depth for redirects only. Decision AD-1.)
- [x] Verify: curl `/admin/dashboard` without cookie → 307 to login

**M0.6 Security headers** `main.py` (or nginx example)
- [x] Response headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- [x] Tests: `/health` returns them

**M0.7 Tests** `backend/app/tests/test_security.py` (new)
- [x] rate limit 429, CSRF 403/200, security headers, self-lockout, last-admin, audit rows, student rejected on each new endpoint (pattern from `test_admin.py:66-73`)

> **M0 exit criteria:** `pytest` green, `ruff` clean, all M0 boxes `[x]`, blueprint §8 updated.

---

### M1 — Admin API Expansion

All under `require_admin` + audit capture (M0.3). Prefix `/api/admin`.

**M1.1 Stats v2** — `GET /stats`
- [x] Response: `{users, new_today, new_7d, pro_users, scholarships, active_scholarships, saved, applications, documents, ai_messages_7d, signups_by_day: [{date, count}] (30d), top_saved: [{scholarship_id, title, saves}] (10), latest_users: [{id,email,full_name,created_at}] (5)}`
- [x] Replace stub `new_today = 0` with real `date(created_at) == today` count

**M1.2 Scholarships**
- [x] `GET /scholarships` v2: add `total`, query `level`, `host_country`, `is_active`, `type`, `sort` (`deadline|title|host_country|created`), `order` — returns `{items, total, page, page_size}`
- [x] `PATCH /scholarships/{id}` extend `ScholarshipPatch`: `level`, `scholarship_type`, `ielts_required`, `ielts_band`, `ielts_tier`, `deadline_date`, `deadline_kind`, `fields_list`, `application_url`, `title`, `host_country`, `university_name`, `is_active`, `description_text`
- [x] `POST /scholarships` create (required: `title`, `university_name`, `host_country`, `level`; auto `search_text`, id = max+1 or uuid-safe int)
- [x] `DELETE /scholarships/{id}` (409 if saved/application references exist → `SCHOLARSHIP_IN_USE`)
- [x] `POST /scholarships/bulk` `{ids, action: activate|deactivate|delete}` with per-id results
- [x] `GET /scholarships/export-csv` → streamed CSV of current filters (all 53 cols from `source_data` + core cols), `Content-Disposition: attachment`
- [x] `POST /scholarships/import-csv?dry_run=1` → `{preview: first 20 cleaned rows, validation: {rows_read, errors[], warnings[], would_insert, would_update}}` without writing; without `dry_run` = current behavior + returns validation report too

**M1.3 Data quality** — `GET /data-quality` `{queue, items, total}` with `queue ∈ unmapped|missing_deadline|missing_url|ielts_missing_band`
- [x] `missing_deadline`: `deadline_kind == "unspecified"` + not in `source_data` … count + paginated items
- [x] `missing_url`: `application_url` null/empty
- [x] `ielts_missing_band`: `ielts_required` true and band null
- [x] Reuse `PATCH /universities/{name}/country` for unmapped fixes (existing)

**M1.4 Users**
- [x] `GET /users` v2: add `total`, `role`, `plan`, `is_active` filters; counts `{total, pro, disabled, admins}`
- [x] `GET /users/{id}` → `{user, profile, stats: {saved, applications, documents, notifications, chat_sessions, last_login_at}, sessions: [{id, created_at, expires_at, user_agent, ip, revoked}]}`
- [x] `PATCH /users/{id}` extend: `role` (`student|admin`) with AD guards (M0.4), `is_verified`
- [x] `POST /users/{id}/revoke-sessions` — revoke all refresh tokens
- [x] `POST /users/{id}/reset-onboarding` — `onboarding_completed=false`, `onboarding_step=1`
- [x] (Impersonation: **out of scope** — noted as non-goal; read-only detail drawer covers the need)

**M1.5 Templates** — `GET/POST /templates`, `GET/PATCH/DELETE /templates/{id}`
- [x] Fields: `slug, title, category, description, body_html, fields_json, recommended_word_range, tips, is_premium, is_active, sort_order`
- [x] Slug unique → 409 `SLUG_TAKEN`; DELETE blocked if documents reference → `TEMPLATE_IN_USE`
- [x] `POST /templates/{id}/reorder` `{sort_order}`

**M1.6 Announcements**
- [x] `POST /announcements` `{title, body, audience: all|pro|free, link?}` → chunked `Notification` insert (AD-10) + audit → `{delivered}`
- [x] `GET /announcements` — list past broadcasts (from audit + notification kinds); store announcement record in `diff` of audit OR new light model if needed → **use audit `entity=announcement`** for history (no new table, AD-9)

**M1.7 Payments (skeleton)**
- [x] `GET /payments` → plan summary from users (`free/pro counts, pro_expiring_soon`, disabled) + `POST /payments/grant` `{user_id, plan, expires_at?, note}` sets `plan` + `plan_expires_at` + audit; transfer approvals recorded as audit `payment.transfer_approved` with note (no dedicated payment table until real billing lands)
- [x] UI shows queue as "recorded via audit history" until payment model arrives (documented in page empty-state copy)

**M1.8 Settings**
- [x] `GET /settings` → `{ai_provider, flags: {registration_enabled, ai_enabled, announcements_enabled}, limits: {free_results, pro_results, free_documents}}`
- [x] `PATCH /settings` — persists to `settings` table (key/value JSON, created in migration `0009_admin_foundation` per AD-9)
- [x] Enforce `free_results` cap in matching service reads from settings (default 30 fallback)

**M1.9 Audit**
- [x] `GET /audit?actor=&action=&entity=&page=&page_size=` → `{items, total}`
- [x] Items include hydrated diff

**M1.10 AI oversight**
- [x] `GET /ai-stats` → `{sessions, messages_7d, tokens_total, by_provider, recent_sessions: [{id, user_email, title, messages, created_at}]}`
- [x] (Read-only; no chat mutation)

**M1 exit criteria:** every endpoint has happy-path + guard + audit tests; `docs/API.md` tables updated.

---

### M2 — Frontend Foundation

- [x] `frontend/src/admin/api.ts` — typed functions for **all** M0/M1 endpoints; uses shared `apiFetch` + attaches CSRF header (from M0.2); FormData path for import
- [x] `frontend/src/admin/components/`: `DataTable` (columns, sort, pagination, row select), `Drawer` (right-side, ESC/backdrop close), `ConfirmDialog`, `Toast` (context), `StatCard`, `EmptyState`, `Skeleton`, `PageHeader` (eyebrow + title + subtitle per existing tone)
- [x] `admin/layout.tsx` fixes: cache `/api/auth/me` (module-level promise — kill per-navigation flash), full nav (10 items with lucide icons), `/admin` root page redirecting to `/admin/dashboard`, breadcrumbs in topbar
- [x] `admin/page.tsx` → `redirect('/admin/dashboard')`
- [x] Reuse `.admin-*` classes; add missing CSS classes in `globals.css` **in the existing style** (AD-2 — no redesign)
- [x] Lint + build pass

### M3 — Pages (each: loading skeleton, empty state, error+retry, confirm before destructive)

- [x] **M3.1 Dashboard** — stat cards (incl. real `new_today`), signups/day line chart + top-saved bar chart (recharts), latest signups table, catalog health panel (link to data-quality)
- [x] **M3.2 Scholarships** — filters bar (level/country/active/type + search + sort), paginated DataTable with totals, row → edit Drawer (all columns), bulk select actions, Import Wizard modal (upload → dry-run preview 20 rows + validation report → confirm → result), Export CSV button (respects filters)
- [x] **M3.3 Users** — filters + totals chips, list → detail Drawer (profile, onboarding answers, activity stats, sessions, actions: plan, role guarded, active, verify, revoke sessions, reset onboarding) with ConfirmDialog
- [x] **M3.4 Data Quality** — 4 tabs with counts, per-queue tables, one-click fixes (unmapped: country select; missing URL: input; deadline: date picker; IELTS band: select)
- [x] **M3.5 Templates** — list + Drawer editor (body_html textarea, fields JSON with validation, tips, premium/active toggles, sort), delete guard, preview link
- [x] **M3.6 Announcements** — compose form (title/body/audience/link), delivered count on send, history table from audit
- [x] **M3.7 Payments** — plan summary cards, manual grant form (user search → plan → expiry → note), transfer approval actions recorded to audit, history
- [x] **M3.8 Audit Log** — filters (actor/action/entity/date), paginated table, row expand → before/after diff viewer
- [x] **M3.9 Settings** — flags toggles, limits inputs, AI provider status card; save → toast + audit

### M4 — Verify & Document
- [x] `pytest` ≥80% coverage on services (`make test` gates)
- [x] `ruff check backend` clean
- [x] `npm run lint` clean
- [x] `npm run build` passes
- [x] Update `docs/API.md` (all new endpoints), `docs/PROGRESS.md`, `docs/REQUIREMENTS.md` §3.8
- [ ] Manual smoke: admin login → each of 9 pages renders with data (use `admin@scholario.com` / `admin-password-123` on localhost)
- [x] Update README "Admin" section if present
- [x] Final blueprint §8 log entry + all checkboxes reconciled

---

## 5. Endpoint Backlog (quick reference)

| Endpoint | Method | M | Status |
|---|---|---|---|
| `/api/admin/stats` v2 | GET | M1.1 | [ ] |
| `/api/admin/scholarships` (+filters/sort/total) | GET | M1.2 | [ ] |
| `/api/admin/scholarships` (full create) | POST | M1.2 | [ ] |
| `/api/admin/scholarships/{id}` (full patch) | PATCH | M1.2 | [ ] |
| `/api/admin/scholarships/{id}` | DELETE | M1.2 | [ ] |
| `/api/admin/scholarships/bulk` | POST | M1.2 | [ ] |
| `/api/admin/scholarships/export-csv` | GET | M1.2 | [ ] |
| `/api/admin/scholarships/import-csv?dry_run` | POST | M1.2 | [ ] |
| `/api/admin/data-quality` | GET | M1.3 | [ ] |
| `/api/admin/users` (+total/filters/counts) | GET | M1.4 | [ ] |
| `/api/admin/users/{id}` (detail) | GET | M1.4 | [ ] |
| `/api/admin/users/{id}` (role/verify) | PATCH | M1.4 | [ ] |
| `/api/admin/users/{id}/revoke-sessions` | POST | M1.4 | [ ] |
| `/api/admin/users/{id}/reset-onboarding` | POST | M1.4 | [ ] |
| `/api/admin/templates` CRUD | GET/POST/PATCH/DELETE | M1.5 | [ ] |
| `/api/admin/templates/{id}/reorder` | POST | M1.5 | [ ] |
| `/api/admin/announcements` | GET/POST | M1.6 | [ ] |
| `/api/admin/payments` + `/payments/grant` | GET/POST | M1.7 | [ ] |
| `/api/admin/settings` | GET/PATCH | M1.8 | [ ] |
| `/api/admin/audit` | GET | M1.9 | [ ] |
| `/api/admin/ai-stats` | GET | M1.10 | [ ] |
| rate limit / csrf / headers | — | M0 | [ ] |

---

## 6. Security Checklist (must all be `[x]` before "done")

- [x] Rate limits: auth 5/min, admin-login 3/min, ai 20/min, general 60/min → 429 + `RATE_LIMITED`
- [x] CSRF: double-submit verified on all mutations; 403 `CSRF_FAILED`; client attaches header
- [x] `require_admin` on every new endpoint (grep `api/admin` vs `require_admin` count matches)
- [x] Self-lockout guard + last-admin guard with tests
- [x] `middleware.ts` redirects cookie-less `/admin/*` requests
- [x] Security headers on responses
- [x] Audit rows written for: scholarship create/update/delete/bulk/import, user update/role/sessions/onboarding, template CRUD, settings change, announcements, payment grants, admin login success/failure
- [x] No secrets/keys logged; audit diff excludes `password_hash`
- [x] pytest green with security suite; ruff/lint/build green

---

## 7. Test Plan

| Suite | Covers |
|---|---|
| `test_security.py` (new) | 429 rate limit, CSRF 403/ok, headers, self-lockout, last-admin, audit capture |
| `test_admin.py` (extend) | stats v2, scholarship full CRUD + bulk + export + dry-run, data-quality queues, users detail/role/sessions/onboarding |
| `test_admin_content.py` (new) | templates CRUD + slug conflict + in-use guard, announcements chunking + audience filter, settings get/patch, payments grant, audit list filters, ai-stats |
| `test_auth.py` (extend) | admin login rate limit, failed-login audit |
| Frontend | `npm run lint` + `npm run build` (no unit test framework — verify pages compile & render) |

---

## 8. Progress Log (append-only)

| Date | Who | What | Commit |
|---|---|---|---|
| 2026-10-07 | opencode | Blueprint created (Phase 0 complete). Audit verified; decisions AD-1…AD-10 locked with user: security-first full M0, all 9 pages, no re-theme. | *(this commit)* |
| 2026-10-08 | opencode | M0 complete: rate limits, CSRF double-submit, audit model+migration 0009, self-lockout/last-admin guards, proxy.ts admin guard, security headers, test_security.py (9 tests). | *uncommitted* |
| 2026-10-08 | opencode | M1 complete: stats v2, scholarships CRUD+bulk+export+dry-run, data-quality 4 queues, users detail/sessions/onboarding/revoke/reset, templates CRUD+reorder, announcements (chunked+audit history), payments skeleton, settings (persisted, free_results cap enforced in matching), audit list, ai-stats. test_admin_content.py (8) + test_admin.py extended (12). Full suite 69 passed / 0 failed. | *uncommitted* |
| 2026-10-08 | opencode | M2 complete: typed admin API client, shared components (DataTable, Drawer, ConfirmDialog, Toast, StatCard, EmptyState, Skeleton, PageHeader), layout full nav + breadcrumbs + cached /me, /admin redirect, admin CSS additions. | *uncommitted* |
| 2026-10-08 | opencode | M3 complete: 10 admin pages (dashboard, scholarships, data-quality, users, templates, announcements, payments, settings, audit, AI) wired to adminApi. ESLint + next build clean. Live smoke-tested: all 12 admin routes 200. | *uncommitted* |
| 2026-10-08 | opencode | M4 complete: ruff clean, ESLint clean, next build passes, pytest services coverage 81% (>=80 gate), docs/API.md updated with admin routes + security notes, blueprint checkboxes reconciled (80 ticked / 10 pending). Full suite 69 passed. | *uncommitted* |
| 2026-10-08 | opencode | Session hardening (logout gaps): access-token `jti` denylist (model + migration 0010, `token_blocklist` service, enforced in `get_current_user` → `401 AUTH_REVOKED`), logout revokes the presented access token; `api.ts` `endSession()` clears cookies then redirects to `/login`/`/admin/login` once per expiry. 70 tests pass, ruff/ESLint/tsc clean, live replay smoke verified. | *uncommitted* |
| | | | |

---

## 9. Resume Instructions (if machine restarted)

1. Read §1–§3 (goal, audit, decisions) — 10 minutes.
2. Check git: `git log --oneline -10` and `git status` — see what landed.
3. Open §4; **find the first unchecked `[ ]`** (or `~` in-progress item) in module order M0 → M1 → M2 → M3 → M4.
4. Verify environment: `docker compose up -d` then `curl http://localhost:8000/health` → `{"status":"ok"}`. Frontend: `http://localhost:3000`.
5. Re-run the suite before starting: `docker compose exec backend pytest` (must be green).
6. Work the next item only; then: run its tests → update its checkbox → append §8 log row → commit (`feat(security): …` / `feat(api): …` / `feat(admin): …` / `test: …` / `docs: …`).
7. §6 Security Checklist must be fully green before any "complete" claim.

**Demo credentials (local):**
- Student: `student@scholario.com` / `demo-password-123` → `/login`
- Admin: `admin@scholario.com` / `admin-password-123` → `/admin/login`

**Key file map:**
```
backend/app/routers/admin.py        # admin API (M0.4 guards, all M1 endpoints)
backend/app/core/{deps,csrf,ratelimit}.py # auth + require_admin + CSRF + rate limit (M0)
backend/app/services/audit.py       # NEW (M0.3)
backend/app/models/audit.py         # NEW (M0.3)
backend/app/services/settings.py    # NEW (M1.8) settings + free_results cap
backend/app/alembic/versions/0009_admin_foundation.py  # NEW (audit_logs + settings)
backend/app/tests/test_security.py  # NEW (M0.7)
frontend/src/proxy.ts               # NEW (M0.5) /admin/* guard
frontend/src/admin/api.ts           # NEW (M2)
frontend/src/admin/components/      # NEW (M2)
frontend/src/app/admin/**           # 10 pages (M3)
frontend/src/lib/api.ts             # apiFetch + CSRF header (M0.2)
docs/ADMIN_PANEL_BLUEPRINT.md       # THIS FILE
```
