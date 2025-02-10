import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { submissions, runs, projects, insertSubmissionSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { setupAuth } from "./auth";

export function registerRoutes(app: Express): Server {
  // Set up authentication
  setupAuth(app);

  // Get user's projects
  app.get("/api/projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, req.user.id))
      .orderBy(projects.createdAt);

    res.json(userProjects);
  });

  // Create new project
  app.post("/api/projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const [project] = await db
      .insert(projects)
      .values({
        name: req.body.name,
        githubUrl: req.body.githubUrl,
        userId: req.user.id,
      })
      .returning();

    res.status(201).json(project);
  });

  // Modified submission endpoint to handle authentication
  app.post("/api/submissions", async (req, res) => {
    const result = insertSubmissionSchema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).send(error.toString());
    }

    // Start a transaction to create both submission and project
    const [submission] = await db.transaction(async (tx) => {
      let projectId: number | undefined;

      // If user is authenticated, create a project
      if (req.isAuthenticated()) {
        const repoName = result.data.githubUrl.split("/").pop()?.replace(".git", "") || "New Project";
        const [project] = await tx
          .insert(projects)
          .values({
            name: repoName,
            githubUrl: result.data.githubUrl,
            userId: req.user.id,
          })
          .returning();
        projectId = project.id;
      }

      const [submission] = await tx
        .insert(submissions)
        .values({
          ...result.data,
          projectId,
        })
        .returning();

      return [submission];
    });

    const [run] = await db
      .insert(runs)
      .values({
        submissionId: submission.id,
        status: "running",
        latestLog: "Initializing analysis...",
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
      },
      simulations: {
        status: elapsed > 12000 ? "completed" : elapsed > 10000 ? "in_progress" : "pending",
        details: elapsed > 12000 ? "All simulations completed successfully" : null
      }
    };

    const status = elapsed > 12000 ? "completed" : "in_progress";

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

  app.get("/api/download/:id", async (req, res) => {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, parseInt(req.params.id)))
      .limit(1);

    if (!submission) {
      return res.status(404).send("Submission not found");
    }

    // For now, we'll return a simple JSON file with submission details
    // In a real implementation, this would zip and return the actual code
    const data = {
      repository: submission.githubUrl,
      timestamp: submission.createdAt,
      status: submission.status
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=project-${submission.id}.json`);
    res.json(data);
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function updateRunStatus(runId: number) {
  const status = Math.random() > 0.5 ? "success" : "failed";
  const [updatedRun] = await db
    .update(runs)
    .set({
      status,
      completedAt: new Date(),
      latestLog: `Test run completed with ${status} status. Sample results...`,
    })
    .where(eq(runs.id, runId))
    .returning();

  console.log(`Updated run ${runId} to status: ${status}`);
  return updatedRun;
}