# ADR-0008: Git-Native API Contract Tooling (Bruno) & Continuous Integration Pipeline (GitHub Actions)

* **Status:** Accepted

* **Context:**
  To maintain continuous engineering quality, evidence-based progress tracking (KB §1.2, Principle 8), and frictionless repository auditing, **FlowGuard** requires:

1. **Declarative HTTP API Contract Collections:** Reviewers, developers, and automated pipelines need a ready-to-run collection of HTTP requests that exercises every REST endpoint (authentication login, token extraction, plant sector creation, conveyor line topology setup, sensor registration, telemetry ingestion, and anomaly alert acknowledgement) with built-in assertions (`01-problem-statement.md`, §3–§4).

2. **Automated Continuous Integration (CI):** Every `git push` and Pull Request must automatically verify that the TypeScript codebase compiles cleanly, passes linting, and satisfies all unit and integration test suites before code is merged (KB §16.2, §22.1).

Historically, teams used Postman for manual API collections; however, modern cloud restrictions and repository-first workflows demand a tool that lives natively inside the Git repository alongside the source code (KB §19.2, §22.2).

* **Decision:**
  We adopt **Bruno** as our Git-native API contract testing client and **GitHub Actions** as our automated Continuous Integration (CI) pipeline (KB §16.2, §22.1, §22.2):

1. **Git-Native Declarative API Collections with Bruno (`bruno/` directory):**

   * All interactive HTTP requests, environment variables (`local.bru`), post-response token extraction scripts (`bru.setEnvVar("jwtToken", res.body.accessToken)`), and status/payload assertions are stored as plain-text `.bru` files directly inside the Git repository (KB §22.2).

   * **Offline & Secret-Safe by Design:** Unlike cloud-synced tools, Bruno runs 100% locally and never uploads workspace environments, URLs, or credentials to third-party servers—complying strictly with repository security rules (no leaked secrets).

   * **CLI Execution (`@usebruno/cli`):** Bruno collections can be executed headlessly from the command line (`bru run --env local`) to validate end-to-end HTTP contracts against a running instance.

2. **Automated Continuous Integration via GitHub Actions (`.github/workflows/ci.yml`):**

   * Triggered automatically on every `push` and `pull_request` targeting `main` / `develop` branches (KB §22.1).

   * Executes a deterministic, fail-fast verification pipeline on `ubuntu-latest` runners:

     1. **Checkout & Environment Setup:** Checks out repository history (`actions/checkout@v4`) and provisions Node.js LTS (`actions/setup-node@v4`) with deterministic `npm ci` dependency installation (preventing lockfile drift, KB §22.1, §22.3).

     2. **Static Analysis & Type Checking:** Runs ESLint and `tsc --noEmit` to catch syntax, architectural import violations, and strict TypeScript typing errors.

     3. **Build Verification:** Compiles the production bundle (`npm run build`).

     4. **Automated Test Suite Execution:** Runs the complete Jest unit test suite and Supertest in-memory HTTP integration suite (`npm test -- --coverage`).

     5. **Security Audit:** Checks third-party dependencies for known high/critical vulnerabilities (`npm audit --audit-level=high`, KB §16.2).

* **Considered Alternatives:**

  ### 1. Postman (Cloud-Synced Workspaces & Monolithic JSON Exports)

  * *Description:* Managing API request collections in the Postman desktop/cloud application and exporting `.postman_collection.json` files (KB §22.2).

  * *Pros:* Widely known graphical interface.

  * *Cons:*

    * **Cloud Lock-In & Collaboration Limits:** Postman enforces mandatory cloud synchronization and restricts free-tier team workspaces to a maximum of 3 collaborators (KB §19.2, §22.2).

    * **Unreadable Git Diffs:** Exporting a Postman collection produces a single, deeply nested, thousands-of-lines JSON file with random UUIDs, making Git diffs and code reviews nearly impossible compared to Bruno's clean, human-readable one-file-per-request `.bru` DSL (KB §22.2).

  ### 2. Ad-Hoc cURL Bash Scripts Only

  * *Description:* Maintaining raw `.sh` scripts with `curl` commands for manual endpoint testing.

  * *Pros:* Zero tooling installation on Unix systems.

  * *Cons:* Lacks a graphical explorer for interactive inspection, requires brittle `jq` bash parsing to chain JWT tokens across requests, and provides poor assertion reporting compared to Bruno and Supertest.

  ### 3. Local-Only Testing Without Automated CI Workflows

  * *Description:* Relying on developers to run `npm test` locally on their machines before pushing to `main`.

  * *Pros:* Zero YAML pipeline configuration.

  * *Cons:* High risk of *"works on my machine"* failures caused by uncommitted files, local `.env` discrepancies, or skipped test runs (KB §22.3). Automated GitHub Actions guarantees an objective, reproducible quality gate on every commit.

* **Consequences:**

  ### Positive

  * **Version-Controlled API Contracts:** Every new endpoint or roadmap feature (`ADR-0006`) is committed alongside its `.bru` request file in the same Pull Request, ensuring documentation and test collections never drift out of sync with the code (KB §1.2, Principle 8; §22.2).

  * **Zero Cloud Account or License Friction:** Anyone cloning the public FlowGuard repository can open the `bruno/` folder immediately with zero login, cloud account, or license restrictions (KB §22.2).

  * **Continuous Regression Protection:** GitHub Actions immediately flags broken builds, failing unit/integration tests, or dependency vulnerabilities on every push (KB §16.2, §22.1).

  ### Negative / Trade-offs

  * **Dual Test Maintenance:** Developers maintain both automated Supertest suites (for headless CI execution) and declarative `.bru` files (for interactive exploratory testing and contract auditing).

## Revision History

| Version | Date | Author | Description | 
| ----- | ----- | ----- | ----- | 
| **v1.0** | 2026-10-28 | Pedro Ribeiro | Initial decision selecting Bruno for Git-native API collections and GitHub Actions for CI automation. | 
