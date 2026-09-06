import { appendFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createRequiredExhaustiveCancellationState,
  createRequiredExhaustiveJoinPlan,
  createRequiredExhaustiveProcessRegistry,
  createRequiredExhaustiveProofShardPlan,
  executeRequiredExhaustiveJoin,
  executeRequiredExhaustiveProofShard,
} from "./run-required-exhaustive-quality-gate.mjs";
import {
  captureHostedRequiredShardJoinAuthority,
  createRequiredProofShardSummary,
} from "./sharded-quality-gate-authority.mjs";

function workflowContext() {
  return Object.freeze({
    executionRevision: process.env.GITHUB_SHA,
    headRevision: process.env.DESEN_REQUIRED_HEAD_REVISION ?? "",
    workflowRunId: process.env.GITHUB_RUN_ID,
    workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  });
}

function assertClosedExecution(boundary, plan, context) {
  const execution = boundary?.execution;
  if (
    boundary?.status !== "PASS" ||
    boundary.revision !== context.executionRevision ||
    execution?.status !== "PASS" ||
    execution.authority !== "REQUIRED" ||
    execution.scope !== plan.scope ||
    execution.planSha256 !== plan.planSha256 ||
    execution.inventorySha256 !== plan.inventorySha256 ||
    execution.stepCount !== plan.stepCount ||
    execution.observedClosedCount !== plan.stepCount ||
    execution.proofPairCount !== plan.proofPairCount ||
    execution.steps.length !== plan.nodes.length ||
    execution.steps.some(
      (step, index) =>
        step.id !== plan.nodes[index].id ||
        step.status !== "PASS" ||
        step.observedClose !== true ||
        step.code !== 0 ||
        step.signal !== null,
    ) ||
    boundary.workspaceBefore?.digest === undefined ||
    boundary.workspaceBefore.digest !== boundary.workspaceAfter?.digest
  ) {
    throw new Error("The distributed gate did not close its exact real local execution boundary.");
  }
}

/**
 * Runs only the fixed REQUIRED shard or final-join CLI. GitHub summaries are emitted only after
 * this process has observed its own successful workload closes and all closing guards; a remote
 * summary is never converted into a local child-process observation.
 */
export async function runRequiredShardedQualityGate() {
  const processRegistry = createRequiredExhaustiveProcessRegistry();
  const cancellation = createRequiredExhaustiveCancellationState({ processRegistry });
  const uninstall = cancellation.install();
  let boundary;
  let failure;
  try {
    const args = process.argv.slice(2);
    const context = workflowContext();
    const executionOptions = {
      processRegistry,
      terminalState: cancellation.terminalState,
      expectedRevision: context.executionRevision,
    };
    if (args.length === 2 && args[0] === "shard") {
      const shardId = args[1];
      const plan = createRequiredExhaustiveProofShardPlan(shardId);
      // Validate and capture the context/output destination before beginning asynchronous work.
      // This shape alone grants no PASS authority and is not emitted before real execution.
      const summary = createRequiredProofShardSummary(shardId, context);
      const outputPath = process.env.GITHUB_OUTPUT;
      if (
        typeof outputPath !== "string" ||
        !path.isAbsolute(outputPath) ||
        outputPath.includes("\0")
      ) {
        throw new Error("The shard requires its GitHub output destination.");
      }
      boundary = await executeRequiredExhaustiveProofShard({ shardId, ...executionOptions });
      assertClosedExecution(boundary, plan, context);
      if (cancellation.terminalState.winner()) throw cancellation.terminalState.winner().reason;
      appendFileSync(outputPath, `receipt=${JSON.stringify(summary)}\n`, "utf8");
      process.stdout.write(
        `${JSON.stringify({ ...summary, durationMs: boundary.durationMs }, null, 2)}\n`,
      );
    } else if (args.length === 1 && args[0] === "join") {
      const githubAuthority = captureHostedRequiredShardJoinAuthority();
      const plan = createRequiredExhaustiveJoinPlan(githubAuthority);
      boundary = await executeRequiredExhaustiveJoin({ githubAuthority, ...executionOptions });
      assertClosedExecution(boundary, plan, context);
      if (cancellation.terminalState.winner()) throw cancellation.terminalState.winner().reason;
      process.stdout.write(
        `${JSON.stringify(
          {
            schemaVersion: 1,
            profile: "desen.ci.required-sharded-quality-gate-result.v1",
            status: "PASS",
            authority: "REQUIRED_DISTRIBUTED",
            scope: "EXHAUSTIVE",
            ...context,
            logicalWorkloadCount: githubAuthority.logicalWorkloadCount,
            proofPairCount: githubAuthority.proofPairCount,
            physicalWorkloadCount: githubAuthority.physicalWorkloadCount,
            githubPrerequisites: githubAuthority,
            localExecution: boundary.execution,
            workspaceBefore: boundary.workspaceBefore,
            workspaceAfter: boundary.workspaceAfter,
            durationMs: boundary.durationMs,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      throw new Error("Use exactly: shard proof-a|proof-b|proof-c, or join.");
    }
    if (cancellation.terminalState.winner()) throw cancellation.terminalState.winner().reason;
  } catch (error) {
    failure = error;
    const receipt = error?.exhaustiveGateReceipt ?? boundary;
    const localExecution = receipt?.execution ?? error?.requiredExhaustiveReceipt;
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "FAIL",
          profile: "desen.ci.required-sharded-quality-gate-result.v1",
          localExecution,
          error: { name: error?.name ?? "Error", message: error?.message ?? String(error) },
        },
        null,
        2,
      )}\n`,
    );
    process.stderr.write(`${error?.stack ?? String(error)}\n`);
  } finally {
    process.exitCode = cancellation.exitCode() ?? (failure ? 1 : 0);
    uninstall();
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === entrypoint) await runRequiredShardedQualityGate();
