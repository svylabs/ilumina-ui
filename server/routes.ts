import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { submissions, runs, insertSubmissionSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";

async function updateRunStatus(runId: number) {
  const status = Math.random() > 0.5 ? "success" : "failed";
  const [updatedRun] = await db
    .update(runs)
    .set({
      status,
      completedAt: new Date(),
      latestLog: `Test run completed with ${status} status. Sample results...`
    })
    .where(eq(runs.id, runId))
    .returning();

  console.log(`Updated run ${runId} to status: ${status}`);
  return updatedRun;
}

export function registerRoutes(app: Express): Server {
  app.post("/api/submissions", async (req, res) => {
    const result = insertSubmissionSchema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).send(error.toString());
    }

    const [submission] = await db.insert(submissions)
      .values(result.data)
      .returning();

    const [run] = await db.insert(runs)
      .values({
        submissionId: submission.id,
        status: "running",
        latestLog: "Initializing analysis..."
      })
      .returning();

    setTimeout(() => {
      updateRunStatus(run.id).catch(console.error);
    }, 2000);

    res.status(201).json(submission);
  });

  app.get("/api/analysis/:id", async (req, res) => {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, parseInt(req.params.id)))
      .limit(1);

    if (!submission) {
      return res.status(404).send("Submission not found");
    }

    // Simulate analysis progress based on time elapsed
    const startTime = new Date(submission.createdAt).getTime();
    const elapsed = Date.now() - startTime;

    const steps = {
      files: {
        status: elapsed > 2000 ? "completed" : "in_progress",
        details: elapsed > 2000 ? "Found 3 Solidity contract files" : null
      },
      abi: {
        status: elapsed > 4000 ? "completed" : elapsed > 2000 ? "in_progress" : "pending",
        details: elapsed > 4000 ? "Identified compilation requirements" : null
      },
      workspace: {
        status: elapsed > 6000 ? "completed" : elapsed > 4000 ? "in_progress" : "pending",
        details: elapsed > 6000 ? "Workspace setup complete" : null
      },
      test_setup: {
        status: elapsed > 8000 ? "completed" : elapsed > 6000 ? "in_progress" : "pending",
        details: elapsed > 8000 ? "Test environment configured with flocc-ext" : null
      },
      actors: {
        status: elapsed > 10000 ? "completed" : elapsed > 8000 ? "in_progress" : "pending",
        details: elapsed > 10000 ? "Identified 2 main actors and their actions" : null
      }
    };

    const status = elapsed > 10000 ? "completed" : "in_progress";

    res.json({ status, steps });
  });

  app.get("/api/submissions/:id", async (req, res) => {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, parseInt(req.params.id)))
      .limit(1);

    if (!submission) {
      return res.status(404).send("Submission not found");
    }

    const testRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.submissionId, submission.id))
      .orderBy(runs.startedAt);

    res.json({ ...submission, runs: testRuns });
  });

  app.post("/api/submissions/:id/runs", async (req, res) => {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, parseInt(req.params.id)))
      .limit(1);

    if (!submission) {
      return res.status(404).send("Submission not found");
    }

    const [newRun] = await db.insert(runs)
      .values({
        submissionId: submission.id,
        status: "running",
        latestLog: "Starting new test run..."
      })
      .returning();

    console.log(`Created new run ${newRun.id} for submission ${submission.id}`);

    setTimeout(() => {
      console.log(`Starting status update for run ${newRun.id}...`);
      updateRunStatus(newRun.id)
        .then(run => console.log(`Successfully updated run ${run.id} status to ${run.status}`))
        .catch(err => console.error(`Failed to update run ${newRun.id} status:`, err));
    }, 2000);

    res.status(201).json(newRun);
  });

  app.post("/api/runs/:id/rerun", async (req, res) => {
    const [existingRun] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, parseInt(req.params.id)))
      .limit(1);

    if (!existingRun) {
      return res.status(404).send("Run not found");
    }

    const [newRun] = await db.insert(runs)
      .values({
        submissionId: existingRun.submissionId,
        status: "running",
        latestLog: "Re-running tests..."
      })
      .returning();

    console.log(`Created re-run ${newRun.id} for run ${existingRun.id}`);

    setTimeout(() => {
      console.log(`Starting status update for re-run ${newRun.id}...`);
      updateRunStatus(newRun.id)
        .then(run => console.log(`Successfully updated re-run ${run.id} status to ${run.status}`))
        .catch(err => console.error(`Failed to update re-run ${newRun.id} status:`, err));
    }, 2000);

    res.status(201).json(newRun);
  });

  const httpServer = createServer(app);
  return httpServer;
}