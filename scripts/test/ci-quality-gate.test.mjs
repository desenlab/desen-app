import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import {
  CancellationError,
  PROOF_ENTRIES,
  QualityGateError,
  assertSafeStep,
  assertTrackedWorkspaceUnchanged,
  createQualityGateSteps,
  executeDefaultQualityGate,
  executeQualityGate,
  forwardSignal,
  runStepSequence,
  snapshotTrackedWorkspace,
  validateProofInventory,
  validateQualityGatePlan,
} from "../run-ci-quality-gate.mjs";
import { RUNTIME_CORE_BASELINE_CAPTURE } from "../lib/runtime-core-baseline-proof.mjs";
import { validateRepositoryWorkloadInputs } from "../ci/exhaustive-workload-inventory.mjs";

const WORKSPACE_ROOT = resolve(import.meta.dirname, "../..");
const CI_02_LOCAL_BASELINE = Object.freeze([
  "pnpm format:check",
  "pnpm lint",
  "pnpm typecheck",
  "pnpm build",
  "pnpm boundaries",
  "node scripts/ci/verify-proof-reader-checkpoints.mjs",
]);
const CI_02_FIRST_HOSTED_RECEIPT = Object.freeze({
  headSha: "921fd54c406f22fb6da25b0fdd29598ac8950750",
  runId: "33196876164",
  jobId: "98936152886",
  duration: "14m53s",
  jobUrl: "https://github.com/desenlab/desen-app/actions/runs/33196876164/job/98936152886",
});
const CI_02_FIRST_HOSTED_LINK = `[run ${CI_02_FIRST_HOSTED_RECEIPT.runId} / job ${CI_02_FIRST_HOSTED_RECEIPT.jobId}](${CI_02_FIRST_HOSTED_RECEIPT.jobUrl})`;
const CI_02_FIRST_HOSTED_RECEIPT_MARKERS = Object.freeze({
  "docs/plan/TASKS.md": `The implementation candidate at \`${CI_02_FIRST_HOSTED_RECEIPT.headSha}\` passed PR #56's hosted \`Quality gate\` in ${CI_02_FIRST_HOSTED_LINK} in \`${CI_02_FIRST_HOSTED_RECEIPT.duration}\`.`,
  "PROJECT-STATUS.md": `The implementation candidate at \`${CI_02_FIRST_HOSTED_RECEIPT.headSha}\` passed PR #56's hosted \`Quality gate\` in ${CI_02_FIRST_HOSTED_LINK} in \`${CI_02_FIRST_HOSTED_RECEIPT.duration}\`.`,
  "docs/plan/START-HERE.tr.md": `\`${CI_02_FIRST_HOSTED_RECEIPT.headSha}\` başındaki uygulama adayı, PR #56'nın hosted \`Quality gate\` koşusunu ${CI_02_FIRST_HOSTED_LINK} içinde 14 dakika 53 saniyede geçti.`,
});
const CI_02_CONDITIONAL_CLOSURE_MARKERS = Object.freeze({
  "docs/plan/TASKS.md": Object.freeze([
    "The `DONE` row in this unmerged pull request is a conditional closure candidate",
    "Canonical CI-02 remains `IN_PROGRESS` until the hosted `Quality gate` attached to this exact current head passes.",
  ]),
  "PROJECT-STATUS.md": Object.freeze([
    "Conditional operational completion: CI-02's `DONE` entry in this unmerged change is a closure candidate; it is not yet canonical.",
    "Canonical CI-02 remains `IN_PROGRESS` until the hosted `Quality gate` attached to this exact current head passes.",
  ]),
  "README.md": Object.freeze([
    "**CI-02:** conditional `DONE` on this exact PR head's hosted `Quality gate`; canonical status remains `IN_PROGRESS` while it is pending",
  ]),
  "docs/plan/START-HERE.tr.md": Object.freeze([
    "CI-02'nin bu merge edilmemiş değişiklikteki `DONE` kaydı koşullu bir kapanış adayıdır.",
    "Tam güncel PR head'indeki hosted `Quality gate` geçene kadar kanonik CI-02 durumu `IN_PROGRESS` kalır",
  ]),
});
const CI_02_BASELINE_SECTIONS = Object.freeze({
  "AGENTS.md": "## Per-task quality contract (CI-02)",
  "CONTRIBUTING.md": "## Validation",
  "docs/standards/CI-QUALITY-GATE.md": "## CI-02 per-task completion contract",
});
const CI_02_DOCUMENT_MARKERS = Object.freeze({
  "AGENTS.md": Object.freeze([
    "## Per-task quality contract (CI-02)",
    CI_02_LOCAL_BASELINE.join("\n"),
    "This baseline is non-authoritative early feedback",
    "task-specific verifier or focused positive and relevant negative tests",
    "merged or reported complete only after the hosted `Quality gate` passes for the exact current",
    "Any new commit invalidates that result.",
    "The full `pnpm check` remains the local exhaustive compatibility and gate-closure command for G",
    "identity and impact authority, never cached success",
  ]),
  "CONTRIBUTING.md": Object.freeze([
    "For an ordinary task, run the bounded local baseline before review:",
    CI_02_LOCAL_BASELINE.join("\n"),
    "and relevant negative tests are still mandatory.",
    "passing hosted `Quality gate` attached to the exact current pull-request head",
    "Use the exhaustive local `pnpm check` compatibility command for G closure, an explicit local",
    "they never cache success or replace fresh selected workloads",
  ]),
  "docs/standards/CI-QUALITY-GATE.md": Object.freeze([
    "## CI-02 per-task completion contract",
    "CI-02 is an explicitly user-authorized operational task.",
    "The baseline is deliberately non-authoritative early feedback.",
    "exact current pull-request head; any new commit invalidates the earlier result",
    "`pnpm check` remains the local exhaustive compatibility and gate-closure command for G closure, an",
    "and impact authority, never cached success",
    "CI-02 does not add a local affected selector.",
    "The hosted dispatcher and workflow are unchanged.",
    "I07-05 and the legacy rollback path remain unchanged.",
  ]),
  "docs/adr/0011-modular-proof-infrastructure.md": Object.freeze([
    "### CI-02 operational overlay — per-task quality contract",
    "CI-02 separates quick developer feedback from completion authority.",
    "Merge or a completion report requires the hosted `Quality gate` to pass on the exact current",
    "never cached success; the selected hosted workloads always run fresh",
    "I07-05 still owns legacy retirement",
  ]),
  "docs/plan/START-HERE.tr.md": Object.freeze([
    "CI-02'nin sınırlı yerel temel kontrolleri",
    "Mühür/checkpoint yalnızca kimlik ve etki otoritesidir; başarıyı",
    "CI-02'nin bu merge edilmemiş",
    "Bu makbuz yalnızca önceki head'i kanıtlar ve yeni head'e otorite",
  ]),
  "docs/plan/TASKS.md": Object.freeze([
    "| CI-02  | DONE",
    "I07-04, explicit user authorization",
    "`CI-02` is a separate explicitly authorized operational task",
    "The `DONE` row in this unmerged pull",
    "Canonical CI-02 remains `IN_PROGRESS` until the hosted `Quality gate` attached to this exact",
    "I07-05 plus the legacy rollback path unchanged",
  ]),
  "PROJECT-STATUS.md": Object.freeze([
    "Conditional operational completion: CI-02's `DONE` entry in this unmerged change",
    "That receipt proves only that prior exact head and does not authorize this new head.",
    "Canonical CI-02 remains `IN_PROGRESS` until the hosted `Quality gate` attached to this exact",
    "changes no hosted dispatcher/workflow",
  ]),
  "README.md": Object.freeze([
    "**CI-02:** conditional `DONE` on this exact PR head's hosted `Quality gate`; canonical status remains `IN_PROGRESS` while it is pending",
  ]),
  "scripts/ci/README.md": Object.freeze([
    "CI-02 adds only a per-task completion policy.",
    "Checkpoints and seals authenticate identity and impact, never",
    "and leaves I07-05 plus the manual legacy",
  ]),
});
const PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT = "70ac046c693b91fabba4c67cdaca6c5e33330d6a";
const LIVING_DOCUMENT_CONTRACTS = Object.freeze([
  Object.freeze({
    path: "README.md",
    maximumLines: 220,
    purpose: "Product/repository introduction and first successful use",
  }),
  Object.freeze({
    path: "PROJECT-STATUS.md",
    maximumLines: 160,
    purpose: "Current transition, verified closure, and next authority",
  }),
  Object.freeze({
    path: "docs/plan/START-HERE.tr.md",
    maximumLines: 180,
    purpose: "Turkish contributor onboarding and working order",
  }),
  Object.freeze({
    path: "docs/plan/TASKS.md",
    maximumLines: 340,
    purpose: "Canonical task status, dependencies, deliverables, evidence",
  }),
  Object.freeze({
    path: "docs/architecture/ARCHITECTURE.md",
    maximumLines: 320,
    purpose: "Living system boundaries and dependency direction",
  }),
  Object.freeze({
    path: "docs/standards/TESTING-STRATEGY.md",
    maximumLines: 260,
    purpose: "Test layers, evidence policy, and current browser profile",
  }),
  Object.freeze({
    path: "docs/standards/CI-QUALITY-GATE.md",
    maximumLines: 260,
    purpose: "Current local/hosted quality-gate contract",
  }),
  Object.freeze({
    path: "scripts/ci/README.md",
    maximumLines: 260,
    purpose: "CI operator map and safe-update workflow",
  }),
]);
const DOCUMENTATION_STANDARDS_PATH = "docs/standards/DOCUMENTATION-STANDARDS.md";
const RUNTIME_CORE_BASELINE_TREE = RUNTIME_CORE_BASELINE_CAPTURE.tree;
const RUNTIME_CORE_BASELINE_DOCUMENTS = Object.freeze([
  "PROJECT-STATUS.md",
  "docs/plan/START-HERE.tr.md",
  "docs/architecture/ARCHITECTURE.md",
  "docs/standards/TESTING-STRATEGY.md",
]);
const TASK_MILESTONE_COUNTS = Object.freeze({
  M00: 6,
  M01: 8,
  M02: 13,
  M03: 10,
  M04: 17,
  M05: 9,
  M06: 11,
  M07: 11,
  M08: 10,
  M09: 14,
  M10: 12,
  M10A: 28,
  M11: 14,
  M12: 13,
});
const M10_TASK_IDS = Object.freeze([
  "M10-T01",
  "M10-T01A",
  "M10-T01B",
  "M10-T01C",
  ...Array.from({ length: 8 }, (_, index) => `M10-T${String(index + 2).padStart(2, "0")}`),
]);
const M10A_TASK_IDS = Object.freeze(
  Array.from({ length: 28 }, (_, index) => `M10A-T${String(index + 1).padStart(2, "0")}`),
);
const M10A_TASK_DEPENDENCIES = Object.freeze({
  "M10A-T01": "G10",
  "M10A-T02": "M10A-T01",
  "M10A-T03": "M10A-T02",
  "M10A-T04": "M10A-T02",
  "M10A-T05": "M10A-T01, M10A-T02",
  "M10A-T06": "M10A-T05",
  "M10A-T07": "M10A-T06",
  "M10A-T08": "M10A-T07",
  "M10A-T09": "M10A-T05, M10A-T08",
  "M10A-T10": "M10A-T02, M10A-T04, M10A-T09",
  "M10A-T11": "M10A-T10",
  "M10A-T12": "M10A-T03, M10A-T11",
  "M10A-T13": "M10A-T04, M10A-T12",
  "M10A-T14": "M10A-T10, M10A-T11",
  "M10A-T15": "M10A-T09, M10A-T13, M10A-T14",
  "M10A-T16": "M10A-T12, M10A-T15",
  "M10A-T17": "M10A-T03, M10A-T16",
  "M10A-T18": "M10A-T04, M10A-T17",
  "M10A-T19": "M10A-T10, M10A-T14",
  "M10A-T20": "M10A-T16, M10A-T19",
  "M10A-T21": "M10A-T20",
  "M10A-T22": "M10A-T04, M10A-T18, M10A-T21",
  "M10A-T23": "M10A-T08, M10A-T16, M10A-T17, M10A-T22",
  "M10A-T24": "M10A-T13, M10A-T23",
  "M10A-T25": "M10A-T18, M10A-T24, M10A-T26",
  "M10A-T26": "M10A-T12, M10A-T22, M10A-T23",
  "M10A-T27": "M10A-T14, M10A-T16, M10A-T22, M10A-T25, M10A-T26",
  "M10A-T28": "M10A-T01–M10A-T27",
});
const EXPECTED_IMPLEMENTATION_TASK_IDS = Object.freeze(
  Object.entries(TASK_MILESTONE_COUNTS).flatMap(([milestone, count]) =>
    milestone === "M10"
      ? M10_TASK_IDS
      : Array.from(
          { length: count },
          (_, index) => `${milestone}-T${String(index + 1).padStart(2, "0")}`,
        ),
  ),
);
const EXPECTED_GATE_IDS = Object.freeze([
  ...Array.from({ length: 11 }, (_, index) => `G${String(index).padStart(2, "0")}`),
  "G10A",
  "G11",
  "G12",
]);
const EXPECTED_OPERATIONAL_IDS = Object.freeze([
  "CI-01",
  "CI-02",
  "CI-03",
  "CI-04",
  "AR-01",
  "SEC-01",
  "SEC-02",
  "I07-01",
  "I07-02",
  "I07-03",
  "I07-04",
  "I07-05",
]);
const EXPECTED_TASK_BOARD_SECTIONS = Object.freeze([
  "M00",
  "M01",
  "operational",
  ...Object.keys(TASK_MILESTONE_COUNTS).slice(2),
]);
const M11_TASK_IDS = Object.freeze(
  EXPECTED_IMPLEMENTATION_TASK_IDS.filter((id) => id.startsWith("M11-")),
);
const FIVE_COLUMN_TASK_BOARD_SECTIONS = Object.freeze(["M00", "M01", "operational"]);
const TASK_BOARD_STATUSES = Object.freeze(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "DONE"]);
const EXPECTED_COMPLETED_IMPLEMENTATION_TASKS = 124;
const EXPECTED_COMPLETED_GATES = 11;
const SC_02_COMPLETE_ADAPT_MARKER = "**Status:** Complete on 2026-09-10. Decision: **`adapt`**.";

async function currentCi02ContractDocuments() {
  return Object.fromEntries(
    await Promise.all(
      Object.keys(CI_02_DOCUMENT_MARKERS).map(async (relativePath) => [
        relativePath,
        await readFile(resolve(WORKSPACE_ROOT, relativePath), "utf8"),
      ]),
    ),
  );
}

function ci02ContractFailure(message) {
  throw new Error(`CI-02 ${message}`);
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function countOccurrences(source, marker) {
  return source.split(marker).length - 1;
}

function countTextLines(source) {
  return source.split(/\r?\n/u).length - (source.endsWith("\n") ? 1 : 0);
}

function formatInteger(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

function requiredMutation(source, search, replacement, label) {
  const mutated = source.replace(search, replacement);
  assert.notEqual(mutated, source, `mutation fixture did not match: ${label}`);
  return mutated;
}

function parseLivingDocumentStandards(source) {
  const contracts = new Map();
  for (const line of source.split(/\r?\n/u)) {
    const match = line.match(/^\|\s+`([^`]+)`\s+\|\s+(.+?)\s+\|\s+(\d+)\s+\|$/u);
    if (match === null) {
      continue;
    }
    assert.ok(!contracts.has(match[1]), `duplicate documentation contract for ${match[1]}`);
    contracts.set(match[1], {
      purpose: match[2],
      maximumLines: Number(match[3]),
    });
  }
  return contracts;
}

function taskBoardSectionForId(id) {
  const task = id.match(/^(M\d{2}[A-Z]?)-T\d{2}[A-Z]?$/u);
  if (task !== null) {
    return task[1];
  }
  const gate = id.match(/^G(\d{2}[A-Z]?)$/u);
  return gate === null ? "operational" : `M${gate[1]}`;
}

function splitMarkdownTableRow(line) {
  assert.match(line, /^\|.*\|$/u, `malformed Markdown table row: ${line}`);
  const cells = [];
  let cell = "";
  const body = line.slice(1, -1);

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== "|") {
      cell += character;
      continue;
    }
    let precedingBackslashes = 0;
    for (let cursor = index - 1; cursor >= 0 && body[cursor] === "\\"; cursor -= 1) {
      precedingBackslashes += 1;
    }
    if (precedingBackslashes % 2 === 1) {
      cell += character;
      continue;
    }
    cells.push(cell.trim());
    cell = "";
  }
  cells.push(cell.trim());
  return cells;
}

function taskBoardHeaders(section) {
  return FIVE_COLUMN_TASK_BOARD_SECTIONS.includes(section)
    ? ["ID", "Status", "Depends on", "Deliverable", "Evidence"]
    : ["ID", "Status", "Depends on", "Deliverable / evidence"];
}

function historicalTaskBoardContentProjection(rows, normalizeAuthorizedDependencies = false) {
  const newPlanningIds = new Set([...M10A_TASK_IDS, "G10A"]);
  return rows
    .filter(({ cells }) => !newPlanningIds.has(cells[0]))
    .map(({ section, cells }) => {
      const projectedCells = [...cells];
      if (
        normalizeAuthorizedDependencies &&
        (projectedCells[0] === "M11-T01" || projectedCells[0] === "M11-T08")
      ) {
        projectedCells[2] = "G10";
      }
      return [section, projectedCells[0], ...projectedCells.slice(2)];
    });
}

function m10aDependencies(id, dependencyCell) {
  if (dependencyCell === "M10A-T01–M10A-T27") return M10A_TASK_IDS.slice(0, 27);
  if (dependencyCell === "M10A-T01–M10A-T28") return M10A_TASK_IDS;
  assert.doesNotMatch(dependencyCell, /–/u, `${id} has an unsupported dependency range`);
  return dependencyCell.split(", ");
}

function assertM10APlanningDag(rows) {
  const planningIds = new Set([...M10A_TASK_IDS, "G10A"]);
  const dependencies = new Map();
  for (const { cells } of rows.filter(({ section }) => section === "M10A")) {
    const [id, , dependencyCell] = cells;
    const expanded = m10aDependencies(id, dependencyCell);
    assert.equal(new Set(expanded).size, expanded.length, `${id} repeats a dependency`);
    for (const dependency of expanded) {
      assert.ok(
        dependency === "G10" || planningIds.has(dependency),
        `${id} has unknown dependency ${dependency}`,
      );
      assert.notEqual(dependency, id, `${id} cannot depend on itself`);
    }
    dependencies.set(
      id,
      expanded.filter((dependency) => planningIds.has(dependency)),
    );
  }

  const visited = new Set();
  const visiting = new Set();
  function visit(id) {
    if (visited.has(id)) return;
    assert.ok(!visiting.has(id), `M10A dependency cycle reaches ${id}`);
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of planningIds) visit(id);
}

function assertPreM11PlanningInventory({ rows, statuses }) {
  const m10aRows = rows.filter(({ section }) => section === "M10A");
  assert.deepEqual(
    m10aRows.map(({ cells }) => cells[0]),
    [...M10A_TASK_IDS, "G10A"],
    "M10A task or gate inventory drifted",
  );
  for (const taskId of M10A_TASK_IDS) {
    const row = m10aRows.find(({ cells }) => cells[0] === taskId);
    assert.ok(row !== undefined, `missing ${taskId}`);
    const expectedStatus =
      taskId === "M10A-T01" || taskId === "M10A-T02" || taskId === "M10A-T03"
        ? "DONE"
        : "NOT_STARTED";
    assert.equal(row.cells[1], expectedStatus, `${taskId} must remain ${expectedStatus}`);
    assert.equal(
      row.cells[2],
      M10A_TASK_DEPENDENCIES[taskId],
      `${taskId} dependency contract drifted`,
    );
  }
  const gateRow = m10aRows.find(({ cells }) => cells[0] === "G10A");
  assert.ok(gateRow !== undefined, "missing G10A");
  assert.equal(
    gateRow.cells[1],
    "NOT_STARTED",
    "G10A cannot pass before every M10A task is complete",
  );
  assert.equal(gateRow.cells[2], "M10A-T01–M10A-T28", "G10A dependency contract drifted");
  assertM10APlanningDag(rows);

  for (const taskId of ["M11-T01", "M11-T08"]) {
    const row = rows.find(({ cells }) => cells[0] === taskId);
    assert.ok(row !== undefined, `missing ${taskId}`);
    assert.equal(row.cells[2], "G10, G10A", `${taskId} must wait for both pre-M11 gates`);
  }
  assert.ok(
    M10_TASK_IDS.every((id) => statuses.get(id) === "DONE"),
    "historical M10 task completion drifted",
  );
  assert.equal(statuses.get("G10"), "DONE", "historical G10 completion drifted");
}

function replaceTaskBoardCell(source, id, cellIndex, replacement) {
  let matches = 0;
  const result = source
    .split(/\r?\n/u)
    .map((line) => {
      if (!line.startsWith("|")) return line;
      const cells = splitMarkdownTableRow(line);
      if (cells[0] !== id) return line;
      matches += 1;
      cells[cellIndex] = replacement;
      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");
  assert.equal(matches, 1, `expected one task-board row for ${id}`);
  return result;
}

function taskBoardRowLine(source, id) {
  const rows = source
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && splitMarkdownTableRow(line)[0] === id);
  assert.equal(rows.length, 1, `expected one task-board row for ${id}`);
  return rows[0];
}

function markdownH2Section(source, heading) {
  const headingMarker = `## ${heading}`;
  const start = source.indexOf(`${headingMarker}\n`);
  assert.notEqual(start, -1, `missing Markdown section ${headingMarker}`);
  const contentStart = start + headingMarker.length + 1;
  const end = source.indexOf("\n## ", contentStart);
  return source.slice(contentStart, end === -1 ? source.length : end);
}

function parseTaskBoard(source) {
  const statuses = new Map();
  const sectionStats = new Map();
  const sectionOrder = [];
  const rows = [];
  let currentSection = null;
  let tableLineCount = 0;

  for (const line of source.split(/\r?\n/u)) {
    if (line.startsWith("## ")) {
      currentSection = null;
      const milestoneHeading = line.match(/^## (M\d{2}[A-Z]?)\s+—\s+.+$/u);
      if (milestoneHeading !== null) {
        currentSection = milestoneHeading[1];
      } else if (
        line ===
        "## Operational and infrastructure work — excluded from the implementation-task count"
      ) {
        currentSection = "operational";
      }
      if (currentSection !== null) {
        assert.ok(
          !sectionStats.has(currentSection),
          `duplicate task-board section ${currentSection}`,
        );
        sectionStats.set(currentSection, { headers: 0, separators: 0, data: 0 });
        sectionOrder.push(currentSection);
      }
      continue;
    }
    if (!line.startsWith("|")) {
      continue;
    }

    assert.ok(currentSection !== null, "task-board table appears outside a governed section");
    tableLineCount += 1;
    const cells = splitMarkdownTableRow(line);
    const expectedHeaders = taskBoardHeaders(currentSection);
    const stats = sectionStats.get(currentSection);
    assert.ok(stats !== undefined, `missing task-board section state for ${currentSection}`);

    if (stats.headers === 0) {
      assert.deepEqual(cells, expectedHeaders, `invalid task-board header for ${currentSection}`);
      stats.headers += 1;
    } else if (stats.separators === 0) {
      assert.equal(
        cells.length,
        expectedHeaders.length,
        `invalid separator width for ${currentSection}`,
      );
      assert.ok(
        cells.every((cellValue) => /^:?-{3,}:?$/u.test(cellValue)),
        `invalid task-board separator for ${currentSection}`,
      );
      stats.separators += 1;
    } else {
      assert.equal(cells.length, expectedHeaders.length, `invalid row width for ${currentSection}`);
      const [id, status] = cells;
      assert.match(
        id,
        /^(?:M\d{2}[A-Z]?-T\d{2}[A-Z]?|G\d{2}[A-Z]?|(?:CI|SEC|AR)-\d{2}|I\d{2}-\d{2})$/u,
      );
      assert.ok(TASK_BOARD_STATUSES.includes(status), `invalid status ${status} for ${id}`);
      assert.ok(
        cells.every((cell) => cell.length > 0),
        `empty task-board cell for ${id}`,
      );
      assert.equal(taskBoardSectionForId(id), currentSection, `${id} is in the wrong section`);
      assert.ok(!statuses.has(id), `duplicate task-board ID ${id}`);
      statuses.set(id, status);
      rows.push({ section: currentSection, cells });
      stats.data += 1;
    }
  }

  return { statuses, sectionStats, sectionOrder, rows, tableLineCount };
}

function assertNormalizedMarkerExactlyOnce(relativePath, source, marker, failureKind) {
  if (normalizeWhitespace(source).split(marker).length - 1 !== 1) {
    ci02ContractFailure(`${failureKind} drifted in ${relativePath}.`);
  }
}

function validateCi02BaselineBlocks(documents) {
  for (const [relativePath, heading] of Object.entries(CI_02_BASELINE_SECTIONS)) {
    const source = documents[relativePath];
    const headingStart = source.indexOf(`${heading}\n`);
    if (headingStart === -1) {
      ci02ContractFailure(`baseline section drifted in ${relativePath}.`);
    }
    const sectionStart = headingStart + heading.length + 1;
    const nextHeading = source.indexOf("\n## ", sectionStart);
    const section = source.slice(sectionStart, nextHeading === -1 ? source.length : nextHeading);
    const bashBlocks = [...section.matchAll(/```bash\n([\s\S]*?)\n```/gu)];
    if (bashBlocks.length !== 1) {
      ci02ContractFailure(`baseline command block drifted in ${relativePath}.`);
    }
    const commands = bashBlocks[0][1].split("\n");
    if (JSON.stringify(commands) !== JSON.stringify(CI_02_LOCAL_BASELINE)) {
      ci02ContractFailure(`baseline command block drifted in ${relativePath}.`);
    }
  }
  return Object.keys(CI_02_BASELINE_SECTIONS).length;
}

function validateCi02FirstHostedReceipt(documents) {
  for (const [relativePath, marker] of Object.entries(CI_02_FIRST_HOSTED_RECEIPT_MARKERS)) {
    assertNormalizedMarkerExactlyOnce(
      relativePath,
      documents[relativePath],
      marker,
      "hosted receipt",
    );
  }
  return Object.keys(CI_02_FIRST_HOSTED_RECEIPT_MARKERS).length;
}

function validateCi02ConditionalClosureStatuses(documents) {
  const taskStatuses = [
    ...documents["docs/plan/TASKS.md"].matchAll(/^\| CI-02\s+\|\s+([A-Z_]+)\s+\|/gmu),
  ].map((match) => match[1]);
  if (taskStatuses.length !== 1 || taskStatuses[0] !== "DONE") {
    ci02ContractFailure("conditional-closure status drifted in docs/plan/TASKS.md.");
  }

  for (const [relativePath, markers] of Object.entries(CI_02_CONDITIONAL_CLOSURE_MARKERS)) {
    for (const marker of markers) {
      assertNormalizedMarkerExactlyOnce(
        relativePath,
        documents[relativePath],
        marker,
        "conditional-closure status",
      );
    }
  }

  const statusDocuments = Object.keys(CI_02_CONDITIONAL_CLOSURE_MARKERS);
  const unconditionalDonePatterns = [
    /^CI-02 is `DONE`\.\s*$/imu,
    /^\*\*CI-02:\*\*\s+`DONE`\s*$/imu,
    /^CI-02 `DONE` durumundadır\.\s*$/imu,
  ];
  for (const relativePath of statusDocuments) {
    if (unconditionalDonePatterns.some((pattern) => pattern.test(documents[relativePath]))) {
      ci02ContractFailure(`conditional-closure status drifted in ${relativePath}.`);
    }
    if (
      /^The prior receipt (?:authorizes|validates) (?:this|the) (?:new|current) head\.\s*$/imu.test(
        documents[relativePath],
      ) ||
      /^Önceki makbuz (?:bu|yeni|güncel) head'e otorite verir\.\s*$/imu.test(
        documents[relativePath],
      )
    ) {
      ci02ContractFailure(`prior-receipt authority drifted in ${relativePath}.`);
    }
  }
  return 4;
}

function validateCi02ContractDocuments(documents) {
  assert.deepEqual(Object.keys(documents), Object.keys(CI_02_DOCUMENT_MARKERS));
  let markerCount = 0;
  for (const [relativePath, markers] of Object.entries(CI_02_DOCUMENT_MARKERS)) {
    const source = documents[relativePath];
    assert.equal(typeof source, "string", `CI-02 contract document missing: ${relativePath}`);
    for (const marker of markers) {
      markerCount += 1;
      if (source.split(marker).length - 1 !== 1) {
        throw new Error(`CI-02 contract marker drifted in ${relativePath}: ${marker}`);
      }
    }
  }
  const baselineBlockCount = validateCi02BaselineBlocks(documents);
  const hostedReceiptDocumentCount = validateCi02FirstHostedReceipt(documents);
  const conditionalClosureStatusDocumentCount = validateCi02ConditionalClosureStatuses(documents);
  return Object.freeze({
    documentCount: Object.keys(CI_02_DOCUMENT_MARKERS).length,
    markerCount,
    localBaselineCommandCount: CI_02_LOCAL_BASELINE.length,
    baselineBlockCount,
    hostedReceiptDocumentCount,
    conditionalClosureStatusDocumentCount,
  });
}

async function currentInventory() {
  const packageJson = JSON.parse(await readFile(resolve(WORKSPACE_ROOT, "package.json"), "utf8"));
  const workspaceManifestText = await readFile(
    resolve(WORKSPACE_ROOT, "pnpm-workspace.yaml"),
    "utf8",
  );
  const workspacePackages = [];
  const configurationPattern = /^(?:vite\.config|vitest\.config|vitest\.workspace)\.[^/]+$/u;
  const testConfigurationFiles = (await readdir(WORKSPACE_ROOT))
    .filter((file) => configurationPattern.test(file))
    .map((file) => file);
  for (const workspaceDirectory of ["apps", "packages"]) {
    const entries = await readdir(resolve(WORKSPACE_ROOT, workspaceDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageFiles = await readdir(resolve(WORKSPACE_ROOT, workspaceDirectory, entry.name));
      testConfigurationFiles.push(
        ...packageFiles
          .filter((file) => configurationPattern.test(file))
          .map((file) => `${workspaceDirectory}/${entry.name}/${file}`),
      );
      const manifestPath = resolve(WORKSPACE_ROOT, workspaceDirectory, entry.name, "package.json");
      try {
        workspacePackages.push(JSON.parse(await readFile(manifestPath, "utf8")));
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw error;
        }
      }
    }
  }
  const verifierFiles = (await readdir(resolve(WORKSPACE_ROOT, "scripts")))
    .filter((file) => file.startsWith("verify-") && file.endsWith(".mjs"))
    .filter((file) => file !== "verify-boundary-fixtures.mjs")
    .map((file) => `scripts/${file}`);
  const rootTestFiles = (await readdir(resolve(WORKSPACE_ROOT, "tests")))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `tests/${file}`);
  return {
    packageJson,
    verifierFiles,
    rootTestFiles,
    workspacePackages,
    testConfigurationFiles,
    workspaceManifestText,
  };
}

function clone(value) {
  return structuredClone(value);
}

async function runProcess(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    shell: false,
    stdio: "ignore",
  });
  const [code, signal] = await once(child, "close");
  assert.equal(signal, null);
  assert.equal(code, 0);
}

test("the current repository exactly matches the reviewed live proof inventory", async () => {
  const result = validateProofInventory(await currentInventory());
  assert.deepEqual(result, {
    proofCount: 113,
    verifierCount: 113,
    rootTestCount: 113,
    ciContractScriptCount: 5,
    ciContractScriptSha256: "92bcdb9435a1cb6492c20e5ad82013ac7d65479a15a5f5b5321b8e59351f6014",
    legacyPrerequisiteCount: 763,
    legacyPrerequisiteSha256: "a9b7b963ac77d33f6faca4bd352546736061955cdcd6525cde94a06bf4f318f5",
    legacyLeafInvocationCount: 4600,
    legacyLeafInvocationSha256: "c9eb237799a16582aea375c9ca3bb906c2f330913230682f97951e8a2f21277d",
    distinctLeafWorkloadCount: 358,
    distinctLeafWorkloadSha256: "6940ed2d22342db1d7f8ca536c4ebf08260de69d7014fef0973d9c07e31a560e",
    testConfigurationFileCount: 3,
    workspaceTestScriptCount: 19,
    workspaceTestScriptSha256: "4c2cd7854e3ed795fe38357166e12e5f199c73217a7c10b89505df24e5de6743",
    workspaceManifestSha256: "6c693fc7e2b55dfc4b2e84a9e267aef0b6aeecb3160a04cdba67ce570f860be9",
    workspacePackageGlobs: ["apps/*", "packages/*"],
  });
});

test("CI-02 pins the bounded baseline, first hosted receipt, and conditional closure", async () => {
  assert.deepEqual(validateCi02ContractDocuments(await currentCi02ContractDocuments()), {
    documentCount: 9,
    markerCount: 46,
    localBaselineCommandCount: 6,
    baselineBlockCount: 3,
    hostedReceiptDocumentCount: 3,
    conditionalClosureStatusDocumentCount: 4,
  });
});

test("living documentation stays within its reviewed role and line budget", async () => {
  const standards = await readFile(resolve(WORKSPACE_ROOT, DOCUMENTATION_STANDARDS_PATH), "utf8");
  const documentedContracts = parseLivingDocumentStandards(standards);
  assert.equal(documentedContracts.size, LIVING_DOCUMENT_CONTRACTS.length);
  assert.equal(countOccurrences(standards, PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT), 1);

  const commitExists = spawnSync(
    "git",
    ["cat-file", "-e", `${PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT}^{commit}`],
    { cwd: WORKSPACE_ROOT, encoding: "utf8" },
  );
  assert.equal(commitExists.status, 0, commitExists.stderr);
  const isAncestor = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT, "HEAD"],
    { cwd: WORKSPACE_ROOT, encoding: "utf8" },
  );
  assert.equal(isAncestor.status, 0, isAncestor.stderr);

  let archivedLineCount = 0;
  let currentLineCount = 0;
  let projectStatusSource = "";

  for (const contract of LIVING_DOCUMENT_CONTRACTS) {
    const source = await readFile(resolve(WORKSPACE_ROOT, contract.path), "utf8");
    const lineCount = countTextLines(source);
    assert.ok(
      lineCount <= contract.maximumLines,
      `${contract.path} has ${lineCount} lines; budget is ${contract.maximumLines}`,
    );
    assert.equal(
      countOccurrences(source, PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT),
      0,
      `${contract.path} duplicates the canonical archive hash`,
    );
    assert.equal(
      (
        source.match(/\]\([^)]*DOCUMENTATION-STANDARDS\.md#document-lifecycle-and-ownership\)/gu) ??
        []
      ).length,
      1,
      `${contract.path} must link to the canonical archive owner exactly once`,
    );
    assert.deepEqual(
      documentedContracts.get(contract.path),
      { purpose: contract.purpose, maximumLines: contract.maximumLines },
      `${contract.path} lifecycle contract drifted from documentation standards`,
    );
    const archivedDocument = spawnSync(
      "git",
      ["show", `${PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT}:${contract.path}`],
      { cwd: WORKSPACE_ROOT, encoding: "utf8" },
    );
    assert.equal(
      archivedDocument.status,
      0,
      `${contract.path} is not recoverable from the documented archive: ${archivedDocument.stderr}`,
    );
    archivedLineCount += countTextLines(archivedDocument.stdout);
    currentLineCount += lineCount;
    if (contract.path === "PROJECT-STATUS.md") {
      projectStatusSource = source;
    }
  }

  const reductionPercent = (
    ((archivedLineCount - currentLineCount) / archivedLineCount) *
    100
  ).toFixed(1);
  assert.ok(
    normalizeWhitespace(projectStatusSource).includes(
      `reduced from ${formatInteger(archivedLineCount)} to ${formatInteger(currentLineCount)} lines (${reductionPercent}%)`,
    ),
    "PROJECT-STATUS.md consolidation totals drifted from the recoverable documents",
  );
});

test("task board retains its canonical inventory without narrative appendices", async () => {
  const taskBoard = await readFile(resolve(WORKSPACE_ROOT, "docs/plan/TASKS.md"), "utf8");
  const archivedTaskBoardResult = spawnSync(
    "git",
    ["show", `${PRE_CONSOLIDATION_DOCUMENTATION_SNAPSHOT}:docs/plan/TASKS.md`],
    { cwd: WORKSPACE_ROOT, encoding: "utf8" },
  );
  assert.equal(archivedTaskBoardResult.status, 0, archivedTaskBoardResult.stderr);
  const { statuses, sectionStats, sectionOrder, rows, tableLineCount } = parseTaskBoard(taskBoard);
  const archivedTaskBoard = parseTaskBoard(archivedTaskBoardResult.stdout);
  const implementationIds = [...statuses.keys()].filter((id) => id.startsWith("M"));
  const gateIds = [...statuses.keys()].filter((id) => id.startsWith("G"));
  const operationalIds = [...statuses.keys()].filter(
    (id) => !id.startsWith("M") && !id.startsWith("G"),
  );

  assert.deepEqual(implementationIds.sort(), [...EXPECTED_IMPLEMENTATION_TASK_IDS].sort());
  assert.deepEqual(gateIds.sort(), [...EXPECTED_GATE_IDS].sort());
  assert.deepEqual(operationalIds.sort(), [...EXPECTED_OPERATIONAL_IDS].sort());
  assert.equal(statuses.size, 202);
  assert.equal(tableLineCount, statuses.size + EXPECTED_TASK_BOARD_SECTIONS.length * 2);
  assert.deepEqual(sectionOrder, EXPECTED_TASK_BOARD_SECTIONS);
  assertPreM11PlanningInventory({ rows, statuses });
  assert.deepEqual(
    historicalTaskBoardContentProjection(rows, true),
    historicalTaskBoardContentProjection(archivedTaskBoard.rows),
    "historical task dependencies, deliverables, evidence, or row order drifted from the M10 snapshot beyond the two authorized G10A dependency additions",
  );
  assert.deepEqual(
    splitMarkdownTableRow("| ID | Status | Depends on | Deliverable \\| evidence |"),
    ["ID", "Status", "Depends on", "Deliverable \\| evidence"],
  );
  assert.throws(
    () =>
      parseTaskBoard(
        requiredMutation(
          taskBoard,
          /^(\| ID\s+\|) Status(\s+\| Depends on\s+\| Deliverable \/ evidence\s+\|)$/mu,
          "$1 State$2",
          "task-board header",
        ),
      ),
    /invalid task-board header/u,
  );
  assert.throws(
    () =>
      parseTaskBoard(
        requiredMutation(
          taskBoard,
          /^(\| :?-{3,}:?\s+\|) :?-{3,}:?/mu,
          "$1 invalid",
          "task-board separator",
        ),
      ),
    /invalid task-board separator/u,
  );
  assert.throws(
    () =>
      parseTaskBoard(
        requiredMutation(
          taskBoard,
          /^(\| M02-T01 .*)\|$/mu,
          "$1| forged |",
          "task-board row width",
        ),
      ),
    /invalid row width/u,
  );
  assert.throws(
    () =>
      parseTaskBoard(
        requiredMutation(
          taskBoard,
          "## M10 — First end-to-end proof",
          "## M10-T01 — narrative appendix",
          "task-detail level-two heading",
        ),
      ),
    /task-board table appears outside a governed section/u,
  );
  for (const [section, stats] of sectionStats) {
    assert.equal(stats.headers, 1, `${section} must have one table header`);
    assert.equal(stats.separators, 1, `${section} must have one table separator`);
    assert.ok(stats.data > 0, `${section} must have canonical rows`);
  }
  assert.doesNotMatch(
    taskBoard,
    /^#{2,6}\s+(?:M\d{2}[A-Z]?-T\d{2}[A-Z]?|G\d{2}[A-Z]?|(?:CI|SEC|AR)-\d{2}|I\d{2}-\d{2})(?:\s|$)/mu,
  );

  const completedTasks = EXPECTED_IMPLEMENTATION_TASK_IDS.filter(
    (id) => statuses.get(id) === "DONE",
  ).length;
  const completedGates = EXPECTED_GATE_IDS.filter((id) => statuses.get(id) === "DONE").length;
  const completedM10Tasks = M10_TASK_IDS.filter((id) => statuses.get(id) === "DONE").length;
  const completedM10ATasks = M10A_TASK_IDS.filter((id) => statuses.get(id) === "DONE").length;
  const completionPercent = Math.round(
    (completedTasks / EXPECTED_IMPLEMENTATION_TASK_IDS.length) * 100,
  );
  const m10aCompletionPercent = Math.round((completedM10ATasks / M10A_TASK_IDS.length) * 100);
  assert.equal(completedTasks, EXPECTED_COMPLETED_IMPLEMENTATION_TASKS);
  assert.equal(completedGates, EXPECTED_COMPLETED_GATES);
  assert.equal(completedM10ATasks, 3);
  assert.equal(completionPercent, 70);
  assert.equal(m10aCompletionPercent, 11);

  const readme = await readFile(resolve(WORKSPACE_ROOT, "README.md"), "utf8");
  const projectStatus = await readFile(resolve(WORKSPACE_ROOT, "PROJECT-STATUS.md"), "utf8");
  const startHere = await readFile(resolve(WORKSPACE_ROOT, "docs/plan/START-HERE.tr.md"), "utf8");
  const strategicValidation = await readFile(
    resolve(WORKSPACE_ROOT, "docs/plan/STRATEGIC-VALIDATION.md"),
    "utf8",
  );
  const normalizedReadme = normalizeWhitespace(
    markdownH2Section(readme, "Implementation progress"),
  );
  const normalizedProjectStatus = normalizeWhitespace(
    markdownH2Section(projectStatus, "Current state"),
  );
  const normalizedStartHere = normalizeWhitespace(markdownH2Section(startHere, "Bugünkü konum"));
  const normalizedSc02 = normalizeWhitespace(
    markdownH2Section(strategicValidation, "SC-02 — Problem and pilot validation"),
  );
  assert.ok(
    normalizedReadme.includes(
      `**${completedTasks} / ${EXPECTED_IMPLEMENTATION_TASK_IDS.length} tasks complete (${completionPercent}%)**`,
    ),
  );
  assert.ok(
    normalizedReadme.includes(
      `**Proof gates:** **${completedGates} / ${EXPECTED_GATE_IDS.length} complete**`,
    ),
  );
  assert.ok(
    normalizedReadme.includes(
      `**${completedM10ATasks} / ${M10A_TASK_IDS.length} tasks complete (${m10aCompletionPercent}%)**`,
    ),
  );
  assert.ok(
    normalizedProjectStatus.includes(
      `**${completedTasks}/${EXPECTED_IMPLEMENTATION_TASK_IDS.length} tasks (${completionPercent}%)**`,
    ),
  );
  assert.ok(
    normalizedProjectStatus.includes(`M10 is **${completedM10Tasks}/${M10_TASK_IDS.length}**`),
  );
  assert.ok(
    normalizedProjectStatus.includes(
      `proof gates are **${completedGates}/${EXPECTED_GATE_IDS.length}**`,
    ),
  );
  assert.ok(
    normalizedStartHere.includes(
      `Uygulama ilerlemesi ${completedTasks}/${EXPECTED_IMPLEMENTATION_TASK_IDS.length} (%${completionPercent})`,
    ),
  );
  assert.ok(normalizedStartHere.includes(`M10 ${completedM10Tasks}/${M10_TASK_IDS.length}`));
  assert.ok(
    normalizedStartHere.includes(`kanıt kapıları ${completedGates}/${EXPECTED_GATE_IDS.length}`),
  );
  assert.ok(
    M11_TASK_IDS.every((id) => statuses.get(id) === "NOT_STARTED"),
    "M11 guidance says not started while an M11 task has a different status",
  );
  assert.equal(statuses.get("G11"), "NOT_STARTED");
  assert.ok(normalizedReadme.includes("**M11:** `NOT_STARTED`"));
  assert.ok(normalizedReadme.includes("**Active task:** none"));
  assert.ok(normalizedReadme.includes("**Next:** `M10A-T04` (dependency-ready but `NOT_STARTED`"));
  assert.ok(normalizedProjectStatus.includes("**M10A-T01, M10A-T02, and M10A-T03 are DONE**"));
  assert.ok(normalizedProjectStatus.includes("M11 has not started."));
  assert.ok(normalizedStartHere.includes("M11 başlamadı."));
  assert.equal(
    normalizedSc02.split(SC_02_COMPLETE_ADAPT_MARKER).length - 1,
    1,
    "SC-02 must record the exact complete/adapt decision once",
  );
  assert.doesNotMatch(readme, /^\*\*M\d{2}[A-Z]?-T\d{2}/gmu);
  assert.doesNotMatch(projectStatus, /^## M\d{2}[A-Z]?-T\d{2}/gmu);
});

test("pre-M11 planning inventory rejects row, dependency, count, or gate-status drift", async () => {
  const taskBoard = await readFile(resolve(WORKSPACE_ROOT, "docs/plan/TASKS.md"), "utf8");

  const removedRow = taskBoard.replace(`${taskBoardRowLine(taskBoard, "M10A-T14")}\n`, "");
  assert.throws(
    () => assertPreM11PlanningInventory(parseTaskBoard(removedRow)),
    /M10A task or gate inventory drifted/u,
  );

  const duplicateRow = taskBoard.replace(
    taskBoardRowLine(taskBoard, "M10A-T02"),
    `${taskBoardRowLine(taskBoard, "M10A-T02")}\n${taskBoardRowLine(taskBoard, "M10A-T02")}`,
  );
  assert.throws(() => parseTaskBoard(duplicateRow), /duplicate task-board ID M10A-T02/u);

  const unknownRow = taskBoard.replace(
    taskBoardRowLine(taskBoard, "G10A"),
    `| M10A-T29 | NOT_STARTED | M10A-T28 | Unreviewed planning row |\n${taskBoardRowLine(taskBoard, "G10A")}`,
  );
  assert.throws(
    () => assertPreM11PlanningInventory(parseTaskBoard(unknownRow)),
    /M10A task or gate inventory drifted/u,
  );

  const wrongDependency = replaceTaskBoardCell(taskBoard, "M10A-T22", 2, "M10A-T21");
  assert.throws(
    () => assertPreM11PlanningInventory(parseTaskBoard(wrongDependency)),
    /M10A-T22 dependency contract drifted/u,
  );

  const unknownDependency = replaceTaskBoardCell(taskBoard, "M10A-T02", 2, "M10A-T99");
  assert.throws(
    () => assertM10APlanningDag(parseTaskBoard(unknownDependency).rows),
    /M10A-T02 has unknown dependency M10A-T99/u,
  );

  const selfDependency = replaceTaskBoardCell(taskBoard, "M10A-T02", 2, "M10A-T02");
  assert.throws(
    () => assertM10APlanningDag(parseTaskBoard(selfDependency).rows),
    /M10A-T02 cannot depend on itself/u,
  );

  const unsupportedRange = replaceTaskBoardCell(taskBoard, "M10A-T02", 2, "M10A-T01–M10A-T99");
  assert.throws(
    () => assertM10APlanningDag(parseTaskBoard(unsupportedRange).rows),
    /M10A-T02 has an unsupported dependency range/u,
  );

  const cyclicDependencies = replaceTaskBoardCell(taskBoard, "M10A-T02", 2, "M10A-T03");
  assert.throws(
    () => assertM10APlanningDag(parseTaskBoard(cyclicDependencies).rows),
    /M10A dependency cycle reaches M10A-T02/u,
  );

  const falseGatePass = replaceTaskBoardCell(taskBoard, "G10A", 1, "DONE");
  assert.throws(
    () => assertPreM11PlanningInventory(parseTaskBoard(falseGatePass)),
    /G10A cannot pass before every M10A task is complete/u,
  );

  for (const status of ["IN_PROGRESS", "NOT_STARTED"]) {
    const falseTaskStatus = replaceTaskBoardCell(taskBoard, "M10A-T01", 1, status);
    assert.throws(
      () => assertPreM11PlanningInventory(parseTaskBoard(falseTaskStatus)),
      /M10A-T01 must remain DONE/u,
    );
  }
  for (const status of ["IN_PROGRESS", "NOT_STARTED"]) {
    const falseTaskStatus = replaceTaskBoardCell(taskBoard, "M10A-T02", 1, status);
    assert.throws(
      () => assertPreM11PlanningInventory(parseTaskBoard(falseTaskStatus)),
      /M10A-T02 must remain DONE/u,
    );
  }
  for (const status of ["IN_PROGRESS", "NOT_STARTED", "BLOCKED"]) {
    const falseTaskStatus = replaceTaskBoardCell(taskBoard, "M10A-T03", 1, status);
    assert.throws(
      () => assertPreM11PlanningInventory(parseTaskBoard(falseTaskStatus)),
      /M10A-T03 must remain DONE/u,
    );
  }
});

test("M11 guidance pins the complete Runtime Core baseline authority", async () => {
  for (const relativePath of RUNTIME_CORE_BASELINE_DOCUMENTS) {
    const source = await readFile(resolve(WORKSPACE_ROOT, relativePath), "utf8");
    assert.equal(
      countOccurrences(source, RUNTIME_CORE_BASELINE_TREE),
      1,
      `${relativePath} must contain the exact Runtime Core baseline once`,
    );
  }
});

test("CI-02 rejects baseline, evidence, completion, freshness, or rollback wording drift", async () => {
  const documents = await currentCi02ContractDocuments();
  const mutations = [
    [
      "README.md",
      "**CI-02:** conditional `DONE` on this exact PR head's hosted `Quality gate`",
      "**CI-02:** `DONE`",
    ],
    ["AGENTS.md", "pnpm boundaries", "pnpm test"],
    [
      "docs/standards/CI-QUALITY-GATE.md",
      "The baseline is deliberately non-authoritative early feedback.",
      "The baseline completes the task.",
    ],
    [
      "CONTRIBUTING.md",
      "and relevant negative tests are still mandatory.",
      "task-specific verification is optional",
    ],
    [
      "docs/adr/0011-modular-proof-infrastructure.md",
      "Merge or a completion report requires the hosted `Quality gate` to pass on the exact current",
      "Merge may use any earlier hosted result",
    ],
    [
      "AGENTS.md",
      "identity and impact authority, never cached success",
      "identity, impact, and cached success authority",
    ],
    [
      "scripts/ci/README.md",
      "and leaves I07-05 plus the manual legacy",
      "retires I07-05 and the manual legacy rollback path",
    ],
  ];

  for (const [relativePath, marker, replacement] of mutations) {
    assert.equal(documents[relativePath].split(marker).length - 1, 1, `${relativePath}: ${marker}`);
    const drifted = {
      ...documents,
      [relativePath]: documents[relativePath].replace(marker, replacement),
    };
    assert.throws(() => validateCi02ContractDocuments(drifted), /CI-02 contract marker drifted/u);
  }

  for (const [marker, replacement] of [
    [CI_02_FIRST_HOSTED_RECEIPT.headSha, "0000000000000000000000000000000000000000"],
    [CI_02_FIRST_HOSTED_RECEIPT.runId, "33196876165"],
    [CI_02_FIRST_HOSTED_RECEIPT.jobId, "98936152887"],
    [CI_02_FIRST_HOSTED_RECEIPT.duration, "14m52s"],
  ]) {
    assert.ok(documents["docs/plan/TASKS.md"].includes(marker));
    const driftedReceipt = {
      ...documents,
      "docs/plan/TASKS.md": documents["docs/plan/TASKS.md"].replace(marker, replacement),
    };
    assert.throws(
      () => validateCi02ContractDocuments(driftedReceipt),
      /CI-02 hosted receipt drifted/u,
    );
  }

  const baselineTerminator = `${CI_02_LOCAL_BASELINE.at(-1)}\n\`\`\``;
  assert.equal(documents["AGENTS.md"].split(baselineTerminator).length - 1, 1);
  const extraCommand = {
    ...documents,
    "AGENTS.md": documents["AGENTS.md"].replace(
      baselineTerminator,
      `${CI_02_LOCAL_BASELINE.at(-1)}\npnpm test\n\`\`\``,
    ),
  };
  assert.throws(
    () => validateCi02ContractDocuments(extraCommand),
    /CI-02 baseline command block drifted/u,
  );

  for (const [relativePath, contradiction] of [
    ["docs/plan/TASKS.md", "\n| CI-02 | DONE | I07-04 | contradictory | none |\n"],
    ["PROJECT-STATUS.md", "\nCI-02 is `DONE`.\n"],
    ["README.md", "\n**CI-02:** `DONE`\n"],
    ["docs/plan/START-HERE.tr.md", "\nCI-02 `DONE` durumundadır.\n"],
  ]) {
    const unconditionalDone = {
      ...documents,
      [relativePath]: `${documents[relativePath]}${contradiction}`,
    };
    assert.throws(
      () => validateCi02ContractDocuments(unconditionalDone),
      /CI-02 conditional-closure status drifted/u,
    );
  }

  const reusedPriorReceipt = {
    ...documents,
    "docs/plan/TASKS.md": `${documents["docs/plan/TASKS.md"]}\nThe prior receipt authorizes this new head.\n`,
  };
  assert.throws(
    () => validateCi02ContractDocuments(reusedPriorReceipt),
    /CI-02 prior-receipt authority drifted/u,
  );
});

test("inventory validation rejects a missing verifier file", async () => {
  const inventory = await currentInventory();
  inventory.verifierFiles.pop();
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects an unexpected root proof test", async () => {
  const inventory = await currentInventory();
  inventory.rootTestFiles.push("tests/unreviewed.test.mjs");
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects duplicate proof ownership", async () => {
  const inventory = await currentInventory();
  const duplicateEntries = [...PROOF_ENTRIES, PROOF_ENTRIES[0]];
  assert.throws(
    () => validateProofInventory({ ...inventory, proofEntries: duplicateEntries }),
    QualityGateError,
  );
});

test("inventory validation rejects a reordered legacy proof pipeline", async () => {
  const inventory = await currentInventory();
  inventory.packageJson = clone(inventory.packageJson);
  const commands = inventory.packageJson.scripts.check.split(" && ");
  [commands[1], commands[2]] = [commands[2], commands[1]];
  inventory.packageJson.scripts.check = commands.join(" && ");
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("inventory validation rejects verifier and test wiring drift", async () => {
  const verifierInventory = await currentInventory();
  verifierInventory.packageJson = clone(verifierInventory.packageJson);
  verifierInventory.packageJson.scripts["verify:protocol-snapshot"] =
    "node scripts/verify-protocol-types.mjs";
  assert.throws(() => validateProofInventory(verifierInventory), QualityGateError);

  const testInventory = await currentInventory();
  testInventory.packageJson = clone(testInventory.packageJson);
  testInventory.packageJson.scripts["test:protocol-snapshot"] =
    "node --test tests/protocol-types.test.mjs";
  assert.throws(() => validateProofInventory(testInventory), QualityGateError);
});

test("inventory validation pins promoted CI entry points and their focused contracts", async () => {
  const expectedScripts = {
    "ci:required": "node scripts/ci/run-required-affected-quality-gate.mjs",
    "test:ci-quality-gate": "node --test scripts/test/ci-quality-gate.test.mjs",
    "verify:affected-selector-promotion-evidence":
      "node scripts/ci/verify-affected-selector-promotion-evidence.mjs",
    "test:affected-selector-promotion-evidence":
      "node --test scripts/ci/test/affected-selector-promotion-evidence.test.mjs",
    "test:required-affected-quality-gate":
      "node --test scripts/ci/test/required-affected-quality-gate.test.mjs",
  };
  const inventory = await currentInventory();
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(expectedScripts).map((name) => [name, inventory.packageJson.scripts[name]]),
    ),
    expectedScripts,
  );

  for (const name of Object.keys(expectedScripts)) {
    const drifted = await currentInventory();
    drifted.packageJson = clone(drifted.packageJson);
    drifted.packageJson.scripts[name] += " --unreviewed";
    assert.throws(
      () => validateProofInventory(drifted),
      (error) =>
        error instanceof QualityGateError && /CI contract package script/u.test(error.message),
    );
  }
});

test("inventory validation rejects added, removed, or unclassified legacy prerequisites", async () => {
  const classifiedAddedInventory = await currentInventory();
  classifiedAddedInventory.packageJson = clone(classifiedAddedInventory.packageJson);
  classifiedAddedInventory.packageJson.scripts["verify:sc-01-dtcg-compatibility"] =
    "pnpm --filter @desen/reference-catalog-web... build && node scripts/verify-sc-01-dtcg.mjs";
  assert.throws(
    () => validateProofInventory(classifiedAddedInventory),
    (error) =>
      error instanceof QualityGateError &&
      /reviewed legacy prerequisite inventory drifted/u.test(error.message),
  );

  const commandEventRebuildInventory = await currentInventory();
  commandEventRebuildInventory.packageJson = clone(commandEventRebuildInventory.packageJson);
  commandEventRebuildInventory.packageJson.scripts["verify:runtime-core-command-event-actions"] =
    "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-command-event-actions.mjs";
  assert.throws(
    () => validateProofInventory(commandEventRebuildInventory),
    (error) =>
      error instanceof QualityGateError &&
      /reviewed legacy prerequisite inventory drifted/u.test(error.message),
  );

  const reactiveRebuildInventory = await currentInventory();
  reactiveRebuildInventory.packageJson = clone(reactiveRebuildInventory.packageJson);
  reactiveRebuildInventory.packageJson.scripts["verify:runtime-core-reactive-reevaluation"] =
    "pnpm --filter @desen/runtime-core... build && node scripts/verify-runtime-core-reactive-reevaluation.mjs";
  assert.throws(
    () => validateProofInventory(reactiveRebuildInventory),
    (error) =>
      error instanceof QualityGateError &&
      /reviewed legacy prerequisite inventory drifted/u.test(error.message),
  );

  const addedInventory = await currentInventory();
  addedInventory.packageJson = clone(addedInventory.packageJson);
  addedInventory.packageJson.scripts["verify:protocol-types"] =
    "pnpm audit:future-proof && node scripts/verify-protocol-types.mjs";
  assert.throws(() => validateProofInventory(addedInventory), QualityGateError);

  const removedInventory = await currentInventory();
  removedInventory.packageJson = clone(removedInventory.packageJson);
  removedInventory.packageJson.scripts["test:protocol-diagnostics"] =
    "node --test tests/protocol-diagnostics.test.mjs";
  assert.throws(() => validateProofInventory(removedInventory), QualityGateError);
});

test("inventory validation pins the recursively expanded legacy leaf workloads", async () => {
  const distinctInventory = await currentInventory();
  distinctInventory.packageJson = clone(distinctInventory.packageJson);
  distinctInventory.packageJson.scripts["format:check"] = "prettier docs --check";
  assert.throws(
    () => validateProofInventory(distinctInventory),
    (error) =>
      error instanceof QualityGateError &&
      /distinct legacy leaf workload inventory drifted/u.test(error.message),
  );

  const orderedInventory = await currentInventory();
  orderedInventory.packageJson = clone(orderedInventory.packageJson);
  orderedInventory.packageJson.scripts.lint = orderedInventory.packageJson.scripts.lint
    .split(" && ")
    .reverse()
    .join(" && ");
  assert.throws(
    () => validateProofInventory(orderedInventory),
    (error) =>
      error instanceof QualityGateError &&
      /ordered legacy leaf invocation inventory drifted/u.test(error.message),
  );
});

test("every focused prerequisite remains a subset of the full package test", async () => {
  const inventory = await currentInventory();
  inventory.workspacePackages = clone(inventory.workspacePackages);
  const protocolManifest = inventory.workspacePackages.find(
    ({ name }) => name === "@desen/protocol",
  );
  protocolManifest.scripts.test = "vitest run test/canonicalization.test.ts";
  assert.throws(() => validateProofInventory(inventory), QualityGateError);
});

test("direct focused-package prerequisites require their exact reviewed proof and command", async () => {
  const selectorInventory = await currentInventory();
  selectorInventory.packageJson = clone(selectorInventory.packageJson);
  selectorInventory.packageJson.scripts["verify:runtime-react-reconciliation-diagnostics"] =
    selectorInventory.packageJson.scripts[
      "verify:runtime-react-reconciliation-diagnostics"
    ].replace(
      "pnpm --filter @desen/runtime-react exec vitest run",
      "pnpm --filter @desen/runtime-react... exec vitest run",
    );
  assert.throws(
    () => validateProofInventory(selectorInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed direct focused-package test command/u.test(error.message),
  );

  const proofInventory = await currentInventory();
  proofInventory.packageJson = clone(proofInventory.packageJson);
  const directCommand = proofInventory.packageJson.scripts[
    "verify:runtime-react-reconciliation-diagnostics"
  ]
    .split(" && ")
    .at(-2);
  proofInventory.packageJson.scripts["verify:runtime-react-interactions"] = `${directCommand} && ${
    proofInventory.packageJson.scripts["verify:runtime-react-interactions"]
  }`;
  assert.throws(
    () => validateProofInventory(proofInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed direct focused-package test command/u.test(error.message),
  );

  const scriptInventory = await currentInventory();
  scriptInventory.workspacePackages = clone(scriptInventory.workspacePackages);
  const runtimeReactManifest = scriptInventory.workspacePackages.find(
    ({ name }) => name === "@desen/runtime-react",
  );
  runtimeReactManifest.scripts["test:reconciliation-diagnostics"] =
    "vitest run test/reconciliation.test.ts";
  assert.throws(
    () => validateProofInventory(scriptInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed direct focused-package test command/u.test(error.message),
  );
});

test("direct proof-verifier prerequisites require their exact reviewed proof and command", async () => {
  const commandInventory = await currentInventory();
  commandInventory.packageJson = clone(commandInventory.packageJson);
  commandInventory.packageJson.scripts["verify:desen-app-catalog-panel-layer-tree"] =
    commandInventory.packageJson.scripts["verify:desen-app-catalog-panel-layer-tree"].replace(
      "node scripts/verify-desen-app-shell-navigation.mjs",
      "node scripts/verify-protocol-snapshot.mjs",
    );
  assert.throws(
    () => validateProofInventory(commandInventory),
    (error) =>
      error instanceof QualityGateError && /unclassified legacy prerequisite/u.test(error.message),
  );

  const proofInventory = await currentInventory();
  proofInventory.packageJson = clone(proofInventory.packageJson);
  proofInventory.packageJson.scripts["verify:desen-app-shell-navigation"] =
    `node scripts/verify-reference-catalog-web-capability-artifact.mjs && ${
      proofInventory.packageJson.scripts["verify:desen-app-shell-navigation"]
    }`;
  assert.throws(
    () => validateProofInventory(proofInventory),
    (error) =>
      error instanceof QualityGateError && /unclassified legacy prerequisite/u.test(error.message),
  );

  const adapterInventory = await currentInventory();
  adapterInventory.packageJson = clone(adapterInventory.packageJson);
  adapterInventory.packageJson.scripts["verify:desen-app-real-adapter-canvas"] =
    adapterInventory.packageJson.scripts["verify:desen-app-real-adapter-canvas"].replace(
      "node scripts/verify-reference-host-web-source-audit.mjs",
      "node scripts/verify-reference-catalog-web-capability-artifact.mjs",
    );
  assert.throws(
    () => validateProofInventory(adapterInventory),
    (error) =>
      error instanceof QualityGateError && /unclassified legacy prerequisite/u.test(error.message),
  );

  const persistenceInventory = await currentInventory();
  persistenceInventory.packageJson = clone(persistenceInventory.packageJson);
  persistenceInventory.packageJson.scripts["verify:desen-app-source-persistence"] =
    persistenceInventory.packageJson.scripts["verify:desen-app-source-persistence"].replace(
      "node scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs",
      "node scripts/verify-desen-app-design-run-modes.mjs",
    );
  assert.throws(
    () => validateProofInventory(persistenceInventory),
    (error) =>
      error instanceof QualityGateError && /unclassified legacy prerequisite/u.test(error.message),
  );
});

test("inventory validation rejects hidden test configuration and manifest overrides", async () => {
  const configInventory = await currentInventory();
  configInventory.testConfigurationFiles.push("packages/runtime-core/vitest.config.ts");
  assert.throws(() => validateProofInventory(configInventory), QualityGateError);

  const rootFieldInventory = await currentInventory();
  rootFieldInventory.packageJson = clone(rootFieldInventory.packageJson);
  rootFieldInventory.packageJson.vitest = { test: { exclude: ["tests/**"] } };
  assert.throws(() => validateProofInventory(rootFieldInventory), QualityGateError);

  const packageFieldInventory = await currentInventory();
  packageFieldInventory.workspacePackages = clone(packageFieldInventory.workspacePackages);
  const runtimeCoreManifest = packageFieldInventory.workspacePackages.find(
    ({ name }) => name === "@desen/runtime-core",
  );
  runtimeCoreManifest.vitest = { test: { exclude: ["test/predicate-evaluation.test.ts"] } };
  assert.throws(() => validateProofInventory(packageFieldInventory), QualityGateError);
});

test("both inventories require exact browser-proof scripts and the three reviewed Vite configs", async () => {
  const baseline = await currentInventory();
  const starter = baseline.workspacePackages.find(
    ({ name }) => name === "@desen/starter-catalog-web-proof",
  );
  const workbench = baseline.workspacePackages.find(
    ({ name }) => name === "@desen/design-system-workbench-proof",
  );
  assert.ok(starter);
  assert.ok(workbench);
  for (const validate of [validateProofInventory, validateRepositoryWorkloadInputs]) {
    assert.equal(validate(baseline).proofCount, 113);
    const missingWorkbenchPackage = clone(baseline);
    missingWorkbenchPackage.workspacePackages = missingWorkbenchPackage.workspacePackages.filter(
      ({ name }) => name !== "@desen/design-system-workbench-proof",
    );
    assert.throws(
      () => validate(missingWorkbenchPackage),
      /workspace package test-script inventory drifted|design-system workbench proof workspace package is missing/u,
    );
    for (const script of Object.keys(starter.scripts)) {
      const substituted = clone(baseline);
      substituted.workspacePackages.find(
        ({ name }) => name === "@desen/starter-catalog-web-proof",
      ).scripts[script] = "echo skipped";
      assert.throws(
        () => validate(substituted),
        /starter browser proof workspace package script drifted/u,
      );
    }
    const widened = clone(baseline);
    widened.workspacePackages.find(
      ({ name }) => name === "@desen/starter-catalog-web-proof",
    ).scripts["test:e2e:skip"] = "echo skipped";
    assert.throws(() => validate(widened), /starter browser proof workspace package script set/u);

    for (const script of Object.keys(workbench.scripts)) {
      const substituted = clone(baseline);
      substituted.workspacePackages.find(
        ({ name }) => name === "@desen/design-system-workbench-proof",
      ).scripts[script] = "echo skipped";
      assert.throws(
        () => validate(substituted),
        /design-system workbench proof workspace package script drifted/u,
      );
    }
    const widenedWorkbench = clone(baseline);
    widenedWorkbench.workspacePackages.find(
      ({ name }) => name === "@desen/design-system-workbench-proof",
    ).scripts["test:e2e:skip"] = "echo skipped";
    assert.throws(
      () => validate(widenedWorkbench),
      /design-system workbench proof workspace package script set/u,
    );

    const missing = clone(baseline);
    missing.testConfigurationFiles = missing.testConfigurationFiles.filter(
      (file) => file !== "apps/starter-catalog-web-proof/vite.config.ts",
    );
    assert.throws(() => validate(missing), /test-configuration file set/u);
    const missingWorkbench = clone(baseline);
    missingWorkbench.testConfigurationFiles = missingWorkbench.testConfigurationFiles.filter(
      (file) => file !== "apps/design-system-workbench-proof/vite.config.ts",
    );
    assert.throws(() => validate(missingWorkbench), /test-configuration file set/u);
    const foreign = clone(baseline);
    foreign.testConfigurationFiles.push("packages/starter-catalog-web/vitest.config.ts");
    assert.throws(() => validate(foreign), /test-configuration file set/u);
  }
});

test("every hosted route that can execute T01 or T03 installs its exact Chromium runtime first", async () => {
  const source = await readFile(resolve(WORKSPACE_ROOT, ".github/workflows/ci.yml"), "utf8");
  runToolchainSecurityProbe(
    ["json-schema-to-typescript", "js-yaml"],
    ({ assert, dependency: yaml, parameters }) => {
      const load = yaml.DEFAULT_SAFE_SCHEMA ? yaml.safeLoad : yaml.load;
      const workflow = load(parameters.source);
      const command =
        "pnpm --filter @desen/starter-catalog-web-proof exec playwright install --with-deps chromium";
      const routes = [
        ["proof-c", "Run fresh exhaustive shard"],
        ["quality", "Run required quality gate"],
        ["legacy-rollback", "Run retained legacy rollback"],
      ];
      const validate = (candidate) => {
        for (const [jobId, executionName] of routes) {
          const steps = candidate.jobs[jobId].steps;
          const installs = steps.filter(
            ({ name }) => name === "Install starter proof Chromium runtime",
          );
          assert.equal(installs.length, 1, `${jobId} must install Chromium exactly once`);
          assert.equal(installs[0].run, command);
          assert.equal(
            installs[0].if,
            jobId === "quality"
              ? "${{ needs.quality-route.outputs.mode == 'AFFECTED' }}"
              : undefined,
          );
          const installIndex = steps.indexOf(installs[0]);
          assert.ok(
            installIndex > steps.findIndex(({ name }) => name === "Install exact dependencies"),
          );
          assert.ok(installIndex < steps.findIndex(({ name }) => name === executionName));
        }
        const existingBrowserInstall = candidate.jobs["browser-e2e"].steps.filter(
          ({ name }) => name === "Install Chromium runtime",
        );
        assert.equal(existingBrowserInstall.length, 1);
        assert.equal(
          existingBrowserInstall[0].run,
          "pnpm --filter @desen/app-browser-e2e exec playwright install --with-deps chromium",
        );
      };
      validate(workflow);
      for (const [jobId] of routes) {
        for (const mutate of [
          (steps, index) => steps.splice(index, 1),
          (steps, index) => {
            steps[index].run = "echo skipped";
          },
          (steps, index) => {
            steps[index].if = "false";
          },
          (steps, index) => steps.push(...steps.splice(index, 1)),
        ]) {
          const candidate = structuredClone(workflow);
          const steps = candidate.jobs[jobId].steps;
          mutate(
            steps,
            steps.findIndex(({ name }) => name === "Install starter proof Chromium runtime"),
          );
          assert.throws(() => validate(candidate));
        }
      }
    },
    { source },
  );
});

test("inventory validation pins every workspace package test command", async () => {
  const inventory = await currentInventory();
  inventory.workspacePackages = clone(inventory.workspacePackages);
  const publisherManifest = inventory.workspacePackages.find(
    ({ name }) => name === "@desen/publisher",
  );
  publisherManifest.scripts.test = "echo skipped";
  assert.throws(() => validateProofInventory(inventory), QualityGateError);

  const shellInventory = await currentInventory();
  shellInventory.workspacePackages = clone(shellInventory.workspacePackages);
  const shellPublisherManifest = shellInventory.workspacePackages.find(
    ({ name }) => name === "@desen/publisher",
  );
  shellPublisherManifest.scripts.test = "vitest run || true";
  assert.throws(
    () => validateProofInventory(shellInventory),
    (error) => error instanceof QualityGateError && /unsafe shell syntax/u.test(error.message),
  );

  const browserE2eInventory = await currentInventory();
  browserE2eInventory.workspacePackages = clone(browserE2eInventory.workspacePackages);
  const browserE2eManifest = browserE2eInventory.workspacePackages.find(
    ({ name }) => name === "@desen/app-browser-e2e",
  );
  browserE2eManifest.scripts.typecheck = "tsc --noEmit";
  assert.throws(
    () => validateProofInventory(browserE2eInventory),
    (error) =>
      error instanceof QualityGateError &&
      /Browser E2E workspace package script drifted/u.test(error.message),
  );

  const rootOwnedDirectProof = await currentInventory();
  rootOwnedDirectProof.packageJson = clone(rootOwnedDirectProof.packageJson);
  rootOwnedDirectProof.packageJson.scripts["test:desen-app-browser-e2e-workspace-compatibility"] =
    "node --test tests/desen-app-browser-e2e-workspace-compatibility.test.mjs";
  assert.throws(
    () => validateProofInventory(rootOwnedDirectProof),
    (error) =>
      error instanceof QualityGateError &&
      /must remain a direct CI proof pair/u.test(error.message),
  );

  const productRootOwnedDirectProof = await currentInventory();
  productRootOwnedDirectProof.packageJson = clone(productRootOwnedDirectProof.packageJson);
  productRootOwnedDirectProof.packageJson.scripts["test:desen-app-user-created-blank-project"] =
    "node --test tests/desen-app-user-created-blank-project.test.mjs";
  assert.throws(
    () => validateProofInventory(productRootOwnedDirectProof),
    (error) =>
      error instanceof QualityGateError &&
      /must remain a direct CI proof pair/u.test(error.message),
  );

  const publicPackageInventory = await currentInventory();
  publicPackageInventory.workspacePackages = clone(publicPackageInventory.workspacePackages);
  const editorWebManifest = publicPackageInventory.workspacePackages.find(
    ({ name }) => name === "@desen/editor-web",
  );
  editorWebManifest.scripts["test:public-package"] = "node --test test/public-package.mjs";
  assert.throws(
    () => validateProofInventory(publicPackageInventory),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed public-package contract test/u.test(error.message),
  );

  const substitutedPublicPackage = await currentInventory();
  substitutedPublicPackage.packageJson.scripts["verify:desen-app-publish-activation"] =
    substitutedPublicPackage.packageJson.scripts["verify:desen-app-publish-activation"].replace(
      "pnpm --filter @desen/editor-web test:public-package",
      "pnpm --filter @desen/editor-core test:public-package",
    );
  assert.throws(
    () => validateProofInventory(substitutedPublicPackage),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed public-package contract test/u.test(error.message),
  );

  const substitutedAuthoringPublicPackage = await currentInventory();
  substitutedAuthoringPublicPackage.packageJson.scripts["verify:m10a-t03"] =
    substitutedAuthoringPublicPackage.packageJson.scripts["verify:m10a-t03"].replace(
      "pnpm --filter @desen/design-system-authoring test:public-package",
      "pnpm --filter @desen/design-system-core test:public-package",
    );
  assert.throws(
    () => validateProofInventory(substitutedAuthoringPublicPackage),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed public-package contract test/u.test(error.message),
  );

  const substitutedWorkbench = await currentInventory();
  substitutedWorkbench.packageJson.scripts["verify:m10a-t03"] =
    substitutedWorkbench.packageJson.scripts["verify:m10a-t03"].replace(
      "pnpm --filter @desen/design-system-workbench-proof test:e2e",
      "pnpm --filter @desen/starter-catalog-web-proof test:e2e",
    );
  assert.throws(
    () => validateProofInventory(substitutedWorkbench),
    (error) =>
      error instanceof QualityGateError &&
      /unreviewed browser-proof package test/u.test(error.message),
  );
});

test("inventory validation pins the exact pnpm workspace manifest and package globs", async () => {
  const excludedPackage = await currentInventory();
  excludedPackage.workspaceManifestText = excludedPackage.workspaceManifestText.replace(
    '  - "packages/*"\n',
    "",
  );
  assert.throws(() => validateProofInventory(excludedPackage), QualityGateError);

  const addedRoot = await currentInventory();
  addedRoot.workspaceManifestText = addedRoot.workspaceManifestText.replace(
    '  - "packages/*"\n',
    '  - "packages/*"\n  - "."\n',
  );
  assert.throws(() => validateProofInventory(addedRoot), QualityGateError);
});

test("the execution plan contains no generator, writer, shell, or changed-file shortcut", () => {
  const steps = createQualityGateSteps();
  assert.equal(steps.length, 238);
  assert.equal(steps.filter(({ id }) => id.startsWith("test-")).length, 113);
  assert.deepEqual(
    steps.find(({ id }) => id === "editor-core-public-package-contract"),
    {
      id: "editor-core-public-package-contract",
      label: "Editor core public-package contract",
      command: "pnpm",
      args: ["--filter", "@desen/editor-core", "test:public-package"],
    },
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "editor-core-public-package-contract"),
    steps.findIndex(({ id }) => id === "package-tests") + 1,
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "editor-web-public-package-contract"),
    {
      id: "editor-web-public-package-contract",
      label: "Editor Web public-package contract",
      command: "pnpm",
      args: ["--filter", "@desen/editor-web", "test:public-package"],
    },
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "editor-web-public-package-contract"),
    steps.findIndex(({ id }) => id === "editor-core-public-package-contract") + 1,
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "design-system-core-public-package-contract"),
    {
      id: "design-system-core-public-package-contract",
      label: "Design System Core public-package contract",
      command: "pnpm",
      args: ["--filter", "@desen/design-system-core", "test:public-package"],
    },
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "design-system-core-public-package-contract"),
    steps.findIndex(({ id }) => id === "editor-web-public-package-contract") + 1,
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "design-system-core-public-package-contract") <
      steps.findIndex(({ id }) => id === "verify-m10a-t02"),
    true,
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "design-system-authoring-public-package-contract"),
    {
      id: "design-system-authoring-public-package-contract",
      label: "Design System Authoring public-package contract",
      command: "pnpm",
      args: ["--filter", "@desen/design-system-authoring", "test:public-package"],
    },
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "design-system-authoring-public-package-contract"),
    steps.findIndex(({ id }) => id === "design-system-core-public-package-contract") + 1,
  );
  assert.equal(
    steps.findIndex(({ id }) => id === "design-system-authoring-public-package-contract") <
      steps.findIndex(({ id }) => id === "verify-m10a-t03"),
    true,
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-editor-core-continuous-validation"),
    {
      id: "verify-editor-core-continuous-validation",
      label: "Proof verifier: editor-core-continuous-validation",
      command: "node",
      args: ["scripts/verify-editor-core-continuous-validation.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-editor-core-terminal-integration"),
    {
      id: "verify-editor-core-terminal-integration",
      label: "Proof verifier: editor-core-terminal-integration",
      command: "node",
      args: ["scripts/verify-editor-core-terminal-integration.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-catalog-panel-layer-tree"),
    {
      id: "verify-desen-app-catalog-panel-layer-tree",
      label: "Proof verifier: desen-app-catalog-panel-layer-tree",
      command: "node",
      args: ["scripts/verify-desen-app-catalog-panel-layer-tree.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-catalog-panel-layer-tree"),
    {
      id: "test-desen-app-catalog-panel-layer-tree",
      label: "Root proof and mutation test: desen-app-catalog-panel-layer-tree",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-catalog-panel-layer-tree.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-real-adapter-canvas"),
    {
      id: "verify-desen-app-real-adapter-canvas",
      label: "Proof verifier: desen-app-real-adapter-canvas",
      command: "node",
      args: ["scripts/verify-desen-app-real-adapter-canvas.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-real-adapter-canvas"),
    {
      id: "test-desen-app-real-adapter-canvas",
      label: "Root proof and mutation test: desen-app-real-adapter-canvas",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-real-adapter-canvas.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-selection-overlay"),
    {
      id: "verify-desen-app-selection-overlay",
      label: "Proof verifier: desen-app-selection-overlay",
      command: "node",
      args: ["scripts/verify-desen-app-selection-overlay.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-selection-overlay"),
    {
      id: "test-desen-app-selection-overlay",
      label: "Root proof and mutation test: desen-app-selection-overlay",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-selection-overlay.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-schema-inspector"),
    {
      id: "verify-desen-app-schema-inspector",
      label: "Proof verifier: desen-app-schema-inspector",
      command: "node",
      args: ["scripts/verify-desen-app-schema-inspector.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-schema-inspector"),
    {
      id: "test-desen-app-schema-inspector",
      label: "Root proof and mutation test: desen-app-schema-inspector",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-schema-inspector.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-structured-inspector"),
    {
      id: "verify-desen-app-structured-inspector",
      label: "Proof verifier: desen-app-structured-inspector",
      command: "node",
      args: ["scripts/verify-desen-app-structured-inspector.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-structured-inspector"),
    {
      id: "test-desen-app-structured-inspector",
      label: "Root proof and mutation test: desen-app-structured-inspector",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-structured-inspector.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-named-slot-authoring"),
    {
      id: "verify-desen-app-named-slot-authoring",
      label: "Proof verifier: desen-app-named-slot-authoring",
      command: "node",
      args: ["scripts/verify-desen-app-named-slot-authoring.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-named-slot-authoring"),
    {
      id: "test-desen-app-named-slot-authoring",
      label: "Root proof and mutation test: desen-app-named-slot-authoring",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-named-slot-authoring.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-state-binding-editor"),
    {
      id: "verify-desen-app-state-binding-editor",
      label: "Proof verifier: desen-app-state-binding-editor",
      command: "node",
      args: ["scripts/verify-desen-app-state-binding-editor.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-state-binding-editor"),
    {
      id: "test-desen-app-state-binding-editor",
      label: "Root proof and mutation test: desen-app-state-binding-editor",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-state-binding-editor.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-event-action-editor"),
    {
      id: "verify-desen-app-event-action-editor",
      label: "Proof verifier: desen-app-event-action-editor",
      command: "node",
      args: ["scripts/verify-desen-app-event-action-editor.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-event-action-editor"),
    {
      id: "test-desen-app-event-action-editor",
      label: "Root proof and mutation test: desen-app-event-action-editor",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-event-action-editor.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-design-run-modes"),
    {
      id: "verify-desen-app-design-run-modes",
      label: "Proof verifier: desen-app-design-run-modes",
      command: "node",
      args: ["scripts/verify-desen-app-design-run-modes.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-design-run-modes"),
    {
      id: "test-desen-app-design-run-modes",
      label: "Root proof and mutation test: desen-app-design-run-modes",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-design-run-modes.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-fixtures-scenarios-fidelity"),
    {
      id: "verify-desen-app-fixtures-scenarios-fidelity",
      label: "Proof verifier: desen-app-fixtures-scenarios-fidelity",
      command: "node",
      args: ["scripts/verify-desen-app-fixtures-scenarios-fidelity.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-fixtures-scenarios-fidelity"),
    {
      id: "test-desen-app-fixtures-scenarios-fidelity",
      label: "Root proof and mutation test: desen-app-fixtures-scenarios-fidelity",
      command: "node",
      args: [
        "--test",
        "--test-concurrency=1",
        "tests/desen-app-fixtures-scenarios-fidelity.test.mjs",
      ],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-source-persistence"),
    {
      id: "verify-desen-app-source-persistence",
      label: "Proof verifier: desen-app-source-persistence",
      command: "node",
      args: ["scripts/verify-desen-app-source-persistence.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-source-persistence"),
    {
      id: "test-desen-app-source-persistence",
      label: "Root proof and mutation test: desen-app-source-persistence",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-source-persistence.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-publish-activation"),
    {
      id: "verify-desen-app-publish-activation",
      label: "Proof verifier: desen-app-publish-activation",
      command: "node",
      args: ["scripts/verify-desen-app-publish-activation.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-publish-activation"),
    {
      id: "test-desen-app-publish-activation",
      label: "Root proof and mutation test: desen-app-publish-activation",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-publish-activation.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-empty-project-browser-e2e"),
    {
      id: "verify-desen-app-empty-project-browser-e2e",
      label: "Proof verifier: desen-app-empty-project-browser-e2e",
      command: "node",
      args: ["scripts/verify-desen-app-empty-project-browser-e2e.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-empty-project-browser-e2e"),
    {
      id: "test-desen-app-empty-project-browser-e2e",
      label: "Root proof and mutation test: desen-app-empty-project-browser-e2e",
      command: "node",
      args: [
        "--test",
        "--test-concurrency=1",
        "tests/desen-app-empty-project-browser-e2e.test.mjs",
      ],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-browser-e2e-workspace-compatibility"),
    {
      id: "verify-desen-app-browser-e2e-workspace-compatibility",
      label: "Proof verifier: desen-app-browser-e2e-workspace-compatibility",
      command: "node",
      args: ["scripts/verify-desen-app-browser-e2e-workspace-compatibility.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-browser-e2e-workspace-compatibility"),
    {
      id: "test-desen-app-browser-e2e-workspace-compatibility",
      label: "Root proof and mutation test: desen-app-browser-e2e-workspace-compatibility",
      command: "node",
      args: [
        "--test",
        "--test-concurrency=1",
        "tests/desen-app-browser-e2e-workspace-compatibility.test.mjs",
      ],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-user-created-blank-project"),
    {
      id: "verify-desen-app-user-created-blank-project",
      label: "Proof verifier: desen-app-user-created-blank-project",
      command: "node",
      args: ["scripts/verify-desen-app-user-created-blank-project.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-user-created-blank-project"),
    {
      id: "test-desen-app-user-created-blank-project",
      label: "Root proof and mutation test: desen-app-user-created-blank-project",
      command: "node",
      args: [
        "--test",
        "--test-concurrency=1",
        "tests/desen-app-user-created-blank-project.test.mjs",
      ],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-visual-behavior-authoring"),
    {
      id: "verify-desen-app-visual-behavior-authoring",
      label: "Proof verifier: desen-app-visual-behavior-authoring",
      command: "node",
      args: ["scripts/verify-desen-app-visual-behavior-authoring.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-visual-behavior-authoring"),
    {
      id: "test-desen-app-visual-behavior-authoring",
      label: "Root proof and mutation test: desen-app-visual-behavior-authoring",
      command: "node",
      args: [
        "--test",
        "--test-concurrency=1",
        "tests/desen-app-visual-behavior-authoring.test.mjs",
      ],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-evergreen-product-composition"),
    {
      id: "verify-desen-app-evergreen-product-composition",
      label: "Proof verifier: desen-app-evergreen-product-composition",
      command: "node",
      args: ["scripts/verify-desen-app-evergreen-product-composition.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-evergreen-product-composition"),
    {
      id: "test-desen-app-evergreen-product-composition",
      label: "Root proof and mutation test: desen-app-evergreen-product-composition",
      command: "node",
      args: [
        "--test",
        "--test-concurrency=1",
        "tests/desen-app-evergreen-product-composition.test.mjs",
      ],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-input-pending-fixture"),
    {
      id: "verify-desen-app-input-pending-fixture",
      label: "Proof verifier: desen-app-input-pending-fixture",
      command: "node",
      args: ["scripts/verify-desen-app-input-pending-fixture.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-input-pending-fixture"),
    {
      id: "test-desen-app-input-pending-fixture",
      label: "Root proof and mutation test: desen-app-input-pending-fixture",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-input-pending-fixture.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-failure-fixture"),
    {
      id: "verify-desen-app-failure-fixture",
      label: "Proof verifier: desen-app-failure-fixture",
      command: "node",
      args: ["scripts/verify-desen-app-failure-fixture.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-failure-fixture"),
    {
      id: "test-desen-app-failure-fixture",
      label: "Root proof and mutation test: desen-app-failure-fixture",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-failure-fixture.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-success-host-operation"),
    {
      id: "verify-desen-app-success-host-operation",
      label: "Proof verifier: desen-app-success-host-operation",
      command: "node",
      args: ["scripts/verify-desen-app-success-host-operation.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-success-host-operation"),
    {
      id: "test-desen-app-success-host-operation",
      label: "Root proof and mutation test: desen-app-success-host-operation",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-success-host-operation.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-published-host-update"),
    {
      id: "verify-desen-app-published-host-update",
      label: "Proof verifier: desen-app-published-host-update",
      command: "node",
      args: ["scripts/verify-desen-app-published-host-update.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-published-host-update"),
    {
      id: "test-desen-app-published-host-update",
      label: "Root proof and mutation test: desen-app-published-host-update",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-published-host-update.test.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-invalid-publication"),
    {
      id: "verify-desen-app-invalid-publication",
      label: "Proof verifier: desen-app-invalid-publication",
      command: "node",
      args: ["scripts/verify-desen-app-invalid-publication.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-invalid-publication"),
    {
      id: "test-desen-app-invalid-publication",
      label: "Root proof and mutation test: desen-app-invalid-publication",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-invalid-publication.test.mjs"],
    },
  );
  for (const step of steps) {
    assert.doesNotThrow(() => assertSafeStep(step));
  }
  assert.deepEqual(
    steps.find(({ id }) => id === "verify-desen-app-last-known-good-recovery"),
    {
      id: "verify-desen-app-last-known-good-recovery",
      label: "Proof verifier: desen-app-last-known-good-recovery",
      command: "node",
      args: ["scripts/verify-desen-app-last-known-good-recovery.mjs"],
    },
  );
  assert.deepEqual(
    steps.find(({ id }) => id === "test-desen-app-last-known-good-recovery"),
    {
      id: "test-desen-app-last-known-good-recovery",
      label: "Root proof and mutation test: desen-app-last-known-good-recovery",
      command: "node",
      args: ["--test", "--test-concurrency=1", "tests/desen-app-last-known-good-recovery.test.mjs"],
    },
  );

  for (const args of [
    ["generate:proof"],
    ["scripts/evidence-writer.mjs"],
    ["scripts/write-proof.mjs"],
    ["write:evidence"],
    ["--affected"],
    ["tests/*.test.mjs"],
    ["safe", "&&", "unsafe"],
  ]) {
    assert.throws(() => assertSafeStep({ id: "unsafe", command: "node", args }), QualityGateError);
  }
});

test("the exact single-pass plan rejects command removal and duplicate root coverage", () => {
  const steps = createQualityGateSteps();
  assert.deepEqual(validateQualityGatePlan(steps), {
    stepCount: 238,
    planSha256: "257667fcdec26d3654d1434c392bfaf7aec7e8f2a684311912c02255fd1d3176",
  });

  const missingTypecheck = clone(steps);
  const workspaceGraph = missingTypecheck.find(({ id }) => id === "workspace-graph");
  workspaceGraph.args = workspaceGraph.args.filter((argument) => argument !== "typecheck");
  assert.throws(() => validateQualityGatePlan(missingTypecheck), QualityGateError);

  const duplicatedRootTest = clone(steps);
  const rootTestSteps = duplicatedRootTest.filter(({ id }) => id.startsWith("test-"));
  rootTestSteps[1].args = [...rootTestSteps[0].args];
  assert.throws(() => validateQualityGatePlan(duplicatedRootTest), QualityGateError);
});

test("the default quality gate always executes its own validated plan", async () => {
  const executedStepIds = [];
  const receipt = await executeDefaultQualityGate({
    readInventoryFunction: currentInventory,
    snapshotFunction: async () => ({ digest: "same", trackedFileCount: 1 }),
    steps: [{ id: "caller-injected", label: "Caller injected" }],
    runStep: async ({ id }) => {
      executedStepIds.push(id);
    },
  });

  assert.equal(receipt.status, "PASS");
  assert.deepEqual(
    executedStepIds,
    createQualityGateSteps().map(({ id }) => id),
  );
  assert.equal(executedStepIds.includes("caller-injected"), false);
});

test("step execution is sequential, fail-fast, and preserves rejection", async () => {
  const calls = [];
  const steps = [
    { id: "first", label: "First" },
    { id: "failure", label: "Failure" },
    { id: "never", label: "Never" },
  ];
  const injectedFailure = new Error("injected failure");
  const timings = [];

  await assert.rejects(
    runStepSequence(
      steps,
      async ({ id }) => {
        calls.push(id);
        if (id === "failure") {
          throw injectedFailure;
        }
      },
      (timing) => timings.push(timing),
    ),
    (error) => error === injectedFailure,
  );
  assert.deepEqual(calls, ["first", "failure"]);
  assert.deepEqual(
    timings.map(({ id, status }) => ({ id, status })),
    [
      { id: "first", status: "PASS" },
      { id: "failure", status: "FAIL" },
    ],
  );
});

test("a cancellation between steps remains a failure and starts no later step", async () => {
  const calls = [];
  let receivedSignal;
  const timings = [];

  await assert.rejects(
    runStepSequence(
      [
        { id: "first", label: "First" },
        { id: "never", label: "Never" },
      ],
      async ({ id }) => {
        calls.push(id);
        receivedSignal = "SIGTERM";
      },
      (timing) => timings.push(timing),
      () => {
        if (receivedSignal) {
          throw new CancellationError(receivedSignal);
        }
      },
    ),
    CancellationError,
  );

  assert.deepEqual(calls, ["first"]);
  assert.deepEqual(
    timings.map(({ id, status }) => ({ id, status })),
    [{ id: "first", status: "FAIL" }],
  );
});

test("the quality gate rejects tracked-byte drift even after a primary failure", async () => {
  let snapshotCount = 0;
  const injectedFailure = new Error("primary failure");

  await assert.rejects(
    executeQualityGate({
      readInventoryFunction: currentInventory,
      snapshotFunction: async () => ({
        digest: snapshotCount++ === 0 ? "before" : "after",
        trackedFileCount: 1,
      }),
      steps: [{ id: "failure", label: "Failure" }],
      runStep: async () => {
        throw injectedFailure;
      },
    }),
    (error) => {
      assert.equal(error, injectedFailure);
      assert.equal(
        error.details.trackedWorkspaceError,
        "A quality-gate step changed tracked workspace bytes or modes.",
      );
      assert.equal(error.receipt.status, "FAIL");
      return true;
    },
  );
});

test("cancellation during the closing snapshot cannot return a passing receipt", async () => {
  let snapshotCount = 0;
  let receivedSignal;

  await assert.rejects(
    executeQualityGate({
      readInventoryFunction: currentInventory,
      snapshotFunction: async () => {
        snapshotCount += 1;
        if (snapshotCount === 2) {
          receivedSignal = "SIGTERM";
        }
        return { digest: "same", trackedFileCount: 1 };
      },
      steps: [],
      runStep: async () => {
        assert.fail("No command step should run.");
      },
      assertCanContinue: () => {
        if (receivedSignal) {
          throw new CancellationError(receivedSignal);
        }
      },
    }),
    (error) => {
      assert.ok(error instanceof CancellationError);
      assert.equal(error.receipt.status, "FAIL");
      assert.equal(error.receipt.timings[0].id, "frozen-inventory");
      return true;
    },
  );
});

test("tracked workspace parity compares both bytes and file count", () => {
  assert.doesNotThrow(() =>
    assertTrackedWorkspaceUnchanged(
      { digest: "same", trackedFileCount: 4 },
      { digest: "same", trackedFileCount: 4 },
    ),
  );
  assert.throws(
    () =>
      assertTrackedWorkspaceUnchanged(
        { digest: "same", trackedFileCount: 4 },
        { digest: "different", trackedFileCount: 4 },
      ),
    QualityGateError,
  );
  assert.throws(
    () =>
      assertTrackedWorkspaceUnchanged(
        { digest: "same", trackedFileCount: 4 },
        { digest: "same", trackedFileCount: 3 },
      ),
    QualityGateError,
  );
});

test("the tracked snapshot detects index-only object-id drift", async () => {
  const repositoryPath = await mkdtemp(join(tmpdir(), "desen-ci-index-"));
  try {
    await runProcess("git", ["init", "--quiet"], repositoryPath);
    const trackedPath = join(repositoryPath, "proof.txt");
    await writeFile(trackedPath, "tracked bytes\n", "utf8");
    await runProcess("git", ["add", "proof.txt"], repositoryPath);
    const before = await snapshotTrackedWorkspace(repositoryPath);

    await writeFile(trackedPath, "different staged bytes\n", "utf8");
    await runProcess("git", ["add", "proof.txt"], repositoryPath);
    await writeFile(trackedPath, "tracked bytes\n", "utf8");
    const after = await snapshotTrackedWorkspace(repositoryPath);

    assert.equal(before.trackedFileCount, 1);
    assert.equal(after.trackedFileCount, 1);
    assert.notEqual(before.digest, after.digest);
    assert.throws(() => assertTrackedWorkspaceUnchanged(before, after), QualityGateError);
  } finally {
    await rm(repositoryPath, { recursive: true, force: true });
  }
});

test("termination signals are forwarded to the active child", () => {
  const receivedSignals = [];
  const activeChild = {
    killed: false,
    kill(signal) {
      receivedSignals.push(signal);
      return true;
    },
  };

  assert.equal(forwardSignal("SIGTERM", activeChild), true);
  assert.deepEqual(receivedSignals, ["SIGTERM"]);
  assert.equal(forwardSignal("SIGINT", undefined), false);
  assert.equal(forwardSignal("SIGINT", { killed: true }), false);
});

test(
  "termination reaches a spawned child process group",
  { skip: process.platform === "win32" },
  async () => {
    const grandchildCode = "setInterval(() => {}, 1000)";
    const parentCode = [
      'const { spawn } = require("node:child_process");',
      `const child = spawn(process.execPath, ["-e", ${JSON.stringify(grandchildCode)}], { stdio: "ignore" });`,
      'process.stdout.write(String(child.pid) + "\\n");',
      "setInterval(() => {}, 1000);",
    ].join("");
    const parent = spawn(process.execPath, ["-e", parentCode], {
      detached: true,
      stdio: ["ignore", "pipe", "ignore"],
    });

    try {
      const [pidOutput] = await Promise.race([
        once(parent.stdout, "data"),
        delay(2_000).then(() => {
          throw new Error("Timed out waiting for the spawned grandchild.");
        }),
      ]);
      assert.ok(Number.parseInt(pidOutput.toString("utf8"), 10) > 0);

      const closed = once(parent, "close");
      assert.equal(forwardSignal("SIGTERM", parent), true);
      await closed;

      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          process.kill(-parent.pid, 0);
        } catch (error) {
          if (error?.code === "ESRCH") {
            return;
          }
          throw error;
        }
        await delay(20);
      }
      assert.fail("The child process group survived SIGTERM.");
    } finally {
      try {
        process.kill(-parent.pid, "SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") {
          process.stderr.write(`Process-group cleanup warning: ${String(error)}\n`);
        }
      }
    }
  },
);

// SEC-02 exercises the dependencies loaded by real development-tool consumers.
// Every potentially nonterminating probe is isolated; the deadline is a safety
// ceiling, not a performance assertion, and the inputs remain deliberately tiny.
function runToolchainSecurityProbe(consumerChain, probe, parameters = {}) {
  let consumerRequire = createRequire(import.meta.url);
  let entry;
  for (const packageName of consumerChain) {
    entry = consumerRequire.resolve(packageName);
    consumerRequire = createRequire(entry);
  }
  assert.ok(entry);
  const result = spawnSync(
    process.execPath,
    [
      "--max-old-space-size=128",
      "--input-type=module",
      "--eval",
      [
        'import assert from "node:assert/strict";',
        'import { createRequire } from "node:module";',
        `const entry = ${JSON.stringify(entry)};`,
        "const consumerRequire = createRequire(entry);",
        "const dependency = consumerRequire(entry);",
        `await (${probe.toString()})({ assert, dependency, consumerRequire, entry, parameters: ${JSON.stringify(parameters)} });`,
      ].join("\n"),
    ],
    {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8",
      timeout: 5_000,
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024,
    },
  );
  const detail = `${consumerChain.join(" → ")}: ${result.error?.message ?? result.stderr}`;
  assert.equal(result.error, undefined, detail);
  assert.equal(result.signal, null, detail);
  assert.equal(result.status, 0, detail);
}

const SEC_02_BRACE_CONSUMERS = ["eslint", "minimatch", "brace-expansion"];
const SEC_02_YAML_CONSUMERS = [
  ["@changesets/cli", "@manypkg/get-packages", "read-yaml-file", "js-yaml"],
  ["json-schema-to-typescript", "js-yaml"],
];
const SEC_02_NANOID_CONSUMERS = ["vitest", "vite", "postcss", "nanoid"];

test("SEC-02 brace expansion preserves ordinary, padded, and empty-option results", () => {
  runToolchainSecurityProbe(SEC_02_BRACE_CONSUMERS, ({ assert, dependency: { expand } }) => {
    assert.deepEqual(expand("file-{a,b}-{1..2}"), ["file-a-1", "file-a-2", "file-b-1", "file-b-2"]);
    assert.deepEqual(expand("{01..03}"), ["01", "02", "03"]);
    assert.deepEqual(expand("{a,,b}", { max: 2 }), ["a", "b"]);
    assert.deepEqual(expand("x{a,,b}y", { max: 2 }), ["xay", "xy"]);
  });
});

test("SEC-02 brace expansion bounds total output length (GHSA-mh99-v99m-4gvg)", () => {
  runToolchainSecurityProbe(SEC_02_BRACE_CONSUMERS, ({ assert, dependency: { expand } }) => {
    for (const pattern of ["{a,b}".repeat(8), "${literal}" + "{a,b}".repeat(8)]) {
      const output = expand(pattern, { max: 100, maxLength: 64 });
      assert.ok(output.length > 0);
      assert.ok(output.reduce((total, item) => total + item.length, 0) <= 64);
    }
  });
});

for (const [label, alternatives, paddingBudget] of [
  ["padded sequence", 1, 4],
  ["comma alternatives", 20, 8],
]) {
  test(`SEC-02 brace expansion bounds ${label} work (GHSA-rgw5-rvv9-x895)`, () => {
    runToolchainSecurityProbe(
      SEC_02_BRACE_CONSUMERS,
      ({ assert, dependency: { expand }, parameters: { alternatives, paddingBudget } }) => {
        const part = "{0001..0100}";
        const pattern =
          alternatives === 1 ? part : "{" + Array(alternatives).fill(part).join(",") + "}";
        const originalJoin = Array.prototype.join;
        let paddingCalls = 0;
        let output;
        try {
          // Count bounded primitive work, so the incomplete fix cannot hide behind
          // identical truncated output or machine-dependent elapsed time.
          Array.prototype.join = function (separator) {
            if (separator === "0") paddingCalls += 1;
            return Reflect.apply(originalJoin, this, [separator]);
          };
          output = expand(pattern, { maxLength: 12 });
        } finally {
          Array.prototype.join = originalJoin;
        }
        assert.deepEqual(output, ["0001", "0002", "0003"]);
        assert.ok(paddingCalls <= paddingBudget, `unbounded padding work: ${paddingCalls}`);
      },
      { alternatives, paddingBudget },
    );
  });
}

for (const consumerChain of SEC_02_YAML_CONSUMERS) {
  const label = consumerChain[0];
  test(`SEC-02 ${label} YAML preserves maps, merges, and duplicate rejection`, () => {
    runToolchainSecurityProbe(consumerChain, ({ assert, dependency: yaml }) => {
      const load = yaml.DEFAULT_SAFE_SCHEMA ? yaml.safeLoad : yaml.load;
      assert.deepEqual(
        load("defaults: &base { enabled: true }\nitem: { <<: *base, name: example }"),
        {
          defaults: { enabled: true },
          item: { enabled: true, name: "example" },
        },
      );
      assert.deepEqual(load("!!omap\n- first: 1\n- constructor: 2"), [
        { first: 1 },
        { constructor: 2 },
      ]);
      assert.throws(() => load("!!omap\n- duplicate: 1\n- duplicate: 2"), /cannot resolve/);
    });
  });

  test(`SEC-02 ${label} YAML bounds ordered-map key scans (GHSA-5p4m-2wfm-xmqj)`, () => {
    runToolchainSecurityProbe(consumerChain, ({ assert, dependency: yaml }) => {
      const load = yaml.DEFAULT_SAFE_SCHEMA ? yaml.safeLoad : yaml.load;
      const entries = 128;
      const document =
        "!!omap\n" +
        Array.from({ length: entries }, (_, index) => `- sec02-key-${index}: ${index}`).join("\n");
      const originalIndexOf = Array.prototype.indexOf;
      let scannedKeys = 0;
      let output;
      try {
        Array.prototype.indexOf = function (needle, fromIndex) {
          if (typeof needle === "string" && needle.startsWith("sec02-key-")) {
            scannedKeys += this.length;
          }
          return Reflect.apply(originalIndexOf, this, [needle, fromIndex]);
        };
        output = load(document);
      } finally {
        Array.prototype.indexOf = originalIndexOf;
      }
      assert.equal(output.length, entries);
      assert.deepEqual(output.at(-1), { "sec02-key-127": 127 });
      assert.ok(scannedKeys <= entries * 2, `quadratic ordered-map scan: ${scannedKeys}`);
    });
  });

  test(`SEC-02 ${label} YAML charges empty merges and caps merge sequences`, () => {
    runToolchainSecurityProbe(consumerChain, ({ assert, dependency: yaml }) => {
      const load = yaml.DEFAULT_SAFE_SCHEMA ? yaml.safeLoad : yaml.load;
      assert.deepEqual(load("target: { <<: [{}, {}] }", { maxTotalMergeKeys: 2 }), { target: {} });
      assert.throws(
        () => load("target: { <<: [{}, {}, {}] }", { maxTotalMergeKeys: 2 }),
        /merge keys exceeded maxTotalMergeKeys/,
      );
      const sequence = (count) => "target: { <<: [" + Array(count).fill("{}").join(",") + "] }";
      assert.deepEqual(load(sequence(100)), { target: {} });
      assert.throws(() => load(sequence(101)), /abnormal merge sequence size/);
    });
  });
}

test("SEC-02 Nano ID preserves ordinary secure and custom generators", () => {
  runToolchainSecurityProbe(
    SEC_02_NANOID_CONSUMERS,
    async ({ assert, dependency, consumerRequire }) => {
      const asyncEntry = consumerRequire.resolve("nanoid/async");
      const asynchronous = consumerRequire(asyncEntry);
      assert.match(dependency.nanoid(16), /^[\w-]{16}$/);
      assert.match(dependency.customAlphabet("abc", 8)(), /^[abc]{8}$/);
      assert.equal(dependency.customRandom("abc", 8, (size) => new Uint8Array(size))(), "aaaaaaaa");
      assert.match(await asynchronous.customAlphabet("abc", 8)(), /^[abc]{8}$/);
    },
  );
});

test("SEC-02 Nano ID zero-size generators terminate (GHSA-2v37-7h3g-55p8)", () => {
  runToolchainSecurityProbe(
    SEC_02_NANOID_CONSUMERS,
    async ({ assert, dependency, consumerRequire }) => {
      const asyncEntry = consumerRequire.resolve("nanoid/async");
      const asynchronous = consumerRequire(asyncEntry);
      const noRandomness = () => assert.fail("zero-sized IDs must not request randomness");
      assert.equal(dependency.customRandom("abc", 0, noRandomness)(), "");
      assert.equal(dependency.customRandom("abc", 8, noRandomness)(0), "");
      assert.equal(dependency.customAlphabet("abc", 0)(), "");
      assert.equal(dependency.customAlphabet("abc", 8)(0), "");
      assert.equal(await asynchronous.customAlphabet("abc", 0)(), "");
      assert.equal(await asynchronous.customAlphabet("abc", 8)(0), "");
    },
  );
});

test("SEC-02 PostCSS accepts an explicit local source map but rejects implicit and escaped files", () => {
  runToolchainSecurityProbe(
    ["vitest", "vite", "postcss"],
    async ({ assert, dependency: postcss }) => {
      const { mkdir, mkdtemp, rm, symlink, writeFile } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const directory = await mkdtemp(join(tmpdir(), "desen-sec02-map-"));
      try {
        const cssDirectory = join(directory, "css");
        await mkdir(cssDirectory);
        const from = join(cssDirectory, "style.css");
        const localMap = join(cssDirectory, "style.css.map");
        const outsideMap = join(directory, "private.map");
        const map = JSON.stringify({
          version: 3,
          sources: ["source.css"],
          names: [],
          mappings: "AAAA",
        });
        await writeFile(localMap, map, "utf8");
        await writeFile(outsideMap, map, "utf8");
        const css = (reference) => `a { color: red }\n/*# sourceMappingURL=${reference} */`;

        const accepted = postcss.parse(css("style.css.map"), { from });
        assert.equal(accepted.source.input.map.text, map);
        assert.deepEqual(accepted.source.input.map.consumer().sources, ["source.css"]);
        assert.equal(postcss.parse(css(outsideMap)).source.input.map, undefined);
        assert.equal(postcss.parse(css("../private.map"), { from }).source.input.map, undefined);

        // A textual in-directory name is insufficient when its real path escapes.
        await symlink(outsideMap, join(cssDirectory, "escaped.map"));
        assert.equal(postcss.parse(css("escaped.map"), { from }).source.input.map, undefined);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});

test("SEC-02 Undici bounds decompression and recovers (GHSA-3xpg-4rpp-hhhm)", () => {
  runToolchainSecurityProbe(["vitest", "jsdom", "undici"], async ({ assert, dependency }) => {
    const { gzipSync } = await import("node:zlib");
    const { MockAgent, interceptors } = dependency;
    const agent = new MockAgent();
    agent.disableNetConnect();
    const origin = "http://sec02.invalid";
    const pool = agent.get(origin);
    const client = agent.compose(interceptors.decompress({ maxSize: 1024 }));
    const reply = (path, body) =>
      pool.intercept({ path, method: "GET" }).reply(200, gzipSync(body), {
        headers: { "content-encoding": "gzip" },
      });
    try {
      reply("/boundary", "a".repeat(1024));
      const boundary = await client.request({ origin, path: "/boundary", method: "GET" });
      assert.equal(await boundary.body.text(), "a".repeat(1024));

      reply("/oversize", "b".repeat(2048));
      const oversize = await client.request({ origin, path: "/oversize", method: "GET" });
      await assert.rejects(oversize.body.text(), {
        name: "ResponseExceededMaxSizeError",
        code: "UND_ERR_RES_EXCEEDED_MAX_SIZE",
      });

      reply("/recovery", "still usable");
      const recovery = await client.request({ origin, path: "/recovery", method: "GET" });
      assert.equal(await recovery.body.text(), "still usable");
      agent.assertNoPendingInterceptors();
    } finally {
      await agent.close();
    }
  });
});

test("SEC-02 Undici rejects cookie-attribute injection atomically (GHSA-v3r7-h72x-cjcm)", () => {
  runToolchainSecurityProbe(["vitest", "jsdom", "undici"], ({ assert, dependency }) => {
    const { Headers, setCookie } = dependency;
    const headers = new Headers({ "x-existing": "kept" });
    for (const cookie of [
      { name: "session", value: "ok", domain: "example.com; Secure" },
      { name: "session", value: "ok", unparsed: ["X=ok; HttpOnly"] },
    ]) {
      assert.throws(() => setCookie(headers, cookie), /Invalid cookie (?:domain|value)/);
      assert.equal(headers.get("set-cookie"), null);
      assert.equal(headers.get("x-existing"), "kept");
    }
    setCookie(headers, {
      name: "session",
      value: "ok",
      domain: "example.com",
      path: "/",
      unparsed: ["Priority=High"],
    });
    assert.equal(
      headers.get("set-cookie"),
      "session=ok; Domain=example.com; Path=/; Priority=High",
    );
    assert.equal(headers.get("x-existing"), "kept");
  });
});
