# Decisions

Decisions from the master build prompt:

1. Derive host country from a university-country map because the CSV has no country column.
2. Keep `application_url` nullable and admin-editable; when absent, link to a clearly labeled search fallback.
3. Use the non-cleaned IELTS band column because the cleaned column lost 8+ values.
4. Gate IELTS tiers by GPA thresholds per degree level. `taking_7` does not include tier 3 by default; expose a configuration flag.
5. Store origin country, funding preference, and nice-to-haves without using them as match filters.
6. Keep rows with duplicate titles when scholarship IDs differ.
7. Recompute selection ratio from Pakistani selected/applicant counts and retain the source percentage for comparison.
8. Keep access tokens in httpOnly cookies; do not store auth tokens in `localStorage`.
9. Use SQLite locally and PostgreSQL in production via `DATABASE_URL`.
10. Default AI features to an offline mock provider.

## Implementation decisions

- New application source lives in `frontend/` and `backend/`; the canonical scholarship CSV and generated country map live in `backend/data/`, and legacy reference pages live in `frontend/prototype/`.
- Milestone 1 uses a minimal health endpoint and landing page; product workflows are delivered in subsequent milestones.
- Database university-country rows are authoritative after initial CSV seeding, so administrator corrections survive later scholarship re-imports.
- Use Next.js 16 and Tailwind 4 with the patched Tiptap 3 line; the production dependency audit is kept at zero known vulnerabilities.
- Access tokens are revoked server-side with a `jti` denylist (`revoked_access_tokens`) written on logout and checked in `get_current_user`, so logout invalidates a copied access token immediately instead of waiting for its 30-minute expiry; expired rows are purged opportunistically.
- On session expiry the API client clears the cookies via `POST /api/auth/logout` before redirecting to `/login` (admin routes: `/admin/login`), which keeps the cookie-presence middleware from bouncing the user back, and a `sessionStorage` flag ensures only one redirect per expiry.
- Roles are `student`, `consultant`, and `super_admin`; the legacy `admin` role is migrated to `super_admin` (migration `0011`). The existing `/admin` panel requires `super_admin`, and a new `/consultant` panel requires `consultant`. Consultant accounts are created only by a super admin (via the panel or `scripts/create_consultant.py`), never through public signup.
- Scholarships carry an `owner_id`. Consultants may create, edit, delete, and export only the scholarships they own; super admins can manage every listing and reassign ownership. Ownership checks return `404 SCHOLARSHIP_NOT_FOUND` for non-owners so record existence is not leaked.
- Staff sign-in requires credentials plus, when enabled, a TOTP second factor (`pyotp`). Fifth-factor failures are lockout-tracked in `auth_attempts` (5 failures / 15 minutes → `429 AUTH_LOCKED`). Recovery codes are stored hashed and consumed on use.
- Suspicious consultant activity (delete/edit/import bursts) is detected by `app/services/anomaly.py` and raises deduplicated `ConsultantWarning` rows; super admins can also issue manual warnings. Consultants see and acknowledge their warnings under `/consultant/warnings`.