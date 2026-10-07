# SCHOLARIO — MASTER BUILD PROMPT (for a coding agent)

> Paste this whole file to your coding agent (Claude Code, Cursor, Codex, etc.).
> Put the 16 uploaded files (HTML pages, CSV, prompt.txt) in a folder called `/input` first.
> Read the WHOLE prompt before writing code. Then follow Section 22 (build order) step by step.

---

## 0. RULES FOR THE AGENT (read first, obey always)

1. You are building a complete product called **Scholario**. Not a demo. A real, runnable project.
2. Work in small steps. After each step: run it, test it, fix it, then write a line in `docs/PROGRESS.md` (Section 21).
3. If something is unclear, **decide like a senior software engineer**, write the decision in `docs/DECISIONS.md`, and keep going. Do not stop to ask questions.
4. Never leave `TODO` that blocks running. Anything intelligent (AI) must work with a **mock/stub** now and be easy to swap for a real API later (Section 16).
5. Every secret goes in `.env`. Never hard-code keys. Provide `.env.example` files.
6. Use simple, readable code. Add short comments. Prefer many small files over one giant file.
7. Everything must run with two commands per side: backend `uvicorn app.main:app --reload`, frontend `npm run dev`. Also provide `docker-compose.yml` for one-command start.
8. Write tests for the matching engine (Section 9) — it is the heart of the product.
9. Keep the visual look of the uploaded prototype (teal `#26736b`, soft greys, rounded cards, sidebar layout) but make it **much more polished, friendly, and mobile-first**.
10. At the end, all documents in Section 21 must exist in the repo.

---

## 1. WHAT WE ARE BUILDING (plain words)

**Scholario** helps students (mainly from Pakistan) find scholarships abroad they can really get.

Flow in one sentence: *Sign up → answer a short onboarding wizard → see a list of scholarships that fit you (with your chances) → click one → see every detail → save it / track it / write documents for it with templates / ask the AI advisor.*

Main parts:
- **Public website**: landing page, how it works, pricing, FAQ, login, sign up.
- **Student app**: dashboard, onboarding, matched scholarships, scholarship detail, saved list, application tracker, checklist, templates (documents), SOP reviewer, AI advisor chat, visa & travel guide, notifications, profile, referral, billing.
- **Admin app**: separate admin login, manage scholarships (CRUD + CSV re-import), users, templates, payments, announcements, analytics.
- **Backend**: FastAPI + SQLAlchemy. The CSV is the source of truth for scholarship data and is imported into the database.

---

## 2. INPUT FILES (what the user gave you)

Put in `/input`. Study them before coding.

| File | What it is | What to do |
|---|---|---|
| `fully_formated_scholarships.csv` | **9,338 scholarships**, 53 columns. THE DATABASE. | Import to DB (Section 6). |
| `home.html`, `onboarding.html`, `profile.html`, `notifications.html`, `tracker.html`, `checklist.html`, `templates.html`, `visa-travel.html`, `referral.html`, `advisor.html`, `sop-reviewer.html`, `scholarships.html`, `updated_idex.html` (landing page) | Static prototype pages. Sidebar + topbar layout, teal theme, `localStorage` for fake data. | Rebuild each as a Next.js page (Section 13). Copy the look, not the fake logic. Remove all `localStorage` data storage — use the API. |
| `scholarship_detail_template.html` | Detail page with `{{placeholders}}` | Becomes the Scholarship Detail page (Section 14). |
| `prompt.txt` | "FastAPI backend, Next.js frontend, convert CSV to SQLAlchemy database." | Confirms stack. |

### 2.1 REALITY CHECK of the CSV (important — I inspected it)

The CSV columns are:

```
scholarship_id, level, duration_months, cycle_status, intake_term, rolling_admission, source_language,
title, deadline, funding, scholarship_type, university_name, grant_amount_formatted, short_description,
disciplines, is_deadline_unspecified, grant_currency, grant_amount_numeric, tuition_covered,
stipend_monthly_amount, stipend_currency, health_insurance_covered, language_course_included,
work_allowed_during_study, dependants_allowance, work_hours_limit_per_week, min_degree_required,
degree_field_restriction, graduation_window, final_year_students_can_apply, local_language_test,
account_required, attestation_required, medical_certificate_required, documents_list,
police_clearance_required, research_areas_open, notification_method, nominating_body_pk,
return_obligation_details, stipend_monthly_usd, total_funding_score, disciplines_processed,
scholarship_count_estimate, total_applicants_estimate, pakistan_applicants_estimate,
pakistan_selected_estimate, IELTS_required, IELTS_band_recommendation, deadline_cleaned,
IELTS_band_recommendation_cleaned, pakistan_acceptance_rate_percent, intelligent_fields_of_study
```

Facts found in the data:
- `level` ∈ {Master 4838, PhD 2703, Undergraduate 1797}.
- `scholarship_type` ∈ {Fully Funded 7457, Partial Funding 1881}. `tuition_covered` ∈ {100, 75, 50}.
- **IELTS**: `IELTS_required` False for 1027 rows (band is empty). When True the band is `6+`, `7+` or `8+` in `IELTS_band_recommendation` (the `_cleaned` column lost the 8+ values — **use the non-cleaned column**).
- `intelligent_fields_of_study` is a Python-list string with these 7 categories only: `General / Any Field of Study`, `Social Sciences`, `Natural Sciences`, `Business & Economics`, `Health & Medical Sciences`, `Engineering & Technology`, `Arts & Humanities`. **Use this column for the field filter.**
- Booleans are messy: `True`, `Y`, `N`, `False`, `'Y (some text)'`, `'N (some text)'`, `university_dependent`.
- `deadline` is text: dates like `19 Mar 2027`, or `Not specified`, or `Anytime`. `deadline_cleaned` is ISO date or empty (5,286 empty).
- `documents_list` is a Python-list string (one variant has lowercase run-together words like `tworecommendationletters`).
- `pakistan_acceptance_rate_percent` = `pakistan_selected_estimate / pakistan_applicants_estimate * 100` (checked: 1/30 = 3.33). Range 0.83–50.
- 431 duplicate titles exist but have different `scholarship_id` (different levels/universities). **Do NOT dedupe.**
- 844 distinct `university_name` values. Top: University of North Dakota (630 rows), University of Toledo (598), Washington State University (281), CSU Fullerton (236), ANU (232), Massey (232) …
- `dependants_allowance`, `research_areas_open`, `notification_method`, `work_hours_limit_per_week` are nearly constant. Import them anyway, show them only if meaningful.

### 2.2 MISSING DATA — you must solve these (the user needs them)

| Needed by the product | In CSV? | Solution |
|---|---|---|
| **Host country** (filter) | ❌ No column | Build `university_country_map` (Section 7). Add `host_country` column to `scholarships`. |
| **Application URL** (detail page) | ❌ No column | Add nullable `application_url`. Admin can fill it. Fallback: generate a Google search link `https://www.google.com/search?q={title}+{university}+scholarship+apply`. Show label "Official link not added yet — search link". |
| **GPA requirement** | ❌ No column | Use the *tier* logic in Section 9 (IELTS band tier acts as the difficulty tier; GPA caps the tier). |
| Scholarship "popular destination" etc. | ❌ | Not needed for retrieval. |

Write these three solutions in `docs/DECISIONS.md`.

---

## 3. TECH STACK (fixed — do not change)

**Backend**
- Python 3.11+, **FastAPI**, Uvicorn
- **SQLAlchemy 2.0** (ORM) + **Alembic** (migrations)
- **Pydantic v2** (+ `pydantic-settings`)
- DB: **SQLite** for local dev, **PostgreSQL** for production (switch by `DATABASE_URL`)
- Auth: JWT (access 30 min + refresh 14 days, refresh token stored hashed in DB), `passlib[bcrypt]`, `python-jose` or `pyjwt`
- `pandas` for CSV import, `python-docx` + `reportlab` (or `weasyprint`) for exporting documents
- `slowapi` rate limiting, `python-multipart`, `httpx` (calls to AI/payment providers)
- Tests: `pytest`, `httpx.AsyncClient`/`TestClient`
- Lint: `ruff`, `black`

**Frontend**
- **Next.js 14+ (App Router) + TypeScript**
- **Tailwind CSS** + **shadcn/ui** components + `lucide-react` icons
- **TanStack Query** (server state), **react-hook-form + zod** (forms), `zustand` (small UI state)
- **TipTap** rich-text editor (templates), `recharts` (charts), `date-fns`
- API client generated by hand in `frontend/src/lib/api.ts` (typed `fetch` wrapper, auto-refresh token)
- Auth tokens: httpOnly cookies set by backend (preferred) — or memory + refresh cookie. Never `localStorage` for tokens.

**DevOps**: Docker, docker-compose, GitHub Actions CI (lint + tests + build), Nginx config sample.

---

## 4. REPOSITORY STRUCTURE (create exactly this)

```
scholario/
├── README.md                     # Section 21
├── .gitignore
├── docker-compose.yml
├── Makefile                      # make dev / make test / make seed
├── docs/
│   ├── SRS.md                    # Software Requirements Specification
│   ├── ARCHITECTURE.md
│   ├── API.md                    # endpoint table (also auto /docs)
│   ├── DATABASE.md               # ER description
│   ├── AI_INTEGRATION.md         # where to plug AI APIs
│   ├── PAYMENTS.md               # payment gateway guide
│   ├── DEPLOYMENT.md
│   ├── MATCHING_LOGIC.md
│   ├── DECISIONS.md
│   └── PROGRESS.md
├── backend/
│   ├── data/
│   │   ├── fully_formated_scholarships.csv
│   │   └── university_country_map.csv     # university_name,host_country,confidence
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/versions/
│   ├── Dockerfile
│   ├── scripts/
│   │   ├── import_csv.py              # CSV → DB (idempotent)
│   │   ├── build_country_map.py       # helps fill university_country_map.csv
│   │   └── create_admin.py
│   ├── app/
│   │   ├── main.py                    # FastAPI app, CORS, routers
│   │   ├── core/        (config.py, security.py, deps.py, logging.py, rate_limit.py)
│   │   ├── db/          (base.py, session.py)
│   │   ├── models/      (user.py, profile.py, scholarship.py, saved.py, application.py,
│   │   │                 document.py, template.py, chat.py, notification.py, payment.py,
│   │   │                 referral.py, audit.py)
│   │   ├── schemas/     (one pydantic file per model)
│   │   ├── services/
│   │   │   ├── matching.py            # THE ENGINE (Section 9)
│   │   │   ├── gpa.py                 # calculator (Section 10)
│   │   │   ├── csv_import.py
│   │   │   ├── templates_seed.py
│   │   │   ├── export.py              # docx/pdf export
│   │   │   ├── notifications.py
│   │   │   └── ai/                    # Section 16 (provider interface + stubs)
│   │   ├── routers/
│   │   │   (auth.py, users.py, onboarding.py, scholarships.py, saved.py,
│   │   │    applications.py, documents.py, templates.py, ai.py, notifications.py,
│   │   │    checklist.py, visa.py, referral.py, billing.py, admin.py, health.py)
│   │   └── tests/ (test_matching.py, test_gpa.py, test_auth.py, test_import.py, test_documents.py)
└── frontend/
    ├── package.json, tsconfig.json, tailwind.config.ts, next.config.mjs, .env.example, Dockerfile
    └── src/
        ├── app/
        │   ├── (public)/ page.tsx (landing), pricing, faq, about, contact
        │   ├── (auth)/ login, register, forgot-password, reset-password, verify-email
        │   ├── (admin-auth)/ admin/login
        │   ├── (app)/                 # needs login, has sidebar layout
        │   │   ├── layout.tsx
        │   │   ├── onboarding/
        │   │   ├── dashboard/
        │   │   ├── scholarships/ (list + [id] detail + compare)
        │   │   ├── saved/
        │   │   ├── tracker/
        │   │   ├── checklist/
        │   │   ├── templates/ (gallery, [slug]/editor, my-documents)
        │   │   ├── sop-reviewer/
        │   │   ├── advisor/
        │   │   ├── visa-travel/
        │   │   ├── notifications/
        │   │   ├── profile/
        │   │   ├── referral/
        │   │   └── billing/
        │   └── admin/ (dashboard, scholarships, users, templates, payments, announcements)
        ├── components/ (ui/, layout/, scholarships/, onboarding/, templates/, chat/, charts/)
        ├── lib/ (api.ts, auth.ts, utils.ts, constants.ts)
        ├── hooks/
        └── types/
```

---

## 5. DATABASE DESIGN (SQLAlchemy models)

Use integer PKs unless noted. All tables have `created_at`, `updated_at`.

### 5.1 `users`
`id, email (unique, indexed), password_hash, full_name, role ('student'|'admin'), is_active, is_verified, plan ('free'|'pro'), plan_expires_at, referral_code (unique), referred_by_id (FK users, null), last_login_at`

### 5.2 `refresh_tokens`
`id, user_id, token_hash, expires_at, revoked, user_agent, ip`

### 5.3 `profiles` (one per user — filled by onboarding)
| Column | Type | Used in retrieval? |
|---|---|---|
| origin_country | str | ❌ stored only (anyone can select; does not filter) |
| target_level | enum `Undergraduate/Master/PhD` | ✅ |
| host_countries | JSON list[str] (may be empty = any) | ✅ |
| fields_of_study | JSON list[str] (from the 7 categories) | ✅ |
| ielts_status | enum `not_taking / taking_6 / taking_7 / taking_8` (see 8.3) | ✅ |
| gpa_scale | enum `4.0 / 5.0 / 10 / percentage` | ✅ (to normalize) |
| gpa_value | float | ✅ |
| gpa_4_equivalent | float (computed & stored) | ✅ |
| bs_marks_obtained, bs_marks_total | float (for Undergraduate path) | ✅ via calculator |
| funding_preference | enum `full_tuition / partial / with_stipend / any` | ❌ stored only |
| extra_preferences | JSON (attractive options, Section 8) | ❌ stored only |
| intake_preference, budget_note, bio | misc | ❌ |
| onboarding_completed | bool | — |

### 5.4 `scholarships` (one row per CSV row; `id` = `scholarship_id` from CSV)
Keep **every** CSV column (cleaned types) plus derived columns:

| Derived column | Meaning |
|---|---|
| `host_country` | from university map (Section 7) |
| `ielts_tier` | int: 0 = no IELTS needed, 1 = 6+, 2 = 7+, 3 = 8+ |
| `fields_list` | JSON list parsed from `intelligent_fields_of_study` |
| `docs_list` | JSON list parsed from `documents_list`, nicely formatted |
| `deadline_date` | date or null (from `deadline_cleaned`, fallback parse of `deadline`) |
| `deadline_kind` | `fixed / rolling / anytime / unspecified` |
| `selection_ratio_percent` | `pakistan_selected / pakistan_applicants * 100` (recompute; keep CSV value as `pakistan_acceptance_rate_percent`) |
| `application_url` | nullable, admin-editable |
| `is_active` | bool (admin can hide) |
| `search_text` | lowercase concat of title+university+description+fields for fast search |

Indexes: `(level)`, `(host_country)`, `(ielts_tier)`, `(deadline_date)`, `(scholarship_type)`, full-text/`search_text` LIKE (Postgres: add GIN trigram later).

### 5.5 User data tables
- `saved_scholarships`: `user_id, scholarship_id, note, created_at` (unique pair)
- `applications` (tracker): `user_id, scholarship_id, status ('planning','in_progress','submitted','interview','accepted','rejected','withdrawn'), applied_on, next_step, next_step_date, notes`
- `checklist_items`: `user_id, scholarship_id (null = global), title, is_done, due_date, category`
- `documents`: `user_id, template_id (null), scholarship_id (null), title, doc_type, content_html (Text), content_json (JSON, TipTap), placeholders_json (the form answers), word_count, status ('draft','final'), version, created_at, updated_at`
- `document_versions`: `document_id, version, content_html, created_at` (snapshot on every save, keep last 30)
- `templates`: `id, slug, title, category, description, body_html (with {{placeholders}}), fields_json (schema of the questions), is_premium, is_active, sort_order`
- `chat_sessions`: `user_id, title, scholarship_id (null)`; `chat_messages`: `session_id, role ('user'|'assistant'), content, tokens, created_at`
- `sop_reviews`: `user_id, document_id (null), input_text, result_json, score, provider, created_at`
- `notifications`: `user_id (null = broadcast), title, body, kind, link, is_read`
- `payments`: `user_id, provider, provider_ref, amount, currency, plan, status, raw_json`
- `referrals`: `referrer_id, referred_id, status, reward_given`
- `audit_logs`: `actor_id, action, entity, entity_id, meta_json, ip`
- `visa_guides`: `country, title, steps_json, documents_json, links_json` (seed with 6–8 popular countries; admin editable)

---

## 6. CSV → DATABASE IMPORT (script `scripts/import_csv.py`)

Command: `python -m scripts.import_csv --file data/fully_formated_scholarships.csv` (run from `backend/`; also callable from admin UI).
Must be **idempotent** (upsert by `scholarship_id`), run in chunks of 500, print a report (rows read, inserted, updated, skipped, warnings).

### Cleaning rules (write each as a tiny function, unit-test them)

| Field | Rule |
|---|---|
| bool-like (`rolling_admission`, `health_insurance_covered`, `work_allowed_during_study`, `final_year_students_can_apply`, `account_required`, `attestation_required`, `medical_certificate_required`, `police_clearance_required`, `language_course_included`) | Store **two** columns each: `<name>` (bool/None) and `<name>_note` (original text in brackets). `True/Y/Y (...)` → True; `False/N/N (...)` → False; `university_dependent`/`for some ...` → None + note. Example: `N (officially not allowed for CSC scholars)` → False, note "officially not allowed for CSC scholars". |
| `level` | keep as is. Map UI labels: Bachelor→Undergraduate. |
| `intake_term` | normalize: `Autumn / Fall`, `autumn_semester` → `Autumn/Fall`; `flexible` → `Flexible`. |
| `source_language` | `en` → `English`. |
| `min_degree_required` | `bachelor`, `Bachelor's Degree` → `Bachelor's Degree`; `master` → `Master's Degree`; `bachelor_with_first_class_honours_or_master` → `Bachelor's (First Class Honours) or Master's`; `High School Certificate` stays. |
| `disciplines`, `disciplines_processed`, `intelligent_fields_of_study`, `documents_list` | `ast.literal_eval` safely inside try/except → list. Empty string → `[]`. |
| `documents_list` pretty names | `AcademicTranscripts` → "Academic Transcripts", `tworecommendationletters` → "Two Recommendation Letters", `onlineapplicationform` → "Online Application Form"… Write a dictionary of known tokens; fallback: split CamelCase / insert spaces. |
| `deadline` + `deadline_cleaned` | `deadline_date` = parse `deadline_cleaned`; if empty, try parse `deadline` (`%d %b %Y`). `deadline_kind`: "Anytime" → `anytime`; rolling_admission True & no date → `rolling`; "Not specified" → `unspecified`; date → `fixed`. |
| `IELTS_*` | `ielts_tier`: if `IELTS_required` False → 0. Else map `IELTS_band_recommendation` `6+`→1, `7+`→2, `8+`→3. If required but band empty → 2 (safe default) + warning. **Ignore `_cleaned` column.** |
| `pakistan_*` | cast int. `selection_ratio_percent = round(selected/applicants*100, 2)` if applicants > 0 else null. |
| `short_description` | contains HTML (`<p>`, `&nbsp;`). Store raw as `description_html`; also create `description_text` (stripped) for cards & search. Sanitize HTML on output (allow p, br, ul, li, b, strong, a). |
| `grant_amount_numeric`, `stipend_monthly_usd`, `total_funding_score` | numeric; null-safe. |
| `nominating_body_pk`, `return_obligation_details`, `degree_field_restriction` | mostly empty → keep nullable; hide in UI if empty. |
| `host_country` | join with `backend/data/university_country_map.csv` (Section 7). Unmapped → `"Unknown"` and counted in the report. |

After import, run `scripts/build_country_map.py --report` to list unmapped universities.

---

## 7. HOST COUNTRY MAPPING

The CSV has no country. Build `backend/data/university_country_map.csv` with columns `university_name,host_country,confidence` for all 844 universities.

**Step A — seed these known ones exactly:**

| university_name | host_country |
|---|---|
| University of North Dakota, The University of Toledo, Washington State University, California State University Fullerton, California State University Northridge, Central Michigan University, Ball State University, Illinois State University, The University of Alabama at Birmingham, Eastern Michigan University, Michigan State University, Education USA | United States |
| Australian National University, University of Queensland, The University of Sydney, Monash University, Charles Sturt University | Australia |
| Massey University | New Zealand |
| University of Victoria, Algonquin College, Brock University, University of Guelph, University of Northern British Columbia | Canada |
| UCL, University of Oxford, The University of Edinburgh, University of St Andrews, London School of Economics and Political Science, The University of Lancashire, University of Southampton, University of Birmingham, University of Warwick, University of Liverpool, Loughborough University, Queen's University Belfast, Imperial, University of York | United Kingdom |
| INSEAD - The Business School for the World | France |
| Lingnan University | Hong Kong |
| Slovak Academic Information Agency | Slovakia |

**Step B — rules for the rest** (in `build_country_map.py`, in this order):
1. Keywords in the name: `Deutsch|German|Technische Universität|Humboldt|Heidelberg|Munich|DAAD` → Germany; `Dutch|Netherlands|Amsterdam|Leiden|Utrecht|Delft|Groningen|Wageningen` → Netherlands; `Sweden|Swedish|Stockholm|Lund|Uppsala|KTH|Chalmers` → Sweden; `Norweg|Oslo|Bergen` → Norway; `Danish|Denmark|Copenhagen|Aarhus` → Denmark; `Finland|Helsinki|Aalto` → Finland; `Swiss|Switzerland|ETH|Zurich|Geneva|Lausanne` → Switzerland; `France|French|Paris|Campus France|Eiffel|Sorbonne` → France; `Italy|Italian|Milan|Rome|Bologna|Politecnico` → Italy; `Spain|Madrid|Barcelona` → Spain; `Korea|Seoul|KAIST|GKS` → South Korea; `Japan|Tokyo|Kyoto|MEXT|Osaka` → Japan; `China|Chinese|Beijing|Tsinghua|Shanghai|Peking|CSC|Zhejiang` → China; `Malaysia` → Malaysia; `Turk|Istanbul|Ankara` → Türkiye; `Hungar|Stipendium` → Hungary; `Czech|Prague` → Czech Republic; `Poland|Polish|Warsaw` → Poland; `Austria|Vienna` → Austria; `Belgi|Leuven|Ghent` → Belgium; `Ireland|Irish|Dublin|Trinity College Dublin` → Ireland; `Singapore|NUS|NTU` → Singapore; `Saudi|KAUST` → Saudi Arabia; `Qatar` → Qatar; `UAE|Emirates|Dubai|Abu Dhabi|Khalifa` → UAE; `Estonia|Tartu` → Estonia; `Iran|Tehran` → Iran; `Russia|Moscow|Skolkovo` → Russia; `Indonesia`, `Thailand`, `Brunei`, `Taiwan`, `New Zealand|Auckland|Otago`, `Australia|Melbourne|Adelaide|Curtin|UNSW` etc.
2. Name contains `University of <US state>` (Alabama, Texas, Ohio …) or `State University` / `College` with US-state names → United States.
3. Name contains `Canada|Canadian|Ontario|British Columbia|Alberta|McGill|Toronto|Waterloo|Concordia` → Canada.
4. `UK|Scotland|Wales|England|Kingdom|Imperial|King's College London|Cambridge|Manchester|Leeds|Glasgow|Sheffield|Nottingham|Bristol|Durham|Cardiff|Strathclyde` → United Kingdom.
5. Still unknown → call the optional **AI helper** `ai.classify_country(university_name)` (Section 16) if a key is configured; otherwise write `Unknown`, confidence `0`.
6. Anything with confidence < 0.8 is flagged in the admin UI under **Admin → Data Quality → Unmapped universities** where the admin can pick a country from a dropdown (saves to the map table and updates all affected scholarships).

Also create DB table `university_country` (same columns) so the admin edits survive re-imports.

---

## 8. ONBOARDING WIZARD (the user's most important feature)

Route `/onboarding`. A friendly **multi-step wizard** with a progress bar, Back/Next, autosave to the server after each step (`PUT /api/onboarding/step`), and the ability to resume. Mobile-first. Each step is one question group, with large tappable option cards.

### Steps

1. **Welcome / name** – full name (pre-filled).
2. **Where are you from?** – `origin_country` (searchable dropdown of all countries, default Pakistan). *Anyone can select any country. Stored only — never used to filter.*
3. **What do you want to study?** – Degree level: `Bachelor's (Undergraduate)`, `Master's`, `PhD`.
4. **Where do you want to study?** – `host_countries` multi-select chips with flags (countries come from `GET /api/meta/host-countries`, i.e. distinct values in the DB with counts). Include "Anywhere / Not sure" (= no country filter).
5. **Field of study** – multi-select of the 7 categories (`GET /api/meta/fields`). Selecting any specific field still matches scholarships tagged `General / Any Field of Study`. "Not sure" = no field filter.
6. **English test (IELTS)** – single choice cards:
   - "I don't want to take IELTS" → `not_taking`
   - "I can score **6+**" → `taking_6`
   - "I can score **7+**" → `taking_7`
   - "I can score **8+**" → `taking_8`
7. **Academic score**
   - Choose grading system: `4.0 scale (CGPA out of 4)`, `5.0 scale`, `10-point scale`, `Percentage`.
   - Enter CGPA/percentage (validated against the scale: e.g. 0–4, 0–5, 0–10, 0–100).
   - **If degree level = Bachelor's:** show the **Marks Calculator** (Section 10) instead: "Enter your Intermediate/FSc/A-Level marks" → marks obtained / total marks → live percentage and 4.0-equivalent. This replaces the GPA input.
   - Show the computed "4.0 equivalent" live under the field so the user sees how the system understood them.
8. **Funding preference** (collected, **not used to filter**) – `Full tuition waiver`, `Partial waiver`, `With monthly stipend`, `Any`. Helper text: "We'll still show everything that fits you; this helps your advisor."
9. **Nice-to-haves** (collected, **not used to filter**) – attractive toggles: ☐ Work allowed during study ☐ Health insurance included ☐ Language course included ☐ Family/dependants support ☐ No application fee ☐ Rolling admissions ☐ Higher stipend (>$1,500/mo) ☐ Short programs (≤ 24 months) ☐ Final-year students can apply ☐ No attestation needed. Also: preferred intake (Autumn/Spring/Flexible).
10. **Review & finish** – summary card with Edit links. Button **"Show my scholarships"**.

On finish: `profile.onboarding_completed = true`, call `POST /api/scholarships/match` and redirect to `/scholarships?matched=1` (the **Matched Results page**, Section 13.4).

Users can later change everything in **Profile → Preferences**; results update instantly.

---

## 9. MATCHING ENGINE (`services/matching.py`) — EXACT LOGIC

> The user explained the rules in rough words. Below is the cleaned, complete logic. Implement exactly, make thresholds configurable in `matching_config.py`, and explain in `docs/MATCHING_LOGIC.md`.

### 9.1 Vocabulary
`ielts_tier` of a scholarship: **0** = no IELTS required, **1** = 6+, **2** = 7+, **3** = 8+.

### 9.2 Step 1 — normalize GPA to a 4.0 equivalent (`gpa.py`, Section 10) → `g4`.

### 9.3 Step 2 — IELTS cap (what the student's IELTS choice allows)

| Student choice | `ielts_cap` | Meaning |
|---|---|---|
| `not_taking` | 0 | Only scholarships with no IELTS requirement (tier 0). |
| `taking_6` | 1 | Tier 0 and tier 1 (6+). Never 7+ or 8+. |
| `taking_7` | 2 | Tier 0, 1 and 2 (6+ and 7+). Never 8+. |
| `taking_8` | 3 | Everything (tiers 0–3). |

> ⚠ The user's original sentence said "for 8 and 7 show all". I treat that as ambiguous. Default = table above (7+ cannot meet an 8+ requirement). Add a config flag `SEVEN_PLUS_SEES_ALL = False`; if True, `taking_7` gets cap 3. Document in DECISIONS.md.

### 9.4 Step 3 — GPA cap (competitiveness gate)
Low-GPA students are shown only the easier tiers (6+ and no-IELTS). Higher GPA unlocks harder tiers. Thresholds depend on level (higher bar for Master/PhD — as the user asked):

| Level | `g4 < T1` → cap 1 | `T1 ≤ g4 < T2` → cap 2 | `g4 ≥ T2` → cap 3 |
|---|---|---|---|
| Undergraduate | T1 = 3.0 | T2 = 3.5 | |
| Master | T1 = 3.2 | T2 = 3.6 | |
| PhD | T1 = 3.4 | T2 = 3.7 | |

(For Undergraduate, `g4` comes from the marks calculator.) Put the numbers in `matching_config.py`.
If the student gave no score → `gpa_cap = 3` (don't block) and show a banner "Add your score for sharper results".

### 9.5 Step 4 — final tier cap
```python
final_cap = min(ielts_cap, gpa_cap)
if ielts_status == "not_taking":
    final_cap = 0          # not taking IELTS => only tier-0 scholarships, regardless of GPA
```

### 9.6 Step 5 — SQL filter (all must be true)
```python
q = select(Scholarship).where(Scholarship.is_active == True)
q = q.where(Scholarship.level == profile.target_level)                    # level
q = q.where(Scholarship.ielts_tier <= final_cap)                          # IELTS + GPA gate
if profile.host_countries:                                                # host country (skip if empty)
    q = q.where(Scholarship.host_country.in_(profile.host_countries))
if profile.fields_of_study:                                               # field (JSON contains)
    wanted = set(profile.fields_of_study) | {"General / Any Field of Study"}
    q = q.where(json_overlaps(Scholarship.fields_list, wanted))          # SQLite: JSON1 / Postgres: jsonb ?|
```
**NOT used for filtering (store only):** `origin_country`, `funding_preference`, `extra_preferences`.

Optional UI helper: on the results page, a toggle **"Highlight my nice-to-haves"** that only adds small green badges (✓ Work allowed, ✓ Insurance…) on cards. It must never remove results.

### 9.7 Step 6 — ranking & fields returned per result
Default sort = **highest selection ratio first** (`selection_ratio_percent` desc), tie-break by sooner deadline, then higher `total_funding_score`. Offer sort dropdown: *Best chance, Deadline soonest, Highest funding, Highest stipend, Newest*.

Each result card includes: title, university, host country (+flag), level, funding type badge (Fully / Partial), tuition covered %, monthly stipend USD, IELTS badge (None / 6+ / 7+ / 8+), deadline (or "Rolling" / "Anytime" / "Not specified"), seats `scholarship_count_estimate`, Pakistani applicants, Pakistani accepted, **Selection ratio** (e.g. "3.3% — 1 of 30 Pakistani applicants") with a colored chance label: ≥10% "Good chance", 4–10% "Moderate", <4% "Competitive". Heart button (save), "View details" button.

### 9.8 Pagination & facets
`GET /api/scholarships/match` returns `items, total, page, page_size, facets`. Facets (counts) for: host_country, field, ielts_tier, scholarship_type — used by *refine* sidebar on the results page (extra user-driven filters, such as funding type and deadline, ARE allowed there because the user chooses them live; they are not part of onboarding retrieval).

### 9.9 Required unit tests (`test_matching.py`) — all must pass
1. `not_taking` + any GPA → only `ielts_tier == 0`.
2. `taking_6` + GPA 3.9 → tiers {0,1}.
3. `taking_8` + GPA 3.9 (Master) → tiers {0,1,2,3}.
4. `taking_8` + Master GPA 3.1 → tiers {0,1} (GPA cap 1).
5. `taking_8` + Master GPA 3.4 → tiers {0,1,2}.
6. Undergraduate with marks 80% → g4 3.7 → cap 3.
7. Origin country change does not change result count.
8. Funding preference change does not change result count.
9. Empty `host_countries` = all countries.
10. Selecting "Engineering & Technology" also returns `General / Any Field` rows.

---

## 10. GPA & MARKS CALCULATOR (`services/gpa.py` + UI component)

### 10.1 Functions
```python
def to_percentage(scale, value): ...
def to_g4(scale, value): ...
def bs_marks_to_g4(obtained, total): ...
```
- Scale `4.0` → `g4 = value` (clamp 0–4).
- Scale `5.0` → `g4 = value / 5 * 4`.
- Scale `10` → `percentage = value * 9.5` (common conversion), then percentage table.
- Scale `percentage` → percentage table.

### 10.2 Percentage → 4.0 table (approximate; make editable in config; show disclaimer "Estimate — universities convert differently")
| Percentage | g4 |
|---|---|
| ≥ 85 | 4.0 |
| 80–84.99 | 3.7 |
| 75–79.99 | 3.3 |
| 70–74.99 | 3.0 |
| 65–69.99 | 2.7 |
| 60–64.99 | 2.3 |
| 55–59.99 | 2.0 |
| 50–54.99 | 1.7 |
| < 50 | 1.0 |

(Use linear interpolation inside bands for a smoother number, e.g. 82% → 3.78.)

### 10.3 Bachelor's "Marks Calculator" (frontend component `MarksCalculator.tsx`)
- Inputs: Exam type (FSc / ICS / A-Levels / IB / Other), **marks obtained**, **total marks** (default 1100 for FSc, prefilled per exam type, editable).
- Shows live: `percentage`, `4.0 equivalent`, and a friendly line like "This unlocks scholarships up to IELTS 8+".
- Validation: obtained ≤ total, no negatives. Also expose `POST /api/tools/gpa-convert` for use everywhere (profile page, quick tool in dashboard).
- Add a **standalone public tool page** `/tools/gpa-calculator` (good for SEO).

---

## 11. BACKEND API (all under `/api`, JSON, versioned later as `/api/v1` alias)

Auth is cookie or `Authorization: Bearer`. Errors use one shape: `{ "detail": "...", "code": "SOME_CODE" }`.

| Group | Method + Path | Purpose |
|---|---|---|
| Auth | `POST /auth/register` | email, password, full_name, optional referral_code → creates user, sends verify email (stub) |
| | `POST /auth/login` | returns/sets tokens |
| | `POST /auth/refresh`, `POST /auth/logout` | |
| | `POST /auth/forgot-password`, `POST /auth/reset-password` | email stub prints link to console |
| | `POST /auth/verify-email` | |
| | `POST /auth/admin/login` | same but only role=admin; separate rate limit |
| | `GET /auth/me` | |
| Users | `PATCH /users/me`, `POST /users/me/password`, `DELETE /users/me` | |
| Onboarding | `GET /onboarding`, `PUT /onboarding/step`, `POST /onboarding/complete` | |
| Meta | `GET /meta/host-countries`, `/meta/fields`, `/meta/levels`, `/meta/countries` (origin list) | |
| Tools | `POST /tools/gpa-convert` | |
| Scholarships | `POST /scholarships/match` (body = optional overrides, else uses profile) | engine |
| | `GET /scholarships` | free browse with query params: `q, level, country[], field[], ielts_tier, type, deadline_before, sort, page` |
| | `GET /scholarships/{id}` | full detail (all columns) + computed `selection_ratio`, `chance_label`, `is_saved`, `application_status` |
| | `GET /scholarships/{id}/similar` | same level & field, other countries |
| | `POST /scholarships/compare` | up to 3 ids → side-by-side |
| Saved | `GET/POST/DELETE /saved` | |
| Tracker | `GET/POST/PATCH/DELETE /applications` | |
| Checklist | `GET/POST/PATCH/DELETE /checklist` ; `POST /checklist/generate/{scholarship_id}` (builds items from `docs_list` + flags like attestation/medical/police) | |
| Templates | `GET /templates`, `GET /templates/{slug}` | |
| Documents | `GET /documents`, `POST /documents`, `GET/PUT/DELETE /documents/{id}`, `GET /documents/{id}/versions`, `POST /documents/{id}/restore/{version}`, `GET /documents/{id}/export?format=docx|pdf|txt`, `POST /documents/{id}/duplicate` | **Saving a user's document persists it in DB for that user (Section 15).** |
| AI | `POST /ai/chat` (stream SSE), `GET /ai/sessions`, `GET /ai/sessions/{id}`, `POST /ai/sop-review`, `POST /ai/improve-text`, `POST /ai/fill-template`, `POST /ai/explain-scholarship/{id}`, `POST /ai/eligibility-check` | all go through provider layer (Section 16) |
| Visa | `GET /visa/{country}` | |
| Notifications | `GET /notifications`, `PATCH /notifications/{id}/read`, `POST /notifications/read-all` | auto-create: deadline in 7/3/1 days for saved/tracked scholarships (background job) |
| Referral | `GET /referral` | code, link, stats |
| Billing | `GET /billing/plans`, `POST /billing/checkout`, `POST /billing/webhook/{provider}`, `GET /billing/history` | Section 19 |
| Admin (role=admin) | `GET /admin/stats` | users, signups per day, scholarships count, top saved, payments |
| | `CRUD /admin/scholarships`, `POST /admin/scholarships/import-csv`, `GET /admin/scholarships/export-csv` | |
| | `GET/PATCH /admin/universities/unmapped`, `PATCH /admin/universities/{name}/country` | |
| | `CRUD /admin/templates`, `GET/PATCH /admin/users`, `POST /admin/announcements` | |
| Health | `GET /health` | |

Also: CORS for the frontend origin, request-ID middleware, structured logs, global exception handler, OpenAPI tags, rate limit (auth 5/min, AI 20/min free, 60/min pro).

---

## 12. AUTH & ROLES

- Student register/login pages. Password min 8 chars, strength meter in UI.
- **Admin login is a separate page** `/admin/login` calling `/auth/admin/login`; admin pages live under `/admin/*` with their own layout (dark sidebar to look different). `scripts/create_admin.py --email --password` creates the first admin.
- Next.js `middleware.ts` protects `(app)` and `admin` routes; redirect to `/login` or `/admin/login`.
- If logged in but `onboarding_completed == false`, redirect to `/onboarding` (except profile/billing).
- Free vs Pro limits (config): Free = 5 saved docs, 10 AI messages/day, 2 SOP reviews/month, match results limited to top 30; Pro = unlimited. (All limits adjustable in `core/config.py`.)

---

## 13. FRONTEND PAGES — what to build and how to improve each prototype

Global UI: sidebar (collapsible; bottom tab bar on mobile), topbar with global search (⌘K command palette searching scholarships, templates, pages), notification bell with unread count, dark-mode toggle, toasts, skeleton loaders, empty states with illustrations, accessible forms, keyboard focus rings.

### 13.1 Landing (`updated_idex.html` → `/`)
Hero with search-like CTA ("Find scholarships that fit you in 2 minutes"), live counters from `/api/public/stats` (scholarships, universities, countries), how-it-works (3 steps), featured scholarships, testimonials (static), pricing, FAQ, footer. Sign up / Login buttons.

### 13.2 Auth pages
Login, Register (with referral code from `?ref=`), Forgot/Reset password, Verify email notice. Admin login separate (Section 12).

### 13.3 Dashboard (`home.html`)
Cards: profile completeness %, "Your top 5 matches" (from engine), deadlines this month (from saved/tracked), application pipeline (mini kanban counts), quick actions (Write SOP, Check marks, Ask advisor), latest notifications, progress ring for checklist. Chart of selection ratio of saved scholarships.

### 13.4 Matched Results (`scholarships.html` upgraded) — `/scholarships`
- Header chip row showing the active profile filters (editable: click a chip to change quickly, "Edit preferences" button).
- Left refine panel (desktop) / bottom sheet (mobile): host country, field, funding type (Fully/Partial), tuition covered %, stipend range, deadline range, duration, search box, "Only show open deadlines".
- Card grid/list toggle, sort dropdown, pagination or infinite scroll, result count, "Save" heart, "Compare" checkbox (max 3 → floating compare bar).
- Selection-ratio mini bar on each card.
- Empty state: explains which rule removed results ("Your IELTS choice allows tiers up to 6+") and offers a one-click "Relax IELTS to 7+".
- "Why am I seeing this?" tooltip per card (explains matching rule used).

### 13.5 Scholarship Detail — Section 14.
### 13.6 Saved (`/saved`) — list with notes, remove, move to tracker.
### 13.7 Tracker (`tracker.html`) — kanban (drag & drop with `@dnd-kit`) + table view; columns by status; card shows deadline countdown; add notes and next step date; sync with notifications.
### 13.8 Checklist (`checklist.html`) — global + per-scholarship; "Generate from scholarship" builds a list from required documents and flags (attestation, medical certificate, police clearance, account required, local language test); progress bar; due dates.
### 13.9 Templates & My Documents — Section 15.
### 13.10 SOP Reviewer (`sop-reviewer.html`) — textarea or select one of my documents; target scholarship picker; button "Review"; shows score ring, sub-scores (structure, clarity, goals, evidence, grammar, fit-with-scholarship), highlighted suggestions list, "Apply suggestion" buttons; history of past reviews. Calls `/ai/sop-review` (stub gives deterministic fake output — keep the old word-count logic as the stub). Word counter + character limit hint.
### 13.11 Advisor (`advisor.html`) — real chat UI: sessions list, streaming messages (SSE), markdown rendering, suggested prompts ("Am I eligible for this scholarship?", "Compare my saved scholarships", "Make a 6-month plan"), optional context chip "Talking about: <scholarship>", copy and thumbs up/down, attachments of one of my documents. Right panel shows profile summary (from the old prototype). Calls `/ai/chat`.
### 13.12 Visa & Travel (`visa-travel.html`) — pick country → steps timeline, document list, cost estimates, official links, interactive checklist that saves to checklist API.
### 13.13 Notifications — list with filters (All, Deadlines, System, Payments), mark read.
### 13.14 Profile — tabs: Personal, Academic (GPA calculator), Preferences (all onboarding answers, editable), Security (password), Plan.
### 13.15 Referral — link, copy button, progress, rewards (e.g. 3 referrals = 1 month Pro).
### 13.16 Billing — plan cards, checkout button, history.
### 13.17 Extra pages to add (useful features)
- **Compare scholarships** (`/scholarships/compare?ids=1,2,3`).
- **Deadline calendar** (month view + .ics export).
- **GPA/Marks calculator** public tool.
- **Eligibility checker** on each detail page ("Can I apply?" uses profile vs `min_degree_required`, `graduation_window`, `final_year_students_can_apply`, IELTS tier).
- **Cost & funding calculator** (grant + stipend × duration).
- **Success stories** (static).
- **Help center / FAQ** (static MDX).
- **Language switch** (English now; Urdu structure with i18n files ready).

---

## 14. SCHOLARSHIP DETAIL PAGE (`/scholarships/[id]`) — from `scholarship_detail_template.html`

Turn the `{{placeholders}}` template into a real React page that fetches `GET /api/scholarships/{id}`. Show **every column** in a clean, sectioned layout. Keep the original template's naming idea (title header, description box, metric tiles) but expand it.

**Header**: title, university — host country (flag), badges (Level, Fully/Partial, IELTS tier), buttons: ❤ Save, ➕ Add to tracker, 🔗 **Apply / Official link** (`application_url` or fallback search link), 🤖 Ask AI about this, ⇄ Compare, 🖨 Print/PDF.

**Sections & fields (placeholder → DB column):**

| Section | Fields |
|---|---|
| About | `{{short_description}}` → `description_html` (sanitized) |
| Key facts tiles | Course level `level`; Duration `duration_months` months; Intake `intake_term`; Cycle `cycle_status`; Deadline (`deadline_date` with live countdown, or text for rolling/anytime/unspecified); Rolling admission; Language of instruction `source_language` |
| Funding | `scholarship_type`, `funding` (text), `grant_amount_formatted`, `grant_amount_numeric` + `grant_currency`, `tuition_covered`% (progress bar), monthly stipend (`stipend_monthly_amount` + `stipend_currency`, and `stipend_monthly_usd`), `total_funding_score` (stars/bar), health insurance (+note), language course (+note), dependants allowance, return obligation (`return_obligation_details`) |
| Work rules | `work_allowed_during_study`(+note), `work_hours_limit_per_week` |
| Eligibility | `min_degree_required`, `degree_field_restriction`, `graduation_window`, `final_year_students_can_apply`, fields (`fields_list` as chips), `disciplines`, `research_areas_open`, **IELTS** (`IELTS_required`, band), `local_language_test`, `nominating_body_pk` |
| Application requirements | `account_required`, `attestation_required`(+note), `medical_certificate_required`, `police_clearance_required`, `documents_list` as a checkbox list with button **"Add all to my checklist"**, `notification_method` |
| **Competition & chances** | `scholarship_count_estimate` = **seats available**; `total_applicants_estimate`; `pakistan_applicants_estimate` = **Pakistani applicants (est.)**; `pakistan_selected_estimate` = **Pakistani candidates selected (est.)**; **Selection ratio** = `selected / applicants` shown as a big % in a green box (like the template's "Pakistani Acceptance Chance"), a small donut chart, and the sentence "About 1 in N Pakistani applicants was selected." Always label "Estimates" |
| Apply | Big **Apply now** button, deadline reminder toggle ("Remind me 7 / 3 / 1 days before") |
| Helpers | "Write documents for this scholarship" → opens template gallery with `?scholarship_id=` pre-linked; "Similar scholarships" carousel; "Ask AI" drawer |

Hide any row whose value is empty/None. Use friendly units (`$40,000`, `24 months`). Show "Estimate" tooltips for estimated numbers.

---

## 15. TEMPLATES MODULE (interactive + saved per user)

### 15.1 Concept
A template = rich-text document body with `{{placeholders}}` + a **form schema** that asks the student short questions. As they type answers on the left, the document **updates live on the right** (split view). They can then freely edit the document in the TipTap editor. **Save** stores it in the database for that user.

### 15.2 Flow
1. `/templates` gallery: category tabs, search, "Popular" badge, free/premium lock.
2. Click template → `/templates/[slug]` editor page:
   - Left: step-by-step form (fields from `fields_json`), "Auto-fill from my profile" button (name, degree, field, country, GPA).
   - Optional dropdown "For scholarship: ___" (fills university, program, scholarship name automatically).
   - Right: live preview = TipTap editor, toolbar (bold, italic, headings, lists, undo/redo), word counter and target-length hint (e.g. "SOP: 500–800 words").
   - Buttons: **Save** (also autosave every 20 s as draft), **Save as new**, **Export** (DOCX/PDF/TXT), **Copy**, **AI: Improve** (selected text), **AI: Fill from my answers** (stub), **Review with SOP Reviewer**.
3. **Saving**: `POST /documents` (first time) then `PUT /documents/{id}`. Body: `title, template_id, scholarship_id, content_html, content_json, placeholders_json, status`. Server creates a `document_versions` snapshot each save. The document appears in **My Documents** (`/templates/my-documents`) with search, filters (type, scholarship, status), rename, duplicate, delete, version history with restore.
4. Reopening a saved document restores both the form answers and the edited text.

### 15.3 Templates to seed (`services/templates_seed.py`) — write real, useful content for each (150–400 words of body with placeholders and 6–15 form fields)

**Core application documents**
1. Statement of Purpose (Master's)
2. Statement of Purpose (PhD, research-focused)
3. Personal Statement (Undergraduate / Bachelor's)
4. Motivation Letter (scholarship)
5. Study Plan (year-by-year / course plan)
6. Research Proposal (1–2 page outline: title, background, question, method, timeline, references)
7. Academic CV / Resume (education, research, projects, awards, skills)
8. One-page Resume (internships/jobs)
9. Scholarship Essay – "Why do you deserve this scholarship?"
10. Leadership & Community Service Essay
11. Financial Need Statement
12. Career Goals & Return-Plan Statement (for scholarships with return obligations)
13. Diversity / Overcoming Challenges Essay

**Letters & emails**
14. Recommendation Letter (for a professor to write — pre-filled structure)
15. Recommendation Request Email (to professor / employer)
16. Cold Email to Professor / Supervisor (PhD & research scholarships)
17. Email to Scholarship Office (asking a question)
18. Application Follow-up Email
19. Offer Acceptance Email
20. Offer Decline / Withdrawal Email
21. Deadline Extension Request
22. Deferral Request Letter
23. Gap Explanation Letter
24. IELTS Waiver Request / Medium-of-Instruction Certificate Request (to university)
25. Thank-You Email after Interview

**Visa & travel**
26. Visa Statement of Purpose / Cover Letter
27. Statement of Ties to Home Country
28. Sponsor / Financial Support Letter
29. Travel & Accommodation Plan
30. Embassy Appointment Checklist letter (simple)

Categories: `Essays`, `Letters`, `Emails`, `CV`, `Research`, `Visa`. Mark ~10 as `is_premium`. Each template has: `slug, title, category, description, body_html, fields_json, recommended_word_range, tips[]` ("Do / Don't" list shown in a side panel).

`fields_json` example:
```json
[
  {"key":"full_name","label":"Your full name","type":"text","required":true,"from_profile":"full_name"},
  {"key":"program","label":"Program you are applying to","type":"text","required":true},
  {"key":"why_field","label":"Why this field? (2–3 sentences)","type":"textarea","hint":"Tell a real moment that sparked your interest"},
  {"key":"achievement_1","label":"Your biggest achievement","type":"textarea"}
]
```
Rendering: replace `{{key}}` with the answer; if empty show a highlighted `[key]` chip so the student sees what is missing.

---

## 16. AI INTEGRATION LAYER (where YOU plug in the APIs)

The user will add different AI APIs later. Build a **provider-agnostic layer** now with working stubs.

```
backend/app/services/ai/
├── base.py            # abstract class AIProvider
├── registry.py        # picks provider from env AI_PROVIDER=mock|openai|anthropic|gemini|groq|custom
├── mock_provider.py   # works offline, deterministic (default)
├── openai_provider.py     # skeleton: TODO(API KEY) marked
├── anthropic_provider.py  # skeleton
├── gemini_provider.py     # skeleton
├── custom_http_provider.py# calls any REST endpoint set by AI_CUSTOM_URL
├── prompts.py         # ALL system prompts in one file (editable)
├── rag.py             # retrieval over scholarships (keyword now, embeddings later)
└── tools.py           # functions the model may call (search_scholarships, get_scholarship, get_profile)
```

### 16.1 Interface (every provider implements)
```python
class AIProvider(ABC):
    async def chat(self, messages: list[Msg], context: dict, stream: bool=False) -> AsyncIterator[str] | str: ...
    async def review_sop(self, text: str, scholarship: dict|None, profile: dict) -> SopReview: ...
    async def improve_text(self, text: str, instruction: str) -> str: ...
    async def fill_template(self, template: dict, answers: dict, profile: dict) -> str: ...
    async def explain_scholarship(self, scholarship: dict, profile: dict) -> str: ...
    async def eligibility_check(self, scholarship: dict, profile: dict) -> EligibilityResult: ...
    async def classify_country(self, university_name: str) -> str: ...
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
```
`SopReview` = `{score:0-100, sub_scores:{structure,clarity,goals,evidence,grammar,fit}, strengths:[], issues:[{quote,problem,suggestion}], rewritten_intro:str}`.

### 16.2 The mock provider
- `chat`: answers from the DB with simple rules (detects words like *deadline, ielts, eligible, documents, fully funded* and replies using real scholarship data) and ends with "(Demo AI — connect a real provider in `.env`)".
- `review_sop`: keep the old word-count/keyword scoring from `sop-reviewer.html`, expanded to return the full `SopReview` structure.

### 16.3 Where AI is used (hook list — also written into `docs/AI_INTEGRATION.md` with file paths)
| Feature | Endpoint | Provider method | Prompt in `prompts.py` |
|---|---|---|---|
| Advisor chatbot | `/ai/chat` | `chat` | `ADVISOR_SYSTEM` (+ profile + retrieved scholarships as context) |
| Scholarship Q&A (RAG) | `/ai/chat` w/ `scholarship_id` | `chat` + `rag.py` | `SCHOLARSHIP_QA_SYSTEM` |
| SOP Reviewer | `/ai/sop-review` | `review_sop` | `SOP_REVIEW_SYSTEM` (must return JSON) |
| Improve selected text | `/ai/improve-text` | `improve_text` | `IMPROVE_SYSTEM` |
| Fill template from answers | `/ai/fill-template` | `fill_template` | `FILL_TEMPLATE_SYSTEM` |
| Explain a scholarship simply | `/ai/explain-scholarship/{id}` | `explain_scholarship` | `EXPLAIN_SYSTEM` |
| Eligibility check | `/ai/eligibility-check` | `eligibility_check` | `ELIGIBILITY_SYSTEM` |
| Country mapping helper | script / admin | `classify_country` | `COUNTRY_SYSTEM` |
| Semantic search & recommendations (future) | `/scholarships?semantic=1` | `embed` | — |
| Document grammar check (future) | `/ai/improve-text` | `improve_text` | — |

### 16.4 To switch on a real AI
1. Put the key in `backend/.env` (`OPENAI_API_KEY=…` etc.) and set `AI_PROVIDER=openai`.
2. Open the provider file, fill the clearly marked `# >>> PLUG YOUR API CALL HERE <<<` block.
3. Restart. No other code changes. (This must be written step-by-step in README.)
Add per-user daily quota checks and log token usage in `chat_messages.tokens`.

**Safety rules in prompts**: never promise admission; always say numbers are estimates; do not invent scholarships — only use retrieved records; refuse to write fake documents/forged credentials; keep answers short and friendly.

---

## 17. EXTRA FEATURES TO INCLUDE (brainstormed — build them in this priority)

**Must (v1):** onboarding + matching, detail page, auth + admin, saved, tracker, checklist, templates + my documents, SOP reviewer (stub), advisor chat (stub), notifications, profile, GPA calculator, billing skeleton, referral, visa guides, admin CRUD + CSV import, docs.

**Should (v1.1):** compare, deadline calendar + .ics, eligibility checker, cost calculator, email notifications (SMTP stub), PWA install, dark mode, command palette, scholarship share link (public read-only page), print/PDF of detail page.

**Could (v2):** semantic search with embeddings, document upload & vault (S3), interview-prep Q&A bot, scholarship-alert emails/WhatsApp, mentor marketplace, Urdu UI, mobile app wrapper, analytics A/B tests.

---

## 18. ADMIN PANEL

Dark-themed, under `/admin`. Pages:
1. **Dashboard** – total users, new today, pro users, scholarships, saved count, AI calls, revenue; line chart (signups/day), bar chart (top 10 saved scholarships), table of latest signups.
2. **Scholarships** – table with server-side search/filter/sort, inline edit drawer for *all* columns (including `application_url`, `host_country`, `is_active`), bulk activate/deactivate, **Import CSV** (upload → preview of first 20 rows → validation report → confirm), **Export CSV**.
3. **Data Quality** – unmapped universities, missing deadlines, missing URLs, rows with required IELTS but empty band; one-click fix inputs.
4. **Users** – search, view profile/onboarding answers, activate/deactivate, change plan, impersonate-view (read-only), reset onboarding.
5. **Templates** – CRUD with live preview and field-schema JSON editor.
6. **Payments** – list, filter, refund note, manual plan grant.
7. **Announcements** – title/body/link → broadcast notification.
8. **Settings** – feature flags, free-tier limits, AI provider status (shows which provider is active, never shows keys).
9. **Audit log** viewer.

---

## 19. PAYMENT GATEWAY GUIDE (build skeleton + write `docs/PAYMENTS.md`)

Where it lives: `backend/app/routers/billing.py` and `backend/app/services/payments/` with one file per provider implementing `PaymentProvider` (`create_checkout(user, plan) -> url`, `verify_webhook(request) -> Event`).

Plans (config): `free`, `pro_monthly` ($5), `pro_yearly` ($40). Prices in `core/config.py`.

Provider options to document and stub:
- **Stripe** (international cards): create Checkout Session → redirect → webhook `checkout.session.completed` → set `user.plan='pro'`, `plan_expires_at`. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`.
- **Pakistan local options** (document as alternatives, same interface): Safepay, JazzCash, Easypaisa, PayFast Pakistan — each gets a stub file with a `# >>> PLUG GATEWAY CODE HERE <<<` block and the generic redirect + webhook pattern.
- **Manual bank transfer / screenshot proof** (fallback): user uploads proof → admin approves in Payments page → plan granted.

Rules: verify webhook signatures; make webhook handler idempotent (unique `provider_ref`); never trust the frontend for payment success; log everything in `payments`. In the README, include a 6-step "Add Stripe in 15 minutes" guide and a test-card note.

Frontend: `/billing` page with plan cards → `POST /billing/checkout` → redirect. Success and cancel pages. Feature gating helper `requirePro()` in backend deps and `<ProGate>` component in frontend.

---

## 20. SECURITY, QUALITY, TESTING, DEPLOYMENT

**Security**: bcrypt, JWT in httpOnly secure cookies, CSRF protection for cookie auth (double-submit token), CORS allowlist, rate limiting, input validation everywhere (Pydantic/zod), HTML sanitization (`bleach`/`nh3`) for scholarship descriptions and user documents, SQL via ORM only, secrets only in env, admin routes require role check, audit logs, account deletion that really deletes personal data, security headers (via Next.js `headers()` and Nginx).

**Testing**: pytest coverage target ≥ 80% on `services/`; API tests for auth, match, documents CRUD (including "user A cannot read user B's document"); frontend: Vitest for utils + Playwright smoke test (register → onboarding → results → open detail → save document).

**Deployment guide (`docs/DEPLOYMENT.md`) must cover:**
1. Local: venv/Docker steps, `make seed`.
2. Production env variables table (every variable, purpose, example).
3. Option A (simple): one VPS (Ubuntu) — Docker Compose with `postgres`, `backend`, `frontend`, `nginx`; Let's Encrypt via certbot; firewall; backups (`pg_dump` cron); log rotation.
4. Option B (managed): Backend on Render/Railway/Fly.io, Postgres on Neon/Supabase/Railway, Frontend on Vercel; env mapping; CORS and cookie-domain settings.
5. Running Alembic migrations on deploy; first admin creation; importing the CSV in production.
6. Monitoring (Sentry optional), health checks, uptime, scaling notes.
7. Release checklist.

---

## 21. DOCUMENTS THE AGENT MUST WRITE (inside the project)

1. **`README.md`** with, in this order: project intro + screenshot placeholders; feature list; **Tech stack table**; **Project structure tree**; **Quick start** (Docker and manual); environment variables; how matching works (short); **"Where to integrate AI" section** (table from 16.3 with exact file paths and the 3 steps from 16.4); **"Payments" section** (link + short steps); **Deployment summary**; testing; API overview link; admin guide; contributing; license; **Progress section**:
   ```
   ## Progress (updated by the agent after every step)
   - [x] Step 1 — Repo skeleton created (date)
   - [ ] Step 2 — ...
   ```
2. **`docs/PROGRESS.md`** – dated log: what was done, what's next, known issues. Append after every milestone.
3. **`docs/SRS.md`** – Software Requirements Specification (IEEE-style, simple): 1 Introduction (purpose, scope, definitions), 2 Overall description (users, environment, assumptions), 3 Functional requirements (numbered `FR-001…`, one per feature in this prompt), 4 Non-functional requirements (performance: match query < 500 ms for 10k rows; security; usability; availability; accessibility WCAG AA), 5 External interfaces (UI, API, AI providers, payment providers, email), 6 Data requirements (ER summary, CSV rules), 7 Use cases (student onboarding, save document, admin import), 8 Acceptance criteria, 9 Risks, 10 Future work.
4. **`docs/ARCHITECTURE.md`** – diagram in Mermaid (client → Next.js → FastAPI → DB; FastAPI → AI providers / payment / email), folder responsibilities, request flow of "match scholarships".
5. **`docs/DATABASE.md`** – tables + Mermaid ER diagram.
6. **`docs/API.md`**, **`docs/MATCHING_LOGIC.md`**, **`docs/AI_INTEGRATION.md`**, **`docs/PAYMENTS.md`**, **`docs/DEPLOYMENT.md`**, **`docs/DECISIONS.md`** (log of every improvised decision, with the ones in this prompt pre-filled).

---

## 22. BUILD ORDER (follow exactly; test after each; update PROGRESS.md after each)

| # | Milestone | Done when |
|---|---|---|
| 1 | Repo skeleton, Docker, Makefile, env files, docs stubs | `docker compose up` shows blank API `/health` and Next.js home |
| 2 | DB models + Alembic + `import_csv.py` + country map | DB has 9,338 scholarships, report shows unmapped count |
| 3 | Auth (register/login/refresh/me/admin login/create_admin) | tests green |
| 4 | `gpa.py` + `matching.py` + all 10 tests + `/scholarships/match`, `/meta/*` | tests green |
| 5 | Scholarship list/detail/similar/compare endpoints | curl returns detail with all fields |
| 6 | Frontend base: layout, design system, auth pages, API client, route guards | can register, log in, see empty dashboard |
| 7 | Onboarding wizard + calculator | finishing wizard saves profile, redirects to results |
| 8 | Results page + refine panel + cards + selection ratio | numbers match the engine |
| 9 | Detail page (Section 14) | every field displays; apply link works |
| 10 | Saved + Tracker + Checklist + Notifications | working end-to-end |
| 11 | Templates seed + gallery + editor + live preview + save to DB + My Documents + versions + export | doc saved by user A is invisible to user B |
| 12 | AI layer (mock) + Advisor chat + SOP reviewer + improve text | works offline with mock |
| 13 | Visa, Referral, Profile, Billing skeleton | pages render with real data |
| 14 | Admin panel (all pages in Section 18) | admin can import CSV and edit a scholarship |
| 15 | Landing page, SEO meta, sitemap, polish (dark mode, skeletons, a11y) | Lighthouse ≥ 90 |
| 16 | Tests (backend ≥80% services, Playwright smoke), CI | green pipeline |
| 17 | Final docs: README, SRS, API, DEPLOYMENT, PAYMENTS, AI_INTEGRATION | all files present, links valid |

---

## 23. DESIGN SYSTEM QUICK SPEC

- Fonts: Inter (UI), Plus Jakarta Sans for headings.
- Colors: primary `#26736b`, primary-dark `#1f625b`, primary-soft `#e8f3f1`, bg `#f8faf9`, ink `#1a2e2c`, muted `#64748b`, border `#e2e8f0`, success `#28a745`, warning `#f59e0b`, danger `#d9534f`. Admin theme: slate-900 sidebar with amber accent.
- Radius 12–18 px cards, soft shadow, 8-px spacing grid, buttons ≥ 44 px tall on mobile.
- Chance labels: green (Good), amber (Moderate), rose (Competitive).
- Every list has: loading skeleton, empty state, error state with retry.
- All forms: inline validation messages, disabled state while submitting.

---

## 24. ACCEPTANCE TEST (the agent runs this at the end and records result in PROGRESS.md)

1. Register a new student → onboarding: origin Pakistan, Master's, host = Germany/Canada, field = Engineering & Technology, IELTS = 7+, CGPA 3.4 (4.0 scale), funding = stipend, nice-to-haves ticked.
2. Results show only Master rows in those countries, tiers 0–2 (GPA 3.4 ≥ 3.2 and < 3.6 → cap 2), including "General / Any Field" rows. Changing funding preference or origin country does **not** change the count.
3. Change IELTS to "not taking" → only no-IELTS scholarships remain.
4. Switch level to Bachelor's → marks calculator appears; enter 900/1100 → ≈ 81.8% → ≈ 3.74 → full tiers.
5. Open a scholarship → all fields visible; selection ratio equals `selected/applicants`.
6. Open Templates → "Statement of Purpose" → fill answers → live preview updates → Save → reload page → it is in My Documents with answers restored → export DOCX works → second user cannot access it.
7. Advisor answers a question about deadlines using real data (mock provider).
8. Admin logs in at `/admin/login`, edits a scholarship's `application_url`, student's detail page shows the new link.
9. All tests pass; `docker compose up` works from a clean clone.

---

## 25. DECISIONS ALREADY MADE FOR YOU (copy into `docs/DECISIONS.md`)

1. Host country derived via university map because CSV lacks it.
2. Application URL added as nullable admin-editable column with search-link fallback.
3. IELTS non-cleaned column used (cleaned one dropped 8+).
4. GPA gating uses tier caps; thresholds per level in config; "7+ sees all" kept as flag, default off.
5. Origin country, funding preference, and nice-to-haves are stored only, never filter.
6. Duplicates by title are kept (different ids).
7. Selection ratio recomputed from counts; CSV percentage stored for reference.
8. Tokens in httpOnly cookies, not `localStorage`.
9. SQLite for dev, PostgreSQL for production.
10. AI defaults to a mock provider so the product demos without any API key.

---

**END OF PROMPT.** Begin with Milestone 1. After each milestone, update `docs/PROGRESS.md` and the Progress checklist in `README.md`. When all milestones are done, run the acceptance test in Section 24 and report the result.
