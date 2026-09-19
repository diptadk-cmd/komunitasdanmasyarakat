# Threat Model

## Project Overview

Jak Sanggar is a React + Vite PWA with an Express 5 API and a MariaDB/MySQL database. All roles (`kurator`, `admin`, `sanggar`, `pelatih`, `seniman`, `juri`, and `sewa`) use an HttpOnly session cookie (`jak_session`) issued by the API. The frontend keeps a synchronized local cache for resilience and demo content, but real account passwords are never persisted there. Local password fallback is restricted to the explicitly seeded demo usernames on localhost.

The production target is a VPS deployment behind Nginx as documented in `artifacts/jak-sanggar/deploy/BACKEND.md`. `artifacts/mockup-sandbox` is a dev-only artifact and should be ignored for production scans unless a concrete production path reaches it.

## Assets

- **User accounts and sessions** — usernames, password hashes, session tokens, and role assignments. Compromise allows impersonation or privileged access across sanggar/admin/kurator workflows.
- **Operational and profile data** — sanggar profile data, membership information, training records, finance-related data, and certification/curation records. Some of this is still local-first, but any server-backed portion becomes multi-user production data.
- **Uploaded files** — profile photos, galleries, and supporting documents stored through `/api/uploads` and object storage. These may contain PII, legal documents, or attacker-supplied active content.
- **Global settings** — singleton settings such as `kurasiMatrix` and any future server-backed configuration keys. Sensitive settings must never leak through the public settings endpoint.
- **Infrastructure secrets and storage credentials** — MariaDB connection strings, S3/MinIO credentials, and any deployment environment variables.

## Trust Boundaries

- **Browser to API** — all `/api/*` requests cross from an untrusted browser into the trusted server. The API must authenticate and authorize every access to server-backed data.
- **API to MariaDB** — the API has direct read/write access to users, sessions, uploads, and settings tables. Any authz or query flaw here exposes the whole backing store.
- **API to object storage** — the API stores and retrieves uploaded objects from S3/MinIO or a local fallback. Authorization must be enforced before any object metadata or bytes are returned.
- **Public vs authenticated vs admin/kurator surfaces** — `/api/settings` is public, auth endpoints are public-write, and `/api/users`, `/api/uploads`, and `/api/settings/:key` are protected. Server-side role checks are the real boundary; UI-only hiding is not.
- **Server state vs browser cache** — synchronized collections can be cached in localStorage for offline resilience. The API remains authoritative for shared data and must validate both collection scope and role on every write.

## Scan Anchors

- Production backend entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, and `artifacts/api-server/src/routes/*.ts`.
- Highest-risk backend areas: auth/session code in `artifacts/api-server/src/lib/auth.ts` and `artifacts/api-server/src/middlewares/auth.ts`; upload/storage code in `artifacts/api-server/src/routes/uploads.ts` and `artifacts/api-server/src/lib/storage.ts`; startup/bootstrap in `artifacts/api-server/src/lib/seed.ts`.
- Highest-risk frontend boundary files: `artifacts/jak-sanggar/src/lib/auth.tsx`, `artifacts/jak-sanggar/src/lib/store.ts`, and `artifacts/jak-sanggar/src/lib/api.ts`.
- Usually dev-only/out of scope: `artifacts/mockup-sandbox`, Replit-only preview behavior, and local-only state mutations that do not cross into shared server-backed data.

## Threat Categories

### Spoofing

The application relies on a database-backed session cookie rather than signed JWTs. The system must ensure only legitimate users can obtain sessions and that demo/bootstrap credentials do not remain usable in production. Session tokens must stay unpredictable, tied to active accounts, and invalidated when account access is revoked.

### Tampering

The client remains partially local-first, so the server must never trust role, profile, or workflow state that originates only from browser storage. Any server-backed writes — especially user updates, settings changes, and upload metadata — must be validated and authorized server-side. Uploaded files must not become a vehicle for attacker-controlled active content to tamper with users' sessions or UI state.

### Information Disclosure

The API stores user profiles, uploaded files, and settings that may contain sensitive business or personal data. File metadata and raw downloads must be scoped to authorized viewers, public settings responses must exclude sensitive keys, and logs/error responses must avoid leaking credentials, cookies, or storage secrets.

### Denial of Service

The public auth surface and upload surface can be abused for repeated login/OTP attempts or oversized/malformed uploads. Login, registration, and password-reset requests are rate-limited; each OTP is short-lived and has a five-attempt ceiling. Deployments with more than one API process should replace the in-memory rate-limit store with a shared store such as Redis so limits apply across instances.

### Password-reset abuse

Reset responses must not reveal whether a phone number is registered. OTP values are bcrypt-hashed at rest, expire after ten minutes, and can only mint a single short-lived reset token whose SHA-256 digest is stored. Successful reset consumes the challenge and revokes every active session for that user. Production requires a configured WhatsApp webhook; the development-only OTP exposure flag is ignored whenever `NODE_ENV=production`.

### Elevation of Privilege

The main elevation risks are broken object-level authorization, weak account lifecycle controls, and any place where the hybrid frontend/server model lets a lower-privilege user act beyond their role. Kurator/admin-only actions must be enforced on the server, disabled accounts must lose access promptly, and uploaded content must not execute in the application's origin where it can call privileged APIs with the victim's session.
