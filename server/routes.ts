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

    // Create submission and initial run
    const [submission] = await db.insert(submissions)
      .values(result.data)
      .returning();

    const [run] = await db.insert(runs).values({
      submissionId: submission.id,
      status: "running",
      latestLog: "Initializing test run..."
    }).returning();

    // Start the test run simulation
    setTimeout(() => {
      updateRunStatus(run.id).catch(console.error);
    }, 2000);

    res.status(201).json(submission);
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

    // Get all runs for this submission
    const testRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.submissionId, submission.id))
      .orderBy(runs.startedAt);

    res.json({ ...submission, runs: testRuns });
  });

  // New endpoint for creating a new run
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

    // Simulate test progress
    setTimeout(() => {
      updateRunStatus(newRun.id).catch(console.error);
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
      updateRunStatus(newRun.id).catch(console.error);
    }, 2000);

    res.status(201).json(newRun);
  });

  const httpServer = createServer(app);
  return httpServer;
}