# Software Requirements Specification

## 1. Introduction

Scholario helps students discover scholarships they may qualify for and organize applications. This specification follows the master build prompt and is updated as milestones are implemented.

## 2. Overall description

Actors are visitors, students, scholarship administrators, and operators. The system runs as a Next.js web app and a FastAPI service backed by SQLite locally or PostgreSQL in production. Scholarship CSV records are the catalog source of truth.

## 3. Functional requirements

- FR-001: Visitors can view public information and scholarship tools.
- FR-002: Students can register, authenticate, and manage their account securely.
- FR-003: Students can complete and edit a profile/onboarding wizard.
- FR-004: Students can browse, filter, match, and inspect scholarships.
- FR-005: Students can save scholarships and track applications.
- FR-006: Students can create checklist items and receive notifications.
- FR-007: Students can create, save, version, and export application documents.
- FR-008: Students can use mock-backed AI advisor and SOP review tools.
- FR-009: Admins can import and curate scholarships and manage product data.
- FR-010: Operators can configure and monitor payment/provider integrations.

## 4. Non-functional requirements

Target match responses below 500 ms for a 10k-row catalog; validate all inputs; protect private student data; provide accessible, responsive interfaces; maintain migrations and automated tests; support local offline AI stubs.

## 5. External interfaces

Browser UI through Next.js, JSON API through FastAPI/OpenAPI, AI and payment provider adapters, and CSV import/export.

## 6. Data requirements

Retain every CSV scholarship row and source identifier; normalize booleans, list fields, IELTS, deadlines, selection ratio, and host country. Keep user-owned documents and application data private.

## 7. Use cases

Student onboarding and matching; saving and tracking a scholarship; authoring and exporting a document; admin CSV import.

## 8. Acceptance criteria

The detailed end-to-end acceptance flow is in Section 24 of `SCHOLARIO_MASTER_PROMPT.md`; implementation and test status is tracked in `PROGRESS.md`.

## 9. Risks

Source scholarship data may be stale or incomplete; host-country inference may be uncertain; estimated selection ratios are not individual probabilities; external providers may be unavailable.

## 10. Future work

See product priorities in Sections 17–22 of the master prompt.