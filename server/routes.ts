import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { 
  submissions, runs, projects, simulationRuns, users,
  insertSubmissionSchema, insertContactSchema, 
  pricingPlans, planFeatures 
} from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";
import { setupAuth } from "./auth";
import { analysisSteps } from "@db/schema";

// Define the type for analysis step status
type AnalysisStepStatus = {
  status: "pending" | "in_progress" | "completed" | "failed";
  details: string | null;
  startTime: string | null;
  jsonData?: any; // Add support for JSON data
};

export function registerRoutes(app: Express): Server {
  // Set up authentication
  setupAuth(app);

  // Check if user can run a simulation
  app.get("/api/can-run-simulation", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ 
      canRun: false,
      message: "You must be logged in to run simulations"
    });

    const user = req.user;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let limit: number;
    switch (user.plan) {
      case "free":
        limit = 1;
        break;
      case "pro":
        limit = 20;
        break;
      case "teams":
        // Unlimited
        return res.json({ 
          canRun: true,
          message: "You have unlimited simulation runs",
          plan: user.plan,
          runsUsed: user.simulationsUsed,
          runsLimit: "Unlimited"
        });
      default:
        limit = 1; // Default to free plan limit
    }

    // Check if the last simulation date is from a different day
    if (user.lastSimulationDate) {
      const lastSimDate = new Date(user.lastSimulationDate);
      lastSimDate.setHours(0, 0, 0, 0);

      // If it's a new day, reset the counter
      if (lastSimDate < today) {
        // Reset counter in database
        await db.update(users)
          .set({ 
            simulationsUsed: 0,
            lastSimulationDate: new Date()
          })
          .where(eq(users.id, user.id));

        return res.json({ 
          canRun: true, 
          message: "New day, simulations reset",
          plan: user.plan,
          runsUsed: 0,
          runsLimit: limit
        });
      }
    }

    // Check if user has reached their daily limit
    if (user.simulationsUsed >= limit) {
      return res.json({
        canRun: false,
        message: `You have reached your daily limit of ${limit} simulation runs. Upgrade to run more simulations.`,
        plan: user.plan,
        runsUsed: user.simulationsUsed,
        runsLimit: limit
      });
    }

    return res.json({
      canRun: true,
      message: `You have ${limit - user.simulationsUsed} simulation runs remaining today.`,
      plan: user.plan,
      runsUsed: user.simulationsUsed,
      runsLimit: limit
    });
  });

  // Log a simulation run
  app.post("/api/log-simulation", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Not authenticated" });

    try {
      const { submissionId: rawId, runId, status, logUrl, summary } = req.body;

      // Find the actual UUID for this submission based on project ID or UUID
      let actualSubmissionId: string | null = null;

      // First, check if this is a project ID
      if (/^\d+$/.test(rawId)) {
        // It's a number, probably a project ID
        const projectSubmission = await db
          .select()
          .from(submissions)
          .where(eq(submissions.projectId, parseInt(rawId)))
          .orderBy(submissions.createdAt, "desc")
          .limit(1);

        if (projectSubmission.length > 0) {
          actualSubmissionId = projectSubmission[0].id;
        }
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
        // It's a UUID format, use it directly
        actualSubmissionId = rawId;
      }

      if (!actualSubmissionId) {
        return res.status(404).json({
          success: false,
          message: "No submission found for the given ID"
        });
      }

      // Start transaction
      const result = await db.transaction(async (tx) => {
        // 1. Increment user counter
        await tx.update(users)
          .set({ 
            simulationsUsed: sql`${users.simulationsUsed} + 1`,
            lastSimulationDate: new Date()
          })
          .where(eq(users.id, req.user.id));

        // 2. Store the simulation run in the database
        const [simRun] = await tx.insert(simulationRuns)
          .values({
            userId: req.user.id,
            submissionId: actualSubmissionId,
            runId,
            status,
            logUrl,
            summary,
            date: new Date(),
          })
          .returning();

        // 3. Get updated user data
        const [updatedUser] = await tx.select()
          .from(users)
          .where(eq(users.id, req.user.id))
          .limit(1);

        return { simRun, user: updatedUser };
      });

      return res.json({ 
        success: true, 
        simulationRun: result.simRun,
        simulationsUsed: result.user.simulationsUsed 
      });
    } catch (error) {
      console.error("Error logging simulation:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to log simulation run" 
      });
    }
  });

  // Get simulation runs for a submission or project ID
  app.get("/api/simulation-runs/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ success: false, message: "Not authenticated" });

    try {
      const id = req.params.id;
      let submissionId: string | null = null;

      // First, check if this is a project ID
      if (/^\d+$/.test(id)) {
        // It's a number, probably a project ID
        const projectSubmission = await db
          .select()
          .from(submissions)
          .where(eq(submissions.projectId, parseInt(id)))
          .orderBy(submissions.createdAt, "desc")
          .limit(1);

        if (projectSubmission.length > 0) {
          submissionId = projectSubmission[0].id;
        }
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        // It's a UUID format, probably a submission ID
        submissionId = id;
      }

      if (!submissionId) {
        return res.status(404).json({
          success: false,
          message: "No submission found for the given ID"
        });
      }

      // Get simulation runs for this submission
      const runs = await db.select()
        .from(simulationRuns)
        .where(eq(simulationRuns.submissionId, submissionId))
        .orderBy(sql`${simulationRuns.date} DESC`);

      return res.json(runs);
    } catch (error) {
      console.error("Error fetching simulation runs:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch simulation runs" 
      });
    }
  });

  // GitHub API proxy endpoints
  app.get('/api/github/contents/:owner/:repo/:path(*)', async (req, res) => {
    try {
      const { owner, repo, path } = req.params;
      const branch = req.query.ref as string || 'main';

      // Build GitHub API URL
      const url = path 
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
        : `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`;

      // GitHub API requires a User-Agent header
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ilumina-App',
          'Accept': 'application/vnd.github.v3+json',
          // Add authorization if you have a GitHub token
          ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('GitHub API error:', error);
      res.status(500).json({ error: 'Failed to fetch from GitHub' });
    }
  });

  app.get('/api/github/content/:owner/:repo/:path(*)', async (req, res) => {
    try {
      const { owner, repo, path } = req.params;
      const branch = req.query.ref as string || 'main';

      // Build GitHub API URL for file content
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ilumina-App',
          'Accept': 'application/vnd.github.v3+json',
          ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {})
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('GitHub API error:', error);
      res.status(500).json({ error: 'Failed to fetch file from GitHub' });
    }
  });

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

    const maxProjects = req.user.plan === 'teams' ? 10 :
                       req.user.plan === 'pro' ? 5 : 1;

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

      // Insert "files" step as in progress
      await tx
        .insert(analysisSteps)
        .values({
          submissionId: submission.id,
          stepId: "files",
          status: "in_progress",
          details: "Analyzing project structure and smart contracts...",
        })
        .returning();

      // Insert other steps as pending
      await tx
        .insert(analysisSteps)
        .values([
          {
            submissionId: submission.id,
            stepId: "actors",
            status: "pending",
            details: "Waiting to analyze actors and interactions...",
          },
          {
            submissionId: submission.id,
            stepId: "deployment",
            status: "pending",
            details: "Waiting to generate deployment instructions...",
          },
          {
            submissionId: submission.id,
            stepId: "test_setup",
            status: "pending",
            details: "Waiting to set up test environment...",
          },
          {
            submissionId: submission.id,
            stepId: "simulations",
            status: "pending",
            details: "Waiting to run simulations...",
          }
        ]);

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

    // Insert steps for this submission
    const [initialStep] = await db
      .insert(analysisSteps)
      .values({
        submissionId: submission.id,
        stepId: "files",
        status: "in_progress",
        details: "Analyzing project structure and smart contracts...",
      })
      .returning();

    // Insert other steps as pending
    await db
      .insert(analysisSteps)
      .values([
        {
          submissionId: submission.id,
          stepId: "actors",
          status: "pending",
          details: "Waiting to analyze actors and interactions...",
        },
        {
          submissionId: submission.id,
          stepId: "deployment",
          status: "pending",
          details: "Waiting to generate deployment instructions...",
        },
        {
          submissionId: submission.id,
          stepId: "test_setup",
          status: "pending",
          details: "Waiting to set up test environment...",
        },
        {
          submissionId: submission.id,
          stepId: "simulations",
          status: "pending",
          details: "Waiting to run simulations...",
        }
      ]);

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
  app.get("/api/project/:id", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

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


  // Reanalyze project files or actors
  app.post("/api/reanalyze/:id/:section", async (req, res) => {
    try {
      const { id, section } = req.params;

      // Get the analysis step
      const [step] = await db
        .select()
        .from(analysisSteps)
        .where(eq(analysisSteps.submissionId, id))
        .where(eq(analysisSteps.stepId, section))
        .limit(1);

      if (!step) {
        return res.status(404).json({ message: "Analysis step not found" });
      }

      // Update step status to trigger reanalysis
      await db
        .update(analysisSteps)
        .set({ 
          status: "in_progress",
          details: "Reanalyzing...",
          createdAt: new Date()
        })
        .where(eq(analysisSteps.submissionId, id))
        .where(eq(analysisSteps.stepId, section));

      res.json({ message: "Reanalysis started" });
    } catch (error) {
      console.error("Error triggering reanalysis:", error);
      res.status(500).json({ message: "Failed to trigger reanalysis" });
    }
  });

  // Refine analysis with AI prompt
  app.post("/api/refine-analysis/:id/:section", async (req, res) => {
    try {
      const { id, section } = req.params;
      const { prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      // Get the analysis step
      const [step] = await db
        .select()
        .from(analysisSteps)
        .where(eq(analysisSteps.submissionId, id))
        .where(eq(analysisSteps.stepId, section))
        .limit(1);

      if (!step) {
        return res.status(404).json({ message: "Analysis step not found" });
      }

      // Update step status to refine with AI
      await db
        .update(analysisSteps)
        .set({ 
          status: "in_progress",
          details: `Refining analysis with prompt: ${prompt}`,
          createdAt: new Date()
        })
        .where(eq(analysisSteps.submissionId, id))
        .where(eq(analysisSteps.stepId, section));

      res.json({ message: "Analysis refinement started" });
    } catch (error) {
      console.error("Error refining analysis:", error);
      res.status(500).json({ message: "Failed to refine analysis" });
    }
  });



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

      // Check which project we're looking at based on the projectId (or other identifier)
      const isStableBaseProject = submission[0].projectId === 24;

      // Create sample data for each project type
      const sampleData = {
        // New step IDs
        files: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: {
            "projectName": isStableBaseProject ? "StableBase" : "Predify",
            "projectSummary": isStableBaseProject 
              ? "A stablecoin protocol that maintains price stability through algorithmic mechanisms and collateral management."
              : "A decentralized prediction market platform that allows users to create markets, place bets, and earn rewards based on the outcome of various events.",
            "devEnvironment": "Hardhat + Solidity",
            "compiler": "0.8.17",
            "contracts": [
              {
                "name": isStableBaseProject ? "StableBase.sol" : "Predify.sol",
                "summary": isStableBaseProject 
                  ? "Main contract for the stablecoin protocol. Manages minting, redeeming, and stability mechanisms." 
                  : "Main contract for the prediction market platform. Handles creating markets, placing bets, and resolving outcomes.",
                "interfaces": isStableBaseProject 
                  ? ["IStablecoin", "IERC20"] 
                  : ["IPredictionMarket", "IERC20Receiver"],
                "libraries": isStableBaseProject 
                  ? ["SafeERC20", "SafeMath", "Ownable"] 
                  : ["SafeERC20", "AccessControl"]
              },
              {
                "name": isStableBaseProject ? "StabilityPool.sol" : "ManualResolutionStrategy.sol",
                "summary": isStableBaseProject 
                  ? "Manages a pool of funds for stability operations and liquidation protection." 
                  : "Implements a resolution strategy where authorized resolvers manually determine the outcome of markets.",
                "interfaces": isStableBaseProject 
                  ? ["IPool", "IRewardDistributor"] 
                  : ["IResolutionStrategy"],
                "libraries": isStableBaseProject 
                  ? ["SafeERC20", "ReentrancyGuard"] 
                  : ["AccessControl"]
              },
              {
                "name": isStableBaseProject ? "Oracle.sol" : "MockERC20.sol",
                "summary": isStableBaseProject 
                  ? "Price feed for collateral assets used by the protocol." 
                  : "A mock ERC20 token used for testing the prediction market.",
                "interfaces": isStableBaseProject 
                  ? ["AggregatorV3Interface"] 
                  : ["IERC20", "IERC20Metadata"],
                "libraries": isStableBaseProject 
                  ? ["Ownable"] 
                  : ["Context"]
              }
            ],
            "dependencies": isStableBaseProject 
              ? {
                  "@openzeppelin/contracts": "4.8.2",
                  "hardhat": "2.14.0",
                  "ethers": "5.7.2",
                  "chai": "4.3.7",
                  "@chainlink/contracts": "0.6.1"
                }
              : {
                  "@openzeppelin/contracts": "4.8.2",
                  "hardhat": "2.14.0",
                  "ethers": "5.7.2",
                  "chai": "4.3.7"
                }
          }
        },
        actors: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: isStableBaseProject 
            ? {
                "actors": [
                  {
                    "name": "Stablecoin Minter",
                    "summary": "Users who deposit collateral to mint new stablecoins.",
                    "actions": [
                      {
                        "name": "Deposit Collateral",
                        "summary": "Deposits collateral assets into the protocol.",
                        "contract_name": "StableBase",
                        "function_name": "depositCollateral",
                        "probability": 1.0
                      },
                      {
                        "name": "Mint Stablecoins",
                        "summary": "Mints new stablecoins against deposited collateral.",
                        "contract_name": "StableBase",
                        "function_name": "mintStablecoins",
                        "probability": 0.9
                      }
                    ]
                  },
                  {
                    "name": "Stablecoin Holder",
                    "summary": "Users who hold stablecoins and may redeem them for collateral.",
                    "actions": [
                      {
                        "name": "Redeem Stablecoins",
                        "summary": "Redeems stablecoins for underlying collateral.",
                        "contract_name": "StableBase",
                        "function_name": "redeemStablecoins",
                        "probability": 0.6
                      },
                      {
                        "name": "Transfer Stablecoins",
                        "summary": "Transfers stablecoins to another address.",
                        "contract_name": "StableBase",
                        "function_name": "transfer",
                        "probability": 0.8
                      }
                    ]
                  },
                  {
                    "name": "Stability Provider",
                    "summary": "Users who deposit stablecoins to the stability pool to earn rewards and protect the system.",
                    "actions": [
                      {
                        "name": "Provide Stability",
                        "summary": "Deposits stablecoins into the stability pool.",
                        "contract_name": "StabilityPool",
                        "function_name": "provideToSP",
                        "probability": 0.7
                      },
                      {
                        "name": "Withdraw From Pool",
                        "summary": "Withdraws stablecoins from the stability pool.",
                        "contract_name": "StabilityPool",
                        "function_name": "withdrawFromSP",
                        "probability": 0.5
                      },
                      {
                        "name": "Claim Rewards",
                        "summary": "Claims earned rewards from the stability pool.",
                        "contract_name": "StabilityPool",
                        "function_name": "claimRewards",
                        "probability": 0.8
                      }
                    ]
                  },
                  {
                    "name": "Liquidator",
                    "summary": "Actors who liquidate undercollateralized positions to maintain system solvency.",
                    "actions": [
                      {
                        "name": "Liquidate Position",
                        "summary": "Liquidates an undercollateralized position.",
                        "contract_name": "StableBase",
                        "function_name": "liquidate",
                        "probability": 0.4
                      }
                    ]
                  },
                  {
                    "name": "Protocol Admin",
                    "summary": "Administrators who manage protocol parameters and emergency functions.",
                    "actions": [
                      {
                        "name": "Update Parameters",
                        "summary": "Updates protocol parameters like fees or collateral ratios.",
                        "contract_name": "StableBase",
                        "function_name": "updateParameters",
                        "probability": 0.2
                      },
                      {
                        "name": "Pause System",
                        "summary": "Pauses the system in case of emergency.",
                        "contract_name": "StableBase",
                        "function_name": "pauseSystem",
                        "probability": 0.1
                      }
                    ]
                  }
                ]
              }
            : {
                "actors": [
                  {
                    "name": "Market Creator",
                    "summary": "Creates prediction markets with specific parameters like description, resolution strategy, and betting token.",
                    "actions": [
                      {
                        "name": "Create Market",
                        "summary": "Creates a new prediction market.",
                        "contract_name": "Predify",
                        "function_name": "createMarket",
                        "probability": 1.0
                      }
                    ]
                  },
                  {
                    "name": "Bettor",
                    "summary": "Participants who place bets on the outcome of prediction markets.",
                    "actions": [
                      {
                        "name": "Place Bet",
                        "summary": "Places a bet on a specific outcome in a market.",
                        "contract_name": "Predify",
                        "function_name": "predict",
                        "probability": 1.0
                      },
                      {
                        "name": "Claim Winnings",
                        "summary": "Allows users to claim their winnings from a resolved market.",
                        "contract_name": "Predify",
                        "function_name": "claim",
                        "probability": 1.0
                      },
                      {
                        "name": "Withdraw Bet",
                        "summary": "Allows users to withdraw their bet from a market.",
                        "contract_name": "Predify",
                        "function_name": "withdrawBet",
                        "probability": 1.0
                      }
                    ]
                  },
                  {
                    "name": "Market Resolver",
                    "summary": "Entity responsible for resolving the market based on a predefined resolution strategy.  This may be done manually or automatically.",
                    "actions": [
                      {
                        "name": "Resolve Market",
                        "summary": "Resolves a market to determine the winning outcome.",
                        "contract_name": "Predify",
                        "function_name": "resolveMarket",
                        "probability": 1.0
                      },
                      {
                        "name": "Register Outcome",
                        "summary": "Registers a possible outcome for a given market.",
                        "contract_name": "ManualResolutionStrategy",
                        "function_name": "registerOutcome",
                        "probability": 0.5
                      },
                      {
                        "name": "Resolve Market (Manual)",
                        "summary": "Resolves ajavascript\nasync function deployStableBase() {\n  // Deploy mock tokens for collateral\n  const MockWETH = await ethers.getContractFactory(\"MockWETH\");\n  const mockWETH = await MockWETH.deploy();\n  await mockWETH.deployed();\n  \n  const MockWBTC = await ethers.getContractFactory(\"MockWBTC\");\n  const mockWBTC = await MockWBTC.deploy();\n  await mockWBTC.deployed();\n  \n  // Deploy oracle for price feeds\n  const Oracle = await ethers.getContractFactory(\"Oracle\");\n  const oracle = await Oracle.deploy();\n  await oracle.deployed();\n  \n  // Set initial prices\n  await oracle.setPrice(mockWETH.address, ethers.utils.parseUnits(\"2000\", 8));\n  await oracle.setPrice(mockWBTC.address, ethers.utils.parseUnits(\"30000\", 8));\n  \n  // Deploy main StableBase contract\n  const StableBase = await ethers.getContractFactory(\"StableBase\");\n  const stableBase = await StableBase.deploy(oracle.address);\n  await stableBase.deployed();\n  \n  // Deploy StabilityPool\n  const StabilityPool = await ethers.getContractFactory(\"StabilityPool\");\n  const stabilityPool = await StabilityPool.deploy(stableBase.address);\n  await stabilityPool.deployed();\n  \n  // Configure StableBase with StabilityPool\n  await stableBase.setStabilityPool(stabilityPool.address);\n  \n  // Register collateral tokens\n  await stableBase.addCollateralToken(mockWETH.address, 150); // 150% collateralization ratio\n  await stableBase.addCollateralToken(mockWBTC.address, 130); // 130% collateralization ratio\n  \n  return {\n    stableBase,\n    stabilityPool,\n    oracle,\n    mockWETH,\n    mockWBTC\n  };\n}\n```"
                  },
                  {
                    "id": "actions_actors",
                    "name": "Implement Actions and Actors",
                    "status": "completed",
                    "description": "Implementing test actors and defining their actions in the simulation",
                    "output": "Actor implementations complete:\n\n```javascript\nasync function setupActors(contracts) {\n  const [admin, minter1, minter2, stabilityProvider, liquidator] = await ethers.getSigners();\n  \n  // Setup minters with collateral\n  await contracts.mockWETH.mint(minter1.address, ethers.utils.parseEther(\"100\"));\n  await contracts.mockWETH.connect(minter1).approve(contracts.stableBase.address, ethers.constants.MaxUint256);\n  \n  await contracts.mockWETH.mint(minter2.address, ethers.utils.parseEther(\"100\"));\n  await contracts.mockWETH.connect(minter2).approve(contracts.stableBase.address, ethers.constants.MaxUint256);\n  \n  await contracts.mockWBTC.mint(minter1.address, ethers.utils.parseUnits(\"5\", 8));\n  await contracts.mockWBTC.connect(minter1).approve(contracts.stableBase.address, ethers.constants.MaxUint256);\n  \n  // Define actor actions\n  const actors = {\n    admin: {\n      signer: admin,\n      updateOraclePrice: async (token, price) => {\n        return contracts.oracle.setPrice(token, ethers.utils.parseUnits(price.toString(), 8));\n      }\n    },\n    minter1: {\n      signer: minter1,\n      depositCollateral: async (token, amount) => {\n        return contracts.stableBase.connect(minter1).depositCollateral(token, ethers.utils.parseUnits(amount.toString(), token === contracts.mockWBTC.address ? 8 : 18));\n      },\n      mintStablecoins: async (token, amount) => {\n        return contracts.stableBase.connect(minter1).mintStablecoins(token, ethers.utils.parseEther(amount.toString()));\n      },\n      redeemStablecoins: async (amount) => {\n        return contracts.stableBase.connect(minter1).redeemStablecoins(ethers.utils.parseEther(amount.toString()));\n      }\n    },\n    stabilityProvider: {\n      signer: stabilityProvider,\n      provideToSP: async (amount) => {\n        // First get some stablecoins\n        await contracts.stableBase.connect(admin).mintStablecoinsToCaller(ethers.utils.parseEther(amount.toString()));\n        await contracts.stableBase.connect(admin).transfer(stabilityProvider.address, ethers.utils.parseEther(amount.toString()));\n        await contracts.stableBase.connect(stabilityProvider).approve(contracts.stabilityPool.address, ethers.constants.MaxUint256);\n        return contracts.stabilityPool.connect(stabilityProvider).provideToSP(ethers.utils.parseEther(amount.toString()));\n      },\n      withdrawFromSP: async (amount) => {\n        return contracts.stabilityPool.connect(stabilityProvider).withdrawFromSP(ethers.utils.parseEther(amount.toString()));\n      }\n    },\n    liquidator: {\n      signer: liquidator,\n      liquidatePosition: async (userAddress, token) => {\n        return contracts.stableBase.connect(liquidator).liquidate(userAddress, token);\n      }\n    }\n  };\n  \n  return actors;\n}\n```\n\nChat interface ready for adjusting test parameters and actor behaviors."
                  }
                ]
              }
            : {
                "testEnvironment": "Hardhat with ethers.js",
                "networkSettings": {
                  "name": "Hardhat Local Network",
                  "chainId": 31337,
                  "gasLimit": 30000000,
                  "accounts": [
                    {
                      "name": "Market Creator",
                      "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Bettor 1",
                      "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Bettor 2",
                      "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Market Resolver",
                      "address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Token Manager",
                      "address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
                      "balance": "10000 ETH"
                    }
                  ]
                },
                "testCases": [
                  {
                    "name": "Market Creation",
                    "file": "test/market-creation.test.js",
                    "description": "Tests the creation of new prediction markets with various parameters"
                  },
                  {
                    "name": "Betting Mechanics",
                    "file": "test/betting.test.js",
                    "description": "Tests placing, withdrawing, and claiming bets"
                  },
                  {
                    "name": "Market Resolution",
                    "file": "test/resolution.test.js",
                    "description": "Tests different market resolution strategies"
                  },
                  {
                    "name": "Security Tests",
                    "file": "test/security.test.js",
                    "description": "Tests for potential security vulnerabilities"
                  }
                ],
                "fixtures": {
                  "tokens": [
                    {
                      "name": "Mock USDC",
                      "symbol": "mUSDC",
                      "decimals": 6,
                      "initialSupply": "1000000000000"
                    },
                    {
                      "name": "Mock DAI",
                      "symbol": "mDAI",
                      "decimals": 18,
                      "initialSupply": "1000000000000000000000000"
                    }
                  ],
                  "markets": [
                    {
                      "description": "Will ETH price exceed $5000 by end of 2023?",
                      "outcomes": ["Yes", "No"],
                      "resolutionStrategy": "ManualResolutionStrategy"
                    },
                    {
                      "description": "Will Bitcoin halving occur before April 2024?",
                      "outcomes": ["Yes", "No"],
                      "resolutionStrategy": "ManualResolutionStrategy"
                    }
                  ]
                },
                "substeps": [
                  {
                    "id": "setup_workspace",
                    "name": "Setup Workspace",
                    "status": "completed",
                    "description": "Creating simulation repository and configuring development environment",
                    "output": "Workspace initialized:\n- Hardhat environment configured\n- Dependencies installed\n- Network settings applied\n- Test accounts created\n\nCreated project structure:\n- /contracts: Smart contract source files\n- /test: Test scripts and scenarios\n- /scripts: Deployment and utility scripts"
                  },
                  {
                    "id": "contract_deployment",
                    "name": "Implement Contract Deployments",
                    "status": "completed",
                    "description": "Setting up contract deployment scripts and configurations",
                    "output": "Contracts deployment configured:\n\n```javascript\nasync function deployPredify() {\n  // Deploy mock tokens for prediction market betting\n  const MockUSDC = await ethers.getContractFactory(\"MockERC20\");\n  const mockUSDC = await MockUSDC.deploy(\"Mock USDC\", \"mUSDC\", 6);\n  await mockUSDC.deployed();\n  \n  const MockDAI = await ethers.getContractFactory(\"MockERC20\");\n  const mockDAI = await MockDAI.deploy(\"Mock DAI\", \"mDAI\", 18);\n  await mockDAI.deployed();\n  \n  // Deploy resolution strategy contract\n  const ManualResolutionStrategy = await ethers.getContractFactory(\"ManualResolutionStrategy\");\n  const manualResolutionStrategy = await ManualResolutionStrategy.deploy();\n  await manualResolutionStrategy.deployed();\n  \n  // Deploy main Predify contract\n  const Predify = await ethers.getContractFactory(\"Predify\");\n  const predify = await Predify.deploy();\n  await predify.deployed();\n  \n  // Register resolution strategy\n  await predify.addResolutionStrategy(manualResolutionStrategy.address);\n  \n  // Register tokens\n  await predify.addSupportedToken(mockUSDC.address);\n  await predify.addSupportedToken(mockDAI.address);\n  \n  return {\n    predify,\n    manualResolutionStrategy,\n    mockUSDC,\n    mockDAI\n  };\n}\n```"
                  },
                  {
                    "id": "actions_actors",
                    "name": "Implement Actions and Actors",
                    "status": "completed",
                    "description": "Implementing test actors and defining their actions in the simulation",
                    "output": "Actor implementations complete:\n\n```javascript\nasync function setupActors(contracts) {\n  const [marketCreator, bettor1, bettor2, resolver, tokenManager] = await ethers.getSigners();\n  \n  // Distribute tokens to actors\n  await contracts.mockUSDC.connect(tokenManager).mint(bettor1.address, ethers.utils.parseUnits(\"10000\", 6));\n  await contracts.mockUSDC.connect(tokenManager).mint(bettor2.address, ethers.utils.parseUnits(\"10000\", 6));\n  await contracts.mockDAI.connect(tokenManager).mint(bettor1.address, ethers.utils.parseEther(\"10000\"));\n  await contracts.mockDAI.connect(tokenManager).mint(bettor2.address, ethers.utils.parseEther(\"10000\"));\n  \n  // Approvals\n  await contracts.mockUSDC.connect(bettor1).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockUSDC.connect(bettor2).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockDAI.connect(bettor1).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockDAI.connect(bettor2).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  \n  // Grant resolver role\n  await contracts.manualResolutionStrategy.grantRole(await contracts.manualResolutionStrategy.RESOLVER_ROLE(), resolver.address);\n  \n  // Define actor actions\n  const actors = {\n    marketCreator: {\n      signer: marketCreator,\n      createMarket: async (description, outcomes, token, resolutionStrategyAddress) => {\n        return contracts.predify.connect(marketCreator).createMarket(\n          description,\n          outcomes,\n          token,\n          resolutionStrategyAddress || contracts.manualResolutionStrategy.address\n        );\n      }\n    },\n    bettor1: {\n      signer: bettor1,\n      placeBet: async (marketId, outcomeIndex, amount, token) => {\n        return contracts.predify.connect(bettor1).predict(\n          marketId,\n          outcomeIndex,\n          token === contracts.mockUSDC.address ? \n            ethers.utils.parseUnits(amount.toString(), 6) : \n            ethers.utils.parseEther(amount.toString()),\n          token\n        );\n      },\n      claimWinnings: async (marketId) => {\n        return contracts.predify.connect(bettor1).claim(marketId);\n      },\n      withdrawBet: async (marketId) => {\n        return contracts.predify.connect(bettor1).withdrawBet(marketId);\n      }\n    },\n    bettor2: {\n      signer: bettor2,\n      placeBet: async (marketId, outcomeIndex, amount, token) => {\n        return contracts.predify.connect(bettor2).predict(\n          marketId,\n          outcomeIndex,\n          token === contracts.mockUSDC.address ? \n            ethers.utils.parseUnits(amount.toString(), 6) : \n            ethers.utils.parseEther(amount.toString()),\n          token\n        );\n      },\n      claimWinnings: async (marketId) => {\n        return contracts.predify.connect(bettor2).claim(marketId);\n      },\n      withdrawBet: async (marketId) => {\n        return contracts.predify.connect(bettor2).withdrawBet(marketId);\n      }\n    },\n    resolver: {\n      signer: resolver,\n      resolveMarket: async (marketId, winningOutcomeIndex) => {\n        return contracts.predify.connect(resolver).resolveMarket(marketId, winningOutcomeIndex);\n      },\n      manualResolve: async (marketId, winningOutcomeIndex) => {\n        return contracts.manualResolutionStrategy.connect(resolver).resolve(marketId, winningOutcomeIndex);\n      }\n    },\n    tokenManager: {\n      signer: tokenManager,\n      mintTokens: async (token, to, amount) => {\n        const decimals = token === contracts.mockUSDC.address ? 6 : 18;\n        return token === contracts.mockUSDC.address ?\n          contracts.mockUSDC.connect(tokenManager).mint(to, ethers.utils.parseUnits(amount.toString(), decimals)) :\n          contracts.mockDAI.connect(tokenManager).mint(to, ethers.utils.parseUnits(amount.toString(), decimals));\n      }\n    }\n  };\n  \n  return actors;\n}\n given market with provided resolution data to determine the winning outcome.",
                        "contract_name": "ManualResolutionStrategy",
                        "function_name": "resolve",
                        "probability": 1.0
                      }
                    ]
                  },
                  {
                    "name": "Token Manager",
                    "summary": "Can mint or burn tokens in the Predify ecosystem, if a mock token is used. This role manages the supply of the betting token.",
                    "actions": [
                      {
                        "name": "Mint Tokens",
                        "summary": "Mints new tokens to the specified address.",
                        "contract_name": "MockERC20",
                        "function_name": "mint",
                        "probability": 0.5
                      },
                      {
                        "name": "Burn Tokens",
                        "summary": "Burns tokens from the specified address.",
                        "contract_name": "MockERC20",
                        "function_name": "burn",
                        "probability": 0.5
                      }
                    ]
                  }
                ]
              }
        },
        test_setup: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: isStableBaseProject 
            ? {
                "testEnvironment": "Hardhat with ethers.js",
                "networkSettings": {
                  "name": "Hardhat Local Network",
                  "chainId": 31337,
                  "gasLimit": 30000000,
                  "accounts": [
                    {
                      "name": "Protocol Admin",
                      "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Stablecoin Minter 1",
                      "address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Stablecoin Minter 2",
                      "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Stability Provider",
                      "address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
                      "balance": "10000 ETH"
                    },
                    {
                      "name": "Liquidator",
                      "address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
                      "balance": "10000 ETH"
                    }
                  ]
                },
                "testCases": [
                  {
                    "name": "Stablecoin Minting",
                    "file": "test/minting.test.js",
                    "description": "Tests the minting of stablecoins with various collateral types and ratios"
                  },
                  {
                    "name": "Stablecoin Redemption",
                    "file": "test/redemption.test.js",
                    "description": "Tests redeeming stablecoins for underlying collateral"
                  },
                  {
                    "name": "Stability Pool",
                    "file": "test/stability-pool.test.js",
                    "description": "Tests depositing to and withdrawing from the stability pool"
                  },
                  {
                    "name": "Liquidation",
                    "file": "test/liquidation.test.js",
                    "description": "Tests liquidation of undercollateralized positions"
                  },
                  {
                    "name": "Oracle Integration",
                    "file": "test/oracle.test.js",
                    "description": "Tests interaction with price feed oracles"
                  },
                  {
                    "name": "Security Tests",
                    "file": "test/security.test.js",
                    "description": "Tests for potential security vulnerabilities"
                  }
                ],
                "fixtures": {
                  "tokens": [
                    {
                      "name": "Mock WETH",
                      "symbol": "mWETH",
                      "decimals": 18,
                      "initialSupply": "1000000000000000000000"
                    },
                    {
                      "name": "Mock WBTC",
                      "symbol": "mWBTC",
                      "decimals": 8,
                      "initialSupply": "1000000000"
                    },
                    {
                      "name": "StableBase USD",
                      "symbol": "sbUSD",
                      "decimals": 18,
                      "initialSupply": "0"
                    }
                  ],
                  "priceFeeds": [
                    {
                      "asset": "ETH",
                      "price": "$2000",
                      "deviationThreshold": "1%"
                    },
                    {
                      "asset": "BTC",
                      "price": "$30000",
                      "deviationThreshold": "1%"
                    }
                  ]
                },
                "substeps": [
                  {
                    "id": "setup_workspace",
                    "name": "Setup Workspace",
                    "status": "completed",
                    "description": "Creating simulation repository and configuring development environment",
                    "output": "Workspace initialized:\n- Hardhat environment configured\n- Dependencies installed\n- Network settings applied\n- Test accounts created\n\nCreated project structure:\n- /contracts: Smart contract source files\n- /test: Test scripts and scenarios\n- /scripts: Deployment and utility scripts"
                  },
                  {
                    "id": "contract_deployment",
                    "name": "Implement Contract Deployments",
                    "status": "completed",
                    "description": "Setting up contract deployment scripts and configurations",
                    "output": "Contracts deployment configured:\n\n```javascript\nasync function deployPredify() {\n  // Deploy mock tokens for prediction market betting\n  const MockUSDC = await ethers.getContractFactory(\"MockERC20\");\n  const mockUSDC = await MockUSDC.deploy(\"Mock USDC\", \"mUSDC\", 6);\n  await mockUSDC.deployed();\n  \n  const MockDAI = await ethers.getContractFactory(\"MockERC20\");\n  const mockDAI = await MockDAI.deploy(\"Mock DAI\", \"mDAI\", 18);\n  await mockDAI.deployed();\n  \n  // Deploy resolution strategy contract\n  const ManualResolutionStrategy = await ethers.getContractFactory(\"ManualResolutionStrategy\");\n  const manualResolutionStrategy = await ManualResolutionStrategy.deploy();\n  await manualResolutionStrategy.deployed();\n  \n  // Deploy main Predify contract\n  const Predify = await ethers.getContractFactory(\"Predify\");\n  const predify = await Predify.deploy();\n  await predify.deployed();\n  \n  // Register resolution strategy\n  await predify.addResolutionStrategy(manualResolutionStrategy.address);\n  \n  // Register tokens\n  await predify.addSupportedToken(mockUSDC.address);\n  await predify.addSupportedToken(mockDAI.address);\n  \n  return {\n    predify,\n    manualResolutionStrategy,\n    mockUSDC,\n    mockDAI\n  };\n}\n```"
                  },
                  {
                    "id": "actions_actors",
                    "name": "Implement Actions and Actors",
                    "status": "completed",
                    "description": "Implementing test actors and defining their actions in the simulation",
                    "output": "Actor implementations complete:\n\n```javascript\nasync function setupActors(contracts) {\n  const [marketCreator, bettor1, bettor2, resolver, tokenManager] = await ethers.getSigners();\n  \n  // Distribute tokens to actors\n  await contracts.mockUSDC.connect(tokenManager).mint(bettor1.address, ethers.utils.parseUnits(\"10000\", 6));\n  await contracts.mockUSDC.connect(tokenManager).mint(bettor2.address, ethers.utils.parseUnits(\"10000\", 6));\n  await contracts.mockDAI.connect(tokenManager).mint(bettor1.address, ethers.utils.parseEther(\"10000\"));\n  await contracts.mockDAI.connect(tokenManager).mint(bettor2.address, ethers.utils.parseEther(\"10000\"));\n  \n  // Approvals\n  await contracts.mockUSDC.connect(bettor1).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockUSDC.connect(bettor2).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockDAI.connect(bettor1).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockDAI.connect(bettor2).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  \n  // Grant resolver role\n  await contracts.manualResolutionStrategy.grantRole(await contracts.manualResolutionStrategy.RESOLVER_ROLE(), resolver.address);\n  \n  // Define actor actions\n  const actors = {\n    marketCreator: {\n      signer: marketCreator,\n      createMarket: async (description, outcomes, token, resolutionStrategyAddress) => {\n        return contracts.predify.connect(marketCreator).createMarket(\n          description,\n          outcomes,\n          token,\n          resolutionStrategyAddress || contracts.manualResolutionStrategy.address\n        );\n      }\n    },\n    bettor1: {\n      signer: bettor1,\n      placeBet: async (marketId, outcomeIndex, amount, token) => {\n        return contracts.predify.connect(bettor1).predict(\n          marketId,\n          outcomeIndex,\n          token === contracts.mockUSDC.address ? \n            ethers.utils.parseUnits(amount.toString(), 6) : \n            ethers.utils.parseEther(amount.toString()),\n          token\n        );\n      },\n      claimWinnings: async (marketId) => {\n        return contracts.predify.connect(bettor1).claim(marketId);\n      },\n      withdrawBet: async (marketId) => {\n        return contracts.predify.connect(bettor1).withdrawBet(marketId);\n      }\n    },\n    bettor2: {\n      signer: bettor2,\n      placeBet: async (marketId, outcomeIndex, amount, token) => {\n        return contracts.predify.connect(bettor2).predict(\n          marketId,\n          outcomeIndex,\n          token === contracts.mockUSDC.address ? \n            ethers.utils.parseUnits(amount.toString(), 6) : \n            ethers.utils.parseEther(amount.toString()),\n          token\n        );\n      },\n      claimWinnings: async (marketId) => {\n        return contracts.predify.connect(bettor2).claim(marketId);\n      },\n      withdrawBet: async (marketId) => {\n        return contracts.predify.connect(bettor2).withdrawBet(marketId);\n      }\n    },\n    resolver: {\n      signer: resolver,\n      resolveMarket: async (marketId, winningOutcomeIndex) => {\n        return contracts.predify.connect(resolver).resolveMarket(marketId, winningOutcomeIndex);\n      },\n      manualResolve: async (marketId, winningOutcomeIndex) => {\n        return contracts.manualResolutionStrategy.connect(resolver).resolve(marketId, winningOutcomeIndex);\n      }\n    },\n    tokenManager: {\n      signer: tokenManager,\n      mintTokens: async (token, to, amount) => {\n        const decimals = token === contracts.mockUSDC.address ? 6 : 18;\n        return token === contracts.mockUSDC.address ?\n          contracts.mockUSDC.connect(tokenManager).mint(to, ethers.utils.parseUnits(amount.toString(), decimals)) :\n          contracts.mockDAI.connect(tokenManager).mint(to, ethers.utils.parseUnits(amount.toString(), decimals));\n      }\n    }\n  };\n  \n  return actors;\n}\n