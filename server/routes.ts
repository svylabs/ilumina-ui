import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { submissions, runs, insertSubmissionSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";

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

    await db.insert(runs).values({
      submissionId: submission.id,
      status: "running",
      latestLog: "Initializing test run..."
    });

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

  app.post("/api/runs/:id/rerun", async (req, res) => {
    const [existingRun] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, parseInt(req.params.id)))
      .limit(1);

    if (!existingRun) {
      return res.status(404).send("Run not found");
    }

    // Create a new run for the same submission
    const [newRun] = await db.insert(runs)
      .values({
        submissionId: existingRun.submissionId,
        status: "running",
        latestLog: "Re-running tests..."
      })
      .returning();

    // Simulate test progress (in a real app, this would be handled by a worker)
    setTimeout(async () => {
      await db
        .update(runs)
        .set({
          status: Math.random() > 0.5 ? "success" : "failed",
          completedAt: new Date(),
          latestLog: "Test run completed with some sample results..."
        })
        .where(eq(runs.id, newRun.id));
    }, 5000);

    res.status(201).json(newRun);
  });

  const httpServer = createServer(app);
  return httpServer;
}