export type ProofItem = {
  title: string;
  detail: string;
  source: string;
};

const REPO = "https://github.com/Josh-Gi3r/blueballs/blob/main";

export const STANDARD_PROOF: ProofItem[] = [
  {
    title: "Build, types, lint and formatting",
    detail:
      "TypeScript, Vite build, JavaScript syntax, ESLint and source-format consistency are all part of the standard repository gate.",
    source: `${REPO}/scripts/verify.mjs`,
  },
  {
    title: "Banking API catalogue and runtime",
    detail:
      "The release gate runs the banking API suite, checks router/catalogue alignment and requires the banking OpenAPI contract to describe all 181 operations.",
    source: `${REPO}/scripts/verify.mjs`,
  },
  {
    title: "Machine-readable contract sync",
    detail:
      "Generated OpenAPI must stay in sync with sources; banking request/response contracts, generated TypeScript and OpenAPI lint are checked together.",
    source: `${REPO}/scripts/verify.mjs`,
  },
  {
    title: "FX package and SDK gates",
    detail:
      "All nine FX package suites and the SDK package boundary are part of the standard verification profile.",
    source: `${REPO}/scripts/verify.mjs`,
  },
  {
    title: "Settlement-contract gate",
    detail:
      "Foundry format, build, fuzz and invariant tests gate the on-chain FX settlement contracts.",
    source: `${REPO}/packages/fx-contracts/Makefile`,
  },
  {
    title: "Cloudflare runtime behaviour",
    detail:
      "Worker suites include the public edge, banking runtime and Durable Object eviction behaviour.",
    source: `${REPO}/scripts/verify.mjs`,
  },
  {
    title: "Product and publication truth",
    detail:
      "Routes, public claims, provider-relationship wording, card provenance, screenshots and other publication contracts are verified from source.",
    source: `${REPO}/scripts/verify.mjs`,
  },
  {
    title: "Scratch financial behaviour",
    detail:
      "The standard gate boots a disposable API instance and exercises tenant isolation, money movement and ledger failure boundaries against real runtime state.",
    source: `${REPO}/scripts/verify.mjs`,
  },
];

export const FULL_RELEASE_PROOF: ProofItem[] = [
  {
    title: "Tracked-secret and full dependency audit",
    detail:
      "The full release profile scans tracked source for secrets and audits production plus build/development dependencies for high-severity advisories before promotion.",
    source: `${REPO}/scripts/release-proof.mjs`,
  },
  {
    title: "CycloneDX dependency inventory",
    detail:
      "A CycloneDX software bill of materials is generated and its SHA-256 is recorded in the release evidence.",
    source: `${REPO}/scripts/release-proof.mjs`,
  },
  {
    title: "Restart and chaos suite",
    detail:
      "Financial restart boundaries, webhook recovery and FX/runtime chaos checks run before the load and container gates.",
    source: `${REPO}/scripts/release-proof.mjs`,
  },
  {
    title: "Disposable banking and FX load proof",
    detail:
      "The full profile runs the disposable banking and FX load proof and records its report with the release evidence.",
    source: `${REPO}/scripts/release-proof.mjs`,
  },
  {
    title: "Reference-container security scan",
    detail:
      "The release profile scans the reference container for high and critical vulnerabilities before publication.",
    source: `${REPO}/scripts/release-proof.mjs`,
  },
  {
    title: "Exact-checkout evidence",
    detail:
      "The verification report records commit, tree, branch, Node/pnpm versions, lockfile hash, operation coverage, load report, SBOM hash and gate results.",
    source: `${REPO}/scripts/release-proof.mjs`,
  },
];

export const DEPLOYMENT_PROOF: ProofItem[] = [
  {
    title: "Clean published source only",
    detail:
      "Cloudflare deployment refuses a dirty worktree and requires local HEAD to equal origin/main.",
    source: `${REPO}/scripts/deploy-cloudflare.mjs`,
  },
  {
    title: "Full release proof before deploy",
    detail:
      "Every deployment target invokes the full clean-checkout release verification profile before Wrangler publishes it.",
    source: `${REPO}/scripts/deploy-cloudflare.mjs`,
  },
  {
    title: "Source SHA attached to every service",
    detail:
      "The exact git SHA is injected into site, banking and FX deployments as BLUEBALLS_GIT_SHA and exposed through health/source headers.",
    source: `${REPO}/scripts/deploy-cloudflare.mjs`,
  },
  {
    title: "Post-deploy convergence check",
    detail:
      "Full-stack deployment verifies site, banking and FX are healthy and converged on the same exact source SHA before the deploy command succeeds.",
    source: `${REPO}/scripts/deploy-cloudflare.mjs`,
  },
];
