<!--
SYNC IMPACT REPORT:
- Version Change: [TEMPLATE] -> 1.0.0 (Initial project constitution ratification)
- Core Principles Defined:
  1. I. Simplicity & Readability First (Python 3.11+, explicit over clever, zero premature abstraction)
  2. II. Clean Documentation & Strict Comment Discipline (No multi-line comments, useful inline comments, """...""" docstrings)
  3. III. Explicit Architecture & Boundary Isolation (Unidirectional deps, thin handlers, pure transformations, boundary I/O)
  4. IV. Type Safety & Contract Discipline (Comprehensive type hints, no lazy Any, boundary validation)
  5. V. Behavioral Testing & Verification Rigor (Verification hierarchy, test behavior not trivia)
  6. VI. Security, Observability & Data Integrity (Centralized config, structured logging, UTC timestamps, isolated DB access)
  7. VII. Multi-Agent & LLM Operational Rigor (Single responsibility agents, prompt/orchestration separation, context engineering)
- Added Sections: Operational Standards & Tooling, Development Workflow & Definition of Done
- Deferred Items / TODOs: None
-->

# TaskFlow Constitution

## Core Principles

### I. Simplicity & Readability First
- All code MUST prioritize simple, explicit, readable implementations over clever or theoretical abstractions.
- Developers MUST avoid unneeded classes, design patterns, or utility modules for one-off operations. Abstract only when genuine multiple implementations, dependency injection needs, or clear domain models require it.
- Use Python 3.11+ modern idioms: built-in generics (`list[str]`, `dict[str, int]`), union syntax (`X | None`), `from __future__ import annotations`, and dataclasses/enums/Pydantic models where they clarify contracts.
- **Golden Rule**: When uncertain, choose the simplest implementation that makes behavior obvious, keeps boundaries explicit, is testable, and matches existing repo patterns. Optimize for clarity, correctness, maintainability, testability, and operability.

### II. Clean Documentation & Strict Comment Discipline
- Python and all project code MUST be clean, simple, and uncluttered.
- Developers MUST NOT write multi-line comments (`#` blocks spanning multiple lines or block commentary).
- Inline comments MUST be short, useful, and explain *why* something is done, never restating *what* the code visibly does.
- Every function and public interface SHOULD have a short, meaningful description enclosed in standard triple-quote docstrings (`"""..."""`).
- Module docstrings MUST explain the purpose, architectural rationale, and constraints of the module—never vague placeholders.

### III. Explicit Architecture & Boundary Isolation
- Dependencies MUST flow in one direction: API → service/orchestration → domain → infrastructure. Circular dependencies are strictly forbidden.
- API route handlers MUST remain thin, delegating all business logic, database queries, and orchestration to dedicated service layers.
- Separate pure transformation functions from I/O; push side effects (filesystem, database, network, LLM calls, subprocesses) to system boundaries.
- Framework dependencies (FastAPI, SQLAlchemy, etc.) MUST stay near boundaries and not leak into core domain logic.
- Long-running, CPU-heavy, or retryable tasks (e.g., LLM operations, background jobs) MUST use background workers or asynchronous execution rather than blocking HTTP request cycles synchronously.

### IV. Type Safety & Contract Discipline
- Type hints are REQUIRED on all public functions (parameters and return types) and non-obvious internal helpers.
- `Any` MUST NOT be used as a lazy default; it is permitted only at genuine dynamic or external boundaries.
- Input validation MUST occur strictly at system boundaries (e.g., Pydantic request models); internal services MUST trust internal contracts without redundant defensive re-validation.

### V. Behavioral Testing & Mandatory Verification
- Tests MUST verify behavior (happy paths, edge cases, invalid inputs, failure recoveries, integration contracts), not implementation trivia or artificial coverage metrics.
- No task or feature may be marked "Done" without multi-stage verification.
- **Verification Hierarchy** (executed cheapest to most expensive):
  1. Syntax & import checks
  2. Linting & format validation (`ruff check`, `ruff format --check`)
  3. Unit tests (`pytest tests/unit`)
  4. Integration & contract tests (`pytest tests/integration`)
  5. Smoke tests & end-to-end scenario verification

### VI. Security, Observability & Data Integrity
- Configuration MUST be centralized via cached settings (`pydantic-settings`); scattered `os.getenv()` calls and hardcoded secrets/infrastructure strings are forbidden.
- Secrets, passwords, or API keys MUST NEVER be committed, hardcoded, or printed to log streams.
- All persisted timestamps MUST be timezone-aware UTC; duration measurements MUST use `time.monotonic()`.
- Logs MUST be structured and descriptive, tracking workflow IDs, duration, status, and failure reasons without raw dumps of sensitive payload data.
- Database access MUST be isolated behind service/repository layers with explicit transaction management.

### VII. Multi-Agent & LLM Operational Rigor
- In multi-agent and LLM workflows, separate model selection, prompt construction, tool definitions, and business orchestration into distinct layers.
- Each agent in a multi-agent system MUST have a single clear responsibility, defined inputs, specific tools, and validated outputs.
- Practice context engineering: supply agents only with stable, task-specific, and role-relevant context rather than monolithic conversational dumps.
- Long-running state MUST be persisted in durable artifacts and database records rather than through conversational context.

## Operational Standards & Tooling

### Tooling & Dependency Management
- Package and dependency management MUST use `uv` (`uv sync`, `uv add`, `uv lock`).
- The lockfile (`uv.lock`) MUST be committed alongside `pyproject.toml` and MUST NOT be manually edited.
- Commands and scripts MUST be explicit, reproducible, and copy-pasteable (invoked via `uv run <cmd>`).
- Environment variables MUST be documented in `.env.example`.

### Code Organization & Formatting
- Import order MUST follow standard grouping separated by a single blank line: `__future__` → standard library → third-party → local packages. Wildcard imports (`from x import *`) are prohibited.
- Module layout MUST follow: module docstring → imports → constants (UPPERCASE) → types/models → private helpers (`_` prefix) → public functions → classes → entry points.
- Filesystem interactions MUST use `pathlib.Path` with explicit encoding specified for text I/O (`encoding="utf-8"`).
- Formatting MUST use `ruff format` and `ruff check` without conflicting custom rules.

## Development Workflow & Definition of Done

### Agent Execution Workflow
Every implementation task MUST proceed through six disciplined phases:
1. **Understand**: Inspect repository structure, identify responsible modules, and locate existing patterns.
2. **Plan**: Formulate atomic steps respecting boundary isolation and dependencies.
3. **Implement**: Write minimal, clean, type-hinted code with short docstrings and concise *why* comments.
4. **Verify**: Run the verification hierarchy (syntax → format/lint → unit tests → integration tests).
5. **Review Diff**: Check for unintended edits, dead code, leftover debug statements (`print`, `breakpoint()`), or unnecessary abstractions.
6. **Commit**: Produce atomic, focused commits with clear imperative commit messages.

### Definition of Done
A task or feature is considered **Done** only when:
- The requested behavior is fully implemented and passes all functional requirements.
- All public functions include type annotations and short docstrings (`"""..."""`).
- No multi-line comments exist; inline comments are concise and explain *why*.
- No debug code, unused imports, or dead code remains.
- All linters, formatters, and unit/integration tests pass cleanly.
- Documentation (README, API contracts, quickstart guides) reflects current behavior.

## Governance

- **Supremacy**: This Constitution supersedes all informal coding habits and unratified guidelines across the project.
- **Amendments**: Amendments require explicit proposal, documentation of rationale, and a semantic version bump.
- **Versioning Policy**:
  - **MAJOR**: Removal, redefinition, or breaking change to core governance principles.
  - **MINOR**: Addition of new principles, sections, or materially expanded guidelines.
  - **PATCH**: Clarifications, wording improvements, non-semantic refinements.
- **Compliance Review**: All pull requests, code reviews, and agent tasks MUST verify compliance against the principles defined herein. Complexity and deviations must be explicitly justified.

**Version**: 1.0.0 | **Ratified**: 2026-08-25 | **Last Amended**: 2026-08-25
