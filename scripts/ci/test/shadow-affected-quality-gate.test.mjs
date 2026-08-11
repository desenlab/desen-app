import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  captureAffectedChangeBoundary,
  createAffectedChangeBoundaryTestSeams,
} from "../affected-change-boundary.mjs";
import {
  createShadowAffectedSelection,
  validateShadowAffectedSelection,
} from "../affected-workload-selector.mjs";
import {
  createRequiredExhaustivePlan,
  createRequiredExhaustiveTerminalState,
  createSuccessfulExhaustiveStepObservation,
} from "../run-required-exhaustive-quality-gate.mjs";
import {
  SHADOW_AFFECTED_RECEIPT_PROFILE,
  SHADOW_AFFECTED_SUFFIX_DEPENDENCY_POLICY,
  finalizeShadowAffectedFailureReceipt,
  printShadowAffectedReceipt,
  runShadowAffectedClosingGuards,
  runShadowAffectedQualityGate,
} from "../run-shadow-affected-quality-gate.mjs";

const REVISION = "a".repeat(40);
const BASE = "b".repeat(40);
const HEAD = "c".repeat(40);
const MERGE_BASE = "d".repeat(40);
const OID_BEFORE = "e".repeat(40);
const OID_AFTER = "f".repeat(40);
const TRACKED_OBJECT = "1".repeat(40);
const WORKSPACE_ROOT = path.resolve(import.meta.dirname, "../../..");

function paths() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" })
    .subarray(0, -1)
    .toString("utf8")
    .split("\0")
    .sort();
}

function result(stdout = "", status = 0, stderr = "") {
  return {
    status,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr),
  };
}

function trackedTree(trackedPaths) {
  return Buffer.concat(
    trackedPaths.map((relativePath) =>
      Buffer.from(`100644 blob ${TRACKED_OBJECT}\t${relativePath}\0`),
    ),
  );
}

function rawChanges(changedPaths) {
  return Buffer.concat(
    changedPaths.map((relativePath) =>
      Buffer.from(`:100644 100644 ${OID_BEFORE} ${OID_AFTER} M\0${relativePath}\0`),
    ),
  );
}

async function boundary(changedInput) {
  const trackedPaths = paths();
  const changedPaths = Array.isArray(changedInput) ? changedInput : [changedInput];
  const runGit = async (_workspaceRoot, args) => {
    if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
      return result("false\n");
    }
    if (args[0] === "cat-file") return result("commit\n");
    if (args[0] === "rev-parse" && args[1] === "--verify") {
      return result(`${REVISION}\n`);
    }
    if (args[0] === "rev-list") return result(`${REVISION} ${BASE} ${HEAD}\n`);
    if (args[0] === "merge-base" && args[1] === "--is-ancestor") return result();
    if (args[0] === "merge-base" && args[1] === "--all") {
      return result(`${MERGE_BASE}\n`);
    }
    if (args[0] === "status") return result();
    if (args[0] === "ls-tree") return result(trackedTree(trackedPaths));
    if (args[0] === "diff-tree") return result(rawChanges(changedPaths));
    throw new Error(`Unexpected Git command: ${args.join(" ")}`);
  };
  return await captureAffectedChangeBoundary({
    workspaceRoot: WORKSPACE_ROOT,
    baseRevision: BASE,
    headRevision: HEAD,
    executionRevision: REVISION,
    sameRepository: true,
    testSeams: createAffectedChangeBoundaryTestSeams(runGit),
  });
}

function runner() {
  createRequiredExhaustivePlan({ authority: "SHADOW" });
  return async (workload) => createSuccessfulExhaustiveStepObservation(workload);
}

test("runs every selected command fresh and closes one exact strict subset", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const events = [];
  const receipt = await runShadowAffectedQualityGate(selection, {
    runStep: async (workload) => {
      events.push(workload.id);
      return await runner()(workload);
    },
    afterPrefix: async () => events.push("[build-output-seal-open]"),
    afterProofs: async () => events.push("[build-output-seal-close]"),
  });
  assert.equal(receipt.profile, SHADOW_AFFECTED_RECEIPT_PROFILE);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.authority, "SHADOW");
  assert.equal(receipt.freshExecution, true);
  assert.equal(receipt.cachedSuccessRead, false);
  assert.equal(receipt.selectedWorkloadCount, 10);
  assert.equal(receipt.observedClosedCount, 10);
  assert.deepEqual(events.slice(0, 6), selection.nodeIds.slice(0, 6));
  assert.equal(events[6], "[build-output-seal-open]");
  assert.equal(events.at(-3), "[build-output-seal-close]");
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    selection.nodeIds,
  );
});

test("runs canonical multi-proof selections without inventing dependency completion", async () => {
  const selection = createShadowAffectedSelection(
    await boundary([
      "tests/protocol-types.test.mjs",
      "scripts/verify-protocol-canonicalization.mjs",
    ]),
  );
  const receipt = await runShadowAffectedQualityGate(selection, { runStep: runner() });

  assert.equal(selection.proofUnitCount, 2);
  assert.equal(selection.workloadCount, 12);
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.observedClosedCount, 12);
  assert.deepEqual(
    receipt.steps.map(({ id }) => id),
    selection.nodeIds,
  );
  assert.equal(SHADOW_AFFECTED_SUFFIX_DEPENDENCY_POLICY, "SELECTED_ROOT_BARRIER");
  assert.deepEqual(selection.nodeIds.slice(-2), ["dependency-boundaries", "boundary-fixtures"]);
});

test("exhaustive fallback executes no duplicate shadow workload", async () => {
  const selection = createShadowAffectedSelection(await boundary("package.json"));
  let calls = 0;
  const receipt = await runShadowAffectedQualityGate(selection, {
    runStep: async () => {
      calls += 1;
    },
  });
  assert.equal(selection.effectiveScope, "EXHAUSTIVE");
  assert.equal(receipt.status, "NOT_ELIGIBLE");
  assert.equal(receipt.freshExecution, false);
  assert.equal(calls, 0);
});

test("a selected failure stops later work and remains non-authoritative", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const authenticRunner = runner();
  let calls = 0;
  const receipt = await runShadowAffectedQualityGate(selection, {
    runStep: async (workload) => {
      calls += 1;
      if (workload.id === "verify-protocol-canonicalization") throw new Error("fixture failure");
      return await authenticRunner(workload);
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.authority, "SHADOW");
  assert.equal(receipt.error.message, "fixture failure");
  assert.equal(calls, 7);
  assert.equal(receipt.observedClosedCount, 6);
});

test("the first proof failure remains primary when the closing build guard also fails", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const authenticRunner = runner();
  const receipt = await runShadowAffectedQualityGate(selection, {
    runStep: async (workload) => {
      if (workload.id === "verify-protocol-canonicalization") {
        throw new Error("primary proof failure");
      }
      return await authenticRunner(workload);
    },
    afterProofs: async () => {
      throw new Error("secondary build guard failure");
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(receipt.error.message, "primary proof failure");
});

test("missing or malformed close observations fail instead of fabricating success", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  for (const observation of [undefined, { status: "PASS" }]) {
    const receipt = await runShadowAffectedQualityGate(selection, {
      runStep: async () => observation,
    });
    assert.equal(receipt.status, "FAIL");
    assert.equal(receipt.observedClosedCount, 0);
  }
});

test("cancellation before scheduling starts no shadow workload and cannot return PASS", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  terminal.cancel("SIGINT");
  const winner = terminal.winner();
  let calls = 0;
  const receipt = await runShadowAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async () => {
      calls += 1;
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(calls, 0);
  assert.equal(receipt.observedClosedCount, 0);
  assert.equal(terminal.winner(), winner);
  assert.equal(receipt.error.message, winner.reason.message);
});

test("cancellation between regions stops every later workload and preserves the first reason", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  const authenticRunner = runner();
  let calls = 0;
  let winner;
  const receipt = await runShadowAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async (workload) => {
      calls += 1;
      return await authenticRunner(workload);
    },
    afterPrefix: async () => {
      terminal.cancel("SIGTERM");
      winner = terminal.winner();
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(calls, 6);
  assert.equal(receipt.observedClosedCount, 6);
  assert.equal(terminal.winner(), winner);
  assert.equal(receipt.error.message, winner.reason.message);
});

test("cancellation at the final observed close cannot fabricate a PASS receipt", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const terminal = createRequiredExhaustiveTerminalState();
  const authenticRunner = runner();
  let calls = 0;
  let winner;
  const receipt = await runShadowAffectedQualityGate(selection, {
    terminalState: terminal,
    runStep: async (workload) => {
      calls += 1;
      const observation = await authenticRunner(workload);
      if (calls === selection.workloadCount) {
        terminal.cancel("SIGTERM");
        winner = terminal.winner();
      }
      return observation;
    },
  });
  assert.equal(receipt.status, "FAIL");
  assert.equal(calls, selection.workloadCount);
  assert.equal(receipt.observedClosedCount, selection.workloadCount);
  assert.equal(terminal.winner(), winner);
  assert.equal(receipt.error.message, winner.reason.message);
});

test("cancellation during final guards runs both guards and preserves every reason", async () => {
  const terminal = createRequiredExhaustiveTerminalState();
  const events = [];
  let winner;
  const closing = await runShadowAffectedClosingGuards(terminal, {
    runUntrackedGuard: async () => {
      events.push("untracked");
      terminal.cancel("SIGTERM");
      winner = terminal.winner();
    },
    runWorkspaceGuard: async () => {
      events.push("workspace");
      throw new Error("later workspace guard failure");
    },
  });
  assert.deepEqual(events, ["untracked", "workspace"]);
  assert.equal(terminal.winner(), winner);
  assert.equal(closing.failure, winner.reason);
  assert.equal(closing.untrackedGuardFailure, null);
  assert.equal(closing.workspaceGuardFailure.message, "later workspace guard failure");
});

test("outer guard diagnostics cannot replace an earlier execution failure", async () => {
  const selection = createShadowAffectedSelection(
    await boundary("scripts/verify-protocol-canonicalization.mjs"),
  );
  const authenticRunner = runner();
  const inner = await runShadowAffectedQualityGate(selection, {
    runStep: async (workload) => {
      if (workload.id === "verify-protocol-canonicalization") {
        throw new Error("primary execution failure");
      }
      return await authenticRunner(workload);
    },
  });
  const closingTerminal = createRequiredExhaustiveTerminalState();
  const closing = await runShadowAffectedClosingGuards(closingTerminal, {
    runUntrackedGuard: async () => {
      throw new Error("secondary untracked guard failure");
    },
    runWorkspaceGuard: async () => {
      throw new Error("tertiary workspace guard failure");
    },
  });
  const finalized = finalizeShadowAffectedFailureReceipt(
    inner,
    selection,
    new Error("generic wrapper must not replace primary"),
    closing,
  );

  assert.equal(finalized.status, "FAIL");
  assert.equal(finalized.error.message, "primary execution failure");
  assert.equal(finalized.closingGuards.untracked.message, "secondary untracked guard failure");
  assert.equal(finalized.closingGuards.workspace.message, "tertiary workspace guard failure");
});

test("the log envelope is bounded to one explicit shadow marker", async () => {
  const selection = createShadowAffectedSelection(await boundary("package.json"));
  validateShadowAffectedSelection(selection);
  let output = "";
  printShadowAffectedReceipt(
    { authority: "SHADOW", status: "NOT_ELIGIBLE" },
    { write: (text) => (output += text) },
  );
  assert.equal(output.split("DESEN_SHADOW_AFFECTED_RECEIPT=").length - 1, 1);
  assert.equal(output.includes('"authority":"SHADOW"'), true);
});

test("required exhaustive invariants remain exact after shadow execution is imported", () => {
  const required = createRequiredExhaustivePlan();
  assert.equal(required.authority, "REQUIRED");
  assert.equal(required.scope, "EXHAUSTIVE");
  assert.equal(required.stepCount, 148);
  assert.equal(required.proofPairCount, 70);
});
