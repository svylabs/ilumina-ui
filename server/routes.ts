import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { submissions, runs, projects, insertSubmissionSchema, contacts, insertContactSchema, pricingPlans, planFeatures } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { setupAuth } from "./auth";
import { analysisSteps } from "@db/schema";

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

  // Modify the project creation endpoint
  app.post("/api/projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const maxProjects = req.user.plan === 'teams' ? Infinity :
                       req.user.plan === 'pro' ? 3 : 1;

    // Get current project count
    const projectCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.userId, req.user.id))
      .then(result => result[0].count);

    if (projectCount >= maxProjects) {
      return res.status(403).json({
        message: `You've reached the maximum number of projects for your ${req.user.plan} plan`
      });
    }

    // Check for existing project with same GitHub URL
    const existingProject = await db
      .select()
      .from(projects)
      .where(eq(projects.githubUrl, req.body.githubUrl))
      .where(eq(projects.userId, req.user.id))
      .limit(1);

    if (existingProject.length > 0) {
      return res.status(400).json({
        message: "A project with this GitHub URL already exists in your account"
      });
    }

    // Start a transaction to create both project and submission
    const [project, submission] = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          name: req.body.name,
          githubUrl: req.body.githubUrl,
          userId: req.user.id,
        })
        .returning();

      const [submission] = await tx
        .insert(submissions)
        .values({
          githubUrl: req.body.githubUrl,
          email: req.user.email,
          projectId: project.id,
        })
        .returning();

      await tx
        .insert(analysisSteps)
        .values({
          submissionId: submission.id,
          stepId: "files",
          status: "in_progress",
          details: "Starting file analysis...",
        })
        .returning();

      await tx
        .insert(runs)
        .values({
          submissionId: submission.id,
          status: "running",
          latestLog: "Initializing analysis...",
        })
        .returning();

      return [project, submission];
    });

    // Call the external analysis API
    try {
      const analysisResponse = await fetch('https://ilumina-451416.uc.r.appspot.com/begin_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer my_secure_password'
        },
        body: JSON.stringify({
          github_repository_url: submission.githubUrl,
          submission_id: submission.id
        })
      });

      if (!analysisResponse.ok) {
        console.error('Analysis API Error:', await analysisResponse.text());
      }
    } catch (error) {
      console.error('Failed to call analysis API:', error);
    }

    res.status(201).json({ ...project, submissionId: submission.id });
  });

  // Add this route after the other project routes
  app.delete("/api/projects/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const projectId = parseInt(req.params.id);

    // Verify project belongs to user
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .where(eq(projects.userId, req.user.id))
      .limit(1);

    if (!project) {
      return res.status(404).json({
        message: "Project not found or you don't have permission to delete it"
      });
    }

    await db.delete(projects).where(eq(projects.id, projectId));
    res.sendStatus(204);
  });

  // Modify the submission endpoint to handle authentication
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

    // Add this after creating the submission
    const [initialStep] = await db
      .insert(analysisSteps)
      .values({
        submissionId: submission.id,
        stepId: "files",
        status: "in_progress",
        details: "Starting file analysis...",
      })
      .returning();

    const [run] = await db
      .insert(runs)
      .values({
        submissionId: submission.id,
        status: "running",
        latestLog: "Initializing analysis...",
      })
      .returning();

    // Call the external analysis API
    try {
      const analysisResponse = await fetch('https://ilumina-451416.uc.r.appspot.com/begin_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer my_secure_password'
        },
        body: JSON.stringify({
          github_repository_url: submission.githubUrl,
          submission_id: submission.id
        })
      });

      if (!analysisResponse.ok) {
        console.error('Analysis API Error:', await analysisResponse.text());
        // We still return 201 since the submission was created, but log the error
      }
    } catch (error) {
      console.error('Failed to call analysis API:', error);
      // We still return 201 since the submission was created, but log the error
    }

    res.status(201).json(submission);
  });

  // Update the analysis endpoint
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;

      // First try to get submission by project ID
      let submission = await db
        .select()
        .from(submissions)
        .where(eq(submissions.projectId, parseInt(submissionId)))
        .orderBy(submissions.createdAt, "desc")
        .limit(1);

      // If not found, try UUID format
      if (!submission.length && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) {
        submission = await db
          .select()
          .from(submissions)
          .where(eq(submissions.id, submissionId))
          .limit(1);
      }

      if (!submission.length) {
        return res.status(404).send("Submission not found");
      }

      // Get all steps for this submission from database
      const steps = await db
        .select()
        .from(analysisSteps)
        .where(eq(analysisSteps.submissionId, submission[0].id))
        .orderBy(analysisSteps.createdAt);

      const stepsStatus = {
        files: { status: "pending", details: null, startTime: null },
        abi: { status: "pending", details: null, startTime: null },
        workspace: { status: "pending", details: null, startTime: null },
        test_setup: { status: "pending", details: null, startTime: null },
        actors: { status: "pending", details: null, startTime: null },
        simulations: { status: "pending", details: null, startTime: null }
      };

      steps.forEach(step => {
        if (stepsStatus[step.stepId]) {
          stepsStatus[step.stepId] = {
            status: step.status,
            details: step.details,
            startTime: step.status === 'in_progress' ? step.createdAt.toISOString() : null
          };
        }
      });

      const hasInProgressStep = steps.some(step => step.status === "in_progress");
      const status = hasInProgressStep ? "in_progress" : "completed";

      res.json({ status, steps: stepsStatus });
    } catch (error) {
      console.error('Error in analysis endpoint:', error);
      res.status(500).send("Internal server error");
    }
  });

  app.get("/api/submissions/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId)) {
        return res.status(400).send("Invalid submission ID format");
      }

      const [submission] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, submissionId))
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
    } catch (error) {
      console.error('Error in submissions endpoint:', error);
      res.status(500).send("Internal server error");
    }
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

  app.post("/api/contact", async (req, res) => {
    const result = insertContactSchema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).send(error.toString());
    }

    try {
      const [contact] = await db
        .insert(contacts)
        .values(result.data)
        .returning();

      res.status(201).json(contact);
    } catch (err) {
      console.error('Error saving contact:', err);
      res.status(500).json({ message: "Failed to save contact information" });
    }
  });

  // Get pricing information
  app.get("/api/pricing", async (_req, res) => {
    try {
      const plans = await db
        .select()
        .from(pricingPlans)
        .orderBy(pricingPlans.price);

      const features = await db
        .select()
        .from(planFeatures);

      // Combine plans with their features
      const pricingData = plans.map(plan => ({
        ...plan,
        features: features
          .filter(feature => feature.planId === plan.id)
          .map(feature => feature.feature)
      }));

      res.json(pricingData);
    } catch (err) {
      console.error('Error fetching pricing:', err);
      res.status(500).json({ message: "Failed to fetch pricing information" });
    }
  });

  const httpServer = createServer(app);
  const PORT = process.env.PORT || 3000;
  app.set('port', PORT);

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