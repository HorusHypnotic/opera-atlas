# OPERA-ATLAS-CONTROL-TOWER-V1

Status: CANDIDATE | 2026-10-19 | based on main 3301911686b576ebbc096c6eda0a12bcdfab48a8

## Canonical operating constraints (inherited from Vitrine Digital)

1. Existing versioned decisions and observed code have precedence over guesses; inventory and audit before change. Preserve schedule baseline semantics and multi-tenant RLS.
2. Do not use Lovable AI credits. GitHub is the versioned source for proposed code changes; the Lovable main preview is a QA surface, not evidence of a completed deploy.
3. The Supabase backing this Lovable app is Lovable-managed: DO NOT administer that project through a separate Supabase connection. No schema migrations, RLS/policy changes, direct production data changes, secrets changes or edge-function deployment without separate explicit authorization and a validated access path. Existing migrations in git are historical artifacts, not permission to apply them.
4. No GitHub Actions; no unauthorized merges, deployments or publication. Work in a branch, small reversible commits, tests, observable evidence, and human gate.
5. PETECO is a proposed executor, not assumed connected to this repository. Verify command bus, worker, SHA, queue, idempotency and run logs before assigning jobs. No credit-spending automation.
6. Keep each stage START/PASS/FAIL/BLOCKED/UNKNOWN/CANDIDATE. Evidence is mandatory before claiming PASS or assigning completion percentages.
7. Safety checks: never put secrets in git, cross-tenant authorization matters, preserve approved schedule baseline and auditability, avoid destructive actions.

## Evidence at initial checkpoint

- Repository HorusHypnotic/opera-atlas, main, latest observed commit 3301911686b576ebbc096c6eda0a12bcdfab48a8 (2026-08-19).
- README claims beta, schedule baseline, PDF IPMO, CSV export, WhatsApp sharing, dashboard, RLS multi-tenancy, retention documentation, and public preview https://opera-atlas.lovable.app. Each claim requires code/runtime verification before treating as PASS.
- package.json exposes build, lint, test scripts. Prior commit reports local build and one test suite passing historically, NOT current QA.
- No PRs or issues surfaced in initial repository searches.

## Execution plan

P0: audit docs/decisoes, docs/rfcs, README, .github, source, tests, Supabase references without connecting to Lovable-managed Supabase. Record exact current SHA and risks.
P1: map product flows (organizations/permissions, schedules/baselines, labor, reports, exports), test cases and observable proof.
P2: safe and reversible code-only improvements behind isolated branch/PR; PETECO only after verified handshake.
P3: preview QA and explicit human gate for merge/publication.

## Next action

Read all approved schedule and retention decisions, inspect actual source/test inventory and ascertain whether the repo has any GitHub Actions; establish test baseline; reconcile with this CANDIDATE contract before canonization. No automatic changes to main.
