# ADR-0005: Authentication, Cryptographic Password Hardening (Argon2id) & Role-Based Access Control (RBAC)

- **Status:** Accepted

- **Context:**
**FlowGuard** exposes critical industrial operations across distinct actor personas: Plant Operators (`OPERATOR`) who monitor conveyor health and acknowledge anomaly alerts, Industrial Engineers (`ENGINEER`) who configure plant sectors, conveyor lines, and threshold rules, and System Administrators (`ADMINISTRATOR`) who manage user accounts and security governance (`01-problem-statement.md`, §3; `02-context.md`, §3). Additionally, automated edge gateways ingest telemetry bursts over HTTP.

In alignment with OWASP Top 10 security standards and our engineering rules (KB §9.4, §13.5, §16.1), the security architecture must address four core requirements:
1. **Stateless REST Compliance:** The authentication mechanism must respect the 4th principle of REST (*Communicate Statelessly*, KB §8.2) so the server never retains client session state in memory between requests.
2. **State-of-the-Art Password Storage:** User credentials must be protected against offline GPU/ASIC brute-force cracking and side-channel timing attacks in the event of a database breach (KB §9.4, §16.1).
3. **Strict Server-Side Access Control & Anti-Privilege Escalation:** Role permissions must be verified on every protected endpoint at the server boundary, and user registration/update payloads must be strictly immune to *Mass Assignment* attacks (KB §9.4, Rule 1; §16.1).
4. **Anti-Enumeration Defense:** Authentication failures must never leak whether an email address or username is registered in the system (KB §9.4, Rule 3).

- **Decision:**
We adopt **Stateless JSON Web Tokens (JWT — RFC 7519)** for sessionless authentication, **Argon2id** for cryptographic password hashing, and declarative **Role-Based Access Control (RBAC)** guards at the NestJS routing perimeter (KB §9.4, §13.5, §16.1):

1. **Stateless JWT Authentication (`Authorization: Bearer <token>`):**
   - Upon successful credential verification at `POST /api/v1/auth/login`, the server issues a signed JWT containing immutable identity claims (`sub`: User UUID, `email`, `role`: `OPERATOR | ENGINEER | ADMINISTRATOR`, `iat`, `exp`) signed with a high-entropy `JWT_SECRET` environment variable and a strict expiration window (e.g., `expiresIn: '8h'` matching an industrial shift) (KB §9.4).
   - Protected routes validate the token signature and expiration via a NestJS `JwtAuthGuard` without querying the database on every request (KB §9.4, Rule 4).

2. **Cryptographic Password Hardening via Argon2id (`argon2`):**
   - Passwords are never stored or logged in plaintext. We use **Argon2id** (winner of the Password Hashing Competition and the primary recommendation of the OWASP Password Storage Cheat Sheet) rather than legacy `bcrypt`/`bcryptjs` (`ADR-0002`; KB §9.4, §16.1):
     - **Memory-Hard Resistance:** Forces attackers to allocate configurable blocks of RAM (e.g., 64 MiB) per hash attempt, neutralizing parallel GPU/FPGA cracking arrays.
     - **Hybrid Side-Channel & GPU Defense:** Combines Argon2i (data-independent memory access resisting timing attacks) and Argon2d (data-dependent access maximizing GPU resistance).
     - **Non-Blocking Native Execution:** Executes asynchronously on libuv C++ worker threads outside the Node.js main Event Loop, preventing login bursts from delaying real-time sensor telemetry ingestion (KB §9.1).
     - **No 72-Byte Truncation Limit:** Unlike `bcrypt`, Argon2id hashes arbitrary-length passphrases safely.

3. **Mandatory Security Invariants (KB §9.4 Rules 1–4):**
   - **Rule 1 — Mass-Assignment Prevention:** Public registration and profile update DTOs strictly whitelist allowed fields (`name`, `email`, `password`) and strip unknown properties (`stripUnknown: true`). Role assignment (`OPERATOR`, `ENGINEER`, `ADMINISTRATOR`) is restricted exclusively to `ADMINISTRATOR` endpoints (KB §9.4, Rule 1).
   - **Rule 2 — Schema-Level Password Omission:** Persistence queries and Domain-to-DTO Assemblers explicitly exclude `password_hash` by default; only the internal authentication flow retrieves the hash for `argon2.verify()` comparison (KB §9.4, Rule 2).
   - **Rule 3 — Identical Login Failure Responses:** Both non-existent email addresses and incorrect passwords return the exact same HTTP status and payload (`401 Unauthorized — "Invalid email or password"`), preventing account enumeration (KB §8.3, §9.4, Rule 3).
   - **Strict CORS Allowlist:** Cross-Origin Resource Sharing (`cors`) is configured via environment variables (`CORS_ALLOWED_ORIGINS`) rather than wildcard `*` origins (KB §9.4).

- **Considered Alternatives:**

  ### 1. Stateful Server-Side Sessions (Express-Session + Cookies + Redis Store)
  - *Description:* Storing active user sessions in server memory or a shared Redis cluster and exchanging a session ID via HTTP cookies (KB §9.4, §13.5).
  - *Pros:* Allows instantaneous server-side session revocation (forced logout) prior to token expiry (KB §13.5).
  - *Cons:* Violates the REST statelessness principle (KB §8.2, Principle 4); couples API requests to a session store lookup on every call; and requires additional Cross-Site Request Forgery (CSRF) token protection when using browser cookies (KB §9.4, §13.5, §16.1).

  ### 2. Legacy Password Hashing with `bcryptjs` (Pure JavaScript)
  - *Description:* Hashing passwords using the pure-JavaScript `bcryptjs` library with a cost factor of 10–12 (KB §9.4).
  - *Pros:* Zero native C++ compilation dependencies.
  - *Cons:* Runs synchronously/CPU-intensively on the single-threaded Node.js Event Loop, meaning 20 simultaneous operator logins can freeze real-time conveyor telemetry ingestion for several seconds (KB §9.1). Additionally, `bcrypt` lacks memory-hardness against modern ASICs and silently truncates passwords exceeding 72 bytes.

  ### 3. Network-Level IP Whitelisting Only (No Application RBAC)
  - *Description:* Relying solely on factory VLAN/subnet firewalls to restrict access without application-level roles.
  - *Pros:* Zero authentication code in the backend.
  - *Cons:* Violates defense-in-depth and OWASP Broken Access Control guidelines (KB §16.1). An operator on the factory floor could accidentally delete plant sectors or recalibrate critical vibration thresholds meant only for industrial engineers (`02-context.md`, §3).

- **Consequences:**

  ### Positive
  - **Zero Database Overhead on Authenticated Requests:** Embedding `sub` and `role` claims inside the signed JWT allows `JwtAuthGuard` and `RolesGuard` to authorize requests (`401 Unauthorized` vs. `403 Forbidden`) in memory at the routing boundary (KB §8.3, §9.4).
  - **Event-Loop Protection Under Auth Load:** Offloading Argon2id hashing to native worker threads preserves deterministic latency for concurrent telemetry streams (KB §9.1).
  - **Complete OWASP Alignment:** Eliminates mass assignment, credential leakage, user enumeration, and weak password hashing vulnerabilities (KB §9.4, §16.1).

  ### Negative / Trade-offs
  - **Deferred Permission Revocation:** Because role claims are embedded in the stateless JWT payload, demoting an `ENGINEER` or deactivating a user account takes effect across active tokens only when the token expires (`expiresIn`), unless a short-lived access token + refresh token rotation list is introduced (KB §9.4, Rule 4; §13.5).
  - **Native Build Dependency:** The `argon2` package requires prebuilt binary bindings for the target OS architecture in CI and container environments.

---

## Revision History

| Version | Date | Author | Description |
| :--- | :--- | :--- | :--- |
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial security decision establishing stateless JWTs, Argon2id hashing, and RBAC guards. |