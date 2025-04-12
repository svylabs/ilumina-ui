import type { Express } from "express";
import { createServer, type Server } from "http";
import { db, pool } from "@db";
import { 
  submissions, runs, projects, simulationRuns, users, projectFiles,
  insertSubmissionSchema, insertContactSchema, 
  pricingPlans, planFeatures, teams, teamMembers, teamInvitations
} from "@db/schema";
import { eq, sql, desc } from "drizzle-orm";
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
  
  // Create HTTP server
  const httpServer = createServer(app);
  
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

  // Get project files endpoint
  app.get("/api/files/:id", async (req, res) => {
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
      
      // Check if we have project files data in our database
      const projectFilesData = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.submissionId, submissionId))
        .limit(1);
      
      if (projectFilesData.length > 0) {
        // Return the project files from database
        return res.json(projectFilesData[0]);
      }
      
      // If no database record found, derive project type and create default data
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.githubUrl, submissionId))
        .limit(1);
      
      // Determine if this is a StableBase or Predify project (default to Predify)
      // Use dynamic project name check instead of hard-coded ID
      const isStableBaseProject = project.length > 0 && 
        project[0].name?.toLowerCase().includes('stablebase');
      const projectType = isStableBaseProject ? "StableBase" : "Predify";
      
      // Create default data for this project type
      const defaultData = {
        submissionId,
        projectName: isStableBaseProject ? "StableBase" : "Predify",
        projectSummary: isStableBaseProject 
          ? "A stablecoin protocol that maintains price stability through algorithmic mechanisms and collateral management."
          : "A decentralized prediction market platform that allows users to create markets, place bets, and earn rewards based on the outcome of various events.",
        devEnvironment: "Hardhat + Solidity",
        compiler: "0.8.17",
        contracts: [
          {
            name: isStableBaseProject ? "StableBase.sol" : "Predify.sol",
            summary: isStableBaseProject 
              ? "Main contract for the stablecoin protocol. Manages minting, redeeming, and stability mechanisms." 
              : "Main contract for the prediction market platform. Handles creating markets, placing bets, and resolving outcomes.",
            interfaces: isStableBaseProject 
              ? ["IStablecoin", "IERC20"] 
              : ["IPredictionMarket", "IERC20Receiver"],
            libraries: isStableBaseProject 
              ? ["SafeERC20", "SafeMath", "Ownable"] 
              : ["SafeERC20", "AccessControl"]
          },
          {
            name: isStableBaseProject ? "StabilityPool.sol" : "ManualResolutionStrategy.sol",
            summary: isStableBaseProject 
              ? "Manages a pool of funds for stability operations and liquidation protection." 
              : "Implements a resolution strategy where authorized resolvers manually determine the outcome of markets.",
            interfaces: isStableBaseProject 
              ? ["IPool", "IRewardDistributor"] 
              : ["IResolutionStrategy"],
            libraries: isStableBaseProject 
              ? ["SafeERC20", "ReentrancyGuard"] 
              : ["AccessControl"]
          },
          {
            name: isStableBaseProject ? "Oracle.sol" : "MockERC20.sol",
            summary: isStableBaseProject 
              ? "Price feed for collateral assets used by the protocol." 
              : "A mock ERC20 token used for testing the prediction market.",
            interfaces: isStableBaseProject 
              ? ["AggregatorV3Interface"] 
              : ["IERC20", "IERC20Metadata"],
            libraries: isStableBaseProject 
              ? ["Ownable"] 
              : ["Context"]
          }
        ],
        dependencies: isStableBaseProject 
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
            },
        projectType
      };
      
      // Save default data to database for future use
      try {
        const [insertedData] = await db
          .insert(projectFiles)
          .values(defaultData)
          .returning();
        
        return res.json(insertedData);
      } catch (dbError) {
        console.error("Error saving project files data:", dbError);
        // Even if saving to DB failed, return the default data
        return res.json(defaultData);
      }
    } catch (error) {
      console.error("Error fetching project files:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch project files data" 
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
      .where(eq(projects.isDeleted, false)) // Filter out soft-deleted projects
      .where(sql`${projects.teamId} IS NULL`) // Only include personal projects (not team projects)
      .orderBy(projects.createdAt);

    res.json(userProjects);
  });

  // Modify the project creation endpoint
  app.post("/api/projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const maxProjects = req.user.plan === 'teams' ? Infinity :
                       req.user.plan === 'pro' ? 3 : 1;

    // Get current project count (exclude deleted projects)
    const projectCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.userId, req.user.id))
      .where(eq(projects.isDeleted, false))
      .then(result => result[0].count);

    if (projectCount >= maxProjects) {
      return res.status(403).json({
        message: `You've reached the maximum number of projects for your ${req.user.plan} plan`
      });
    }

    // Helper function to normalize GitHub URLs
    const normalizeGitHubUrl = (url: string): string => {
      // Remove protocol, trailing slash, and .git extension
      return url.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\.git$/, '')
        .replace(/\/$/, '');
    };

    // Get all user's active projects to compare normalized URLs
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, req.user.id))
      .where(eq(projects.isDeleted, false));
    
    // Check for existing project with same GitHub URL by comparing normalized URLs
    const normalizedNewUrl = normalizeGitHubUrl(req.body.githubUrl);
    const existingProject = userProjects.find(project => 
      normalizeGitHubUrl(project.githubUrl) === normalizedNewUrl
    );

    if (existingProject) {
      return res.status(400).json({
        message: "A project with this GitHub URL already exists in your account"
      });
    }

    // Check team access if teamId is provided and it's not "personal"
    if (req.body.teamId && req.body.teamId !== "personal") {
      // Verify the user is on the Teams plan
      if (req.user.plan !== 'teams') {
        return res.status(403).json({
          message: "Only users with a Teams plan can create team projects"
        });
      }

      const teamId = parseInt(req.body.teamId);

      // Verify the user is a member of this team
      const teamMembership = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .where(eq(teamMembers.userId, req.user.id))
        .where(eq(teamMembers.status, 'active'));

      // Also check if user is the team creator
      const isTeamCreator = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .where(eq(teams.createdBy, req.user.id))
        .where(eq(teams.isDeleted, false));

      if (teamMembership.length === 0 && isTeamCreator.length === 0) {
        return res.status(403).json({
          message: "You are not a member of this team"
        });
      }
    }

    // Start a transaction to create both project and submission
    const [project, submission] = await db.transaction(async (tx) => {
      // Handle team ID logic - if "personal" or not specified, set to null
      let finalTeamId = null;
      if (req.body.teamId && req.body.teamId !== "personal") {
        finalTeamId = parseInt(req.body.teamId);
      }
      
      const [project] = await tx
        .insert(projects)
        .values({
          name: req.body.name,
          githubUrl: req.body.githubUrl,
          userId: req.user.id,
          teamId: finalTeamId, // Use the calculated team ID
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
      const analysisResponse = await fetch('https://ilumina-451416.uc.r.appspot.com/api/begin_analysis', {
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

    // Get the project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({
        message: "Project not found"
      });
    }
    
    // Check permission based on whether it's a personal or team project
    if (project.teamId) {
      // It's a team project - check if user is team admin or creator
      
      // Check if user is the team creator
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, project.teamId))
        .where(eq(teams.createdBy, req.user.id))
        .where(eq(teams.isDeleted, false));
      
      // Check if user is a team admin
      const [teamMember] = await db
        .select()
        .from(teamMembers)
        .where(eq(teamMembers.teamId, project.teamId))
        .where(eq(teamMembers.userId, req.user.id))
        .where(eq(teamMembers.role, 'admin'))
        .where(eq(teamMembers.status, 'active'));
      
      if (!team && !teamMember) {
        return res.status(403).json({
          message: "You don't have permission to delete this team project"
        });
      }
    } else {
      // It's a personal project - check if user is the owner
      if (project.userId !== req.user.id) {
        return res.status(403).json({
          message: "You don't have permission to delete this project"
        });
      }
    }

    // Soft delete the project instead of hard delete
    await db
      .update(projects)
      .set({ isDeleted: true })
      .where(eq(projects.id, projectId));
    
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
      const analysisResponse = await fetch('https://ilumina-451416.uc.r.appspot.com/api/begin_analysis', {
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

  // Fetch project details by ID or via submission ID
  app.get("/api/project/:id", async (req, res) => {
    try {
      // Get the project ID from the URL parameter
      const requestedId = req.params.id;
      console.log(`Project API request for ID: ${requestedId}`);
      
      // Only process numeric IDs
      const projectId = parseInt(requestedId);
      
      // DEBUG: Print out what we're getting from the database
      console.log(`Running SELECT * FROM projects WHERE id = ${projectId} AND is_deleted = false`);
      
      if (!isNaN(projectId)) {
        // Try to find the project with requested ID and is not deleted
        const dbResult = await pool.query(
          `SELECT * FROM projects WHERE id = $1 AND is_deleted = false LIMIT 1`, 
          [projectId]
        );
        
        // Debug output to see what's being returned from the database
        const rows = dbResult.rows || [];
        console.log(`Found ${rows.length} projects with ID ${projectId}`);
        if (rows.length > 0) {
          console.log(`Project details:`, rows[0]);
        }
        
        // If we found a project, return it
        if (rows.length > 0) {
          // Convert snake_case to camelCase for frontend consistency
          const project = {
            id: rows[0].id,
            name: rows[0].name,
            githubUrl: rows[0].github_url,
            userId: rows[0].user_id,
            teamId: rows[0].team_id,
            createdAt: rows[0].created_at,
            isDeleted: rows[0].is_deleted
          };
          
          console.log(`Returning project:`, project);
          return res.json(project);
        } else {
          console.log(`No project found with ID ${projectId}`);
        }
      } else {
        console.log(`ID ${requestedId} is not a valid numeric ID`);
      }
      
      // If we get here, check if this is a submission ID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId)) {
        console.log(`ID ${requestedId} is a UUID, checking for submission`);
        
        // Find the submission
        const submissionDbResult = await pool.query(
          `SELECT * FROM submissions WHERE id = $1 LIMIT 1`, 
          [requestedId]
        );
        
        const submissionRows = submissionDbResult.rows || [];
        console.log(`Found ${submissionRows.length} submissions with ID ${requestedId}`);
        
        // If we found a submission with a project ID, get that project
        if (submissionRows.length > 0 && submissionRows[0].project_id) {
          const projectId = submissionRows[0].project_id;
          console.log(`Submission has project ID: ${projectId}`);
          
          const projectDbResult = await pool.query(
            `SELECT * FROM projects WHERE id = $1 AND is_deleted = false LIMIT 1`, 
            [projectId]
          );
          
          const projectRows = projectDbResult.rows || [];
          console.log(`Found ${projectRows.length} projects with ID ${projectId} from submission`);
          
          if (projectRows.length > 0) {
            // Convert snake_case to camelCase for frontend consistency
            const project = {
              id: projectRows[0].id,
              name: projectRows[0].name,
              githubUrl: projectRows[0].github_url,
              userId: projectRows[0].user_id,
              teamId: projectRows[0].team_id,
              createdAt: projectRows[0].created_at,
              isDeleted: projectRows[0].is_deleted
            };
            
            console.log(`Returning project from submission:`, project);
            return res.json(project);
          }
        }
      }
      
      // If we reach here, no project was found
      console.log(`No project found for ID ${requestedId}`);
      return res.status(404).json({ message: "Project not found" });
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ message: "Failed to fetch project details" });
    }
  });

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      
      // For testing purposes, use the test submission ID
      const effectiveSubmissionId = submissionId === "test-submission-id" ? 
        submissionId : submissionId;

      // Special case for test submission ID
      if (submissionId === "test-submission-id") {
        // Skip database lookup for test submission ID
        console.log("Using test submission ID");
      } 
      // Check if it's a numeric project ID
      else if (/^\d+$/.test(submissionId)) {
        let submission = await db
          .select()
          .from(submissions)
          .where(eq(submissions.projectId, parseInt(submissionId)))
          .orderBy(desc(submissions.createdAt))
          .limit(1);
          
        if (submission.length === 0) {
          return res.status(404).json({ error: "Project not found" });
        }
      } 
      // Try UUID format for submission ID
      else {
        try {
          let submission = await db
            .select()
            .from(submissions)
            .where(eq(submissions.id, submissionId))
            .limit(1);
            
          if (submission.length === 0) {
            return res.status(404).json({ error: "Submission not found" });
          }
        } catch (dbError) {
          console.error("Database error:", dbError);
          return res.status(404).json({ error: "Invalid submission ID format" });
        }
      }
      
      // Get analysis steps from external API
      try {
        console.log(`Fetching from external API: ${effectiveSubmissionId}`);
        const response = await fetch(`https://ilumina-451416.uc.r.appspot.com/api/submission/${effectiveSubmissionId}`, {
          headers: {
            'Authorization': 'Bearer my_secure_password'
          }
        });
        
        if (!response.ok) {
          throw new Error(`External API returned ${response.status}`);
        }
        
        const analysisData = await response.json();
        return res.json(analysisData);
      } catch (error) {
        console.error("Error fetching from external API:", error);
        
        // For test submission ID or API failure, return default structure
        // Don't try to query the database for the test submission ID
        if (submissionId === "test-submission-id") {
          return res.json({
            status: "success",
            steps: {
              files: { status: "pending", details: null, startTime: null },
              actors: { status: "pending", details: null, startTime: null },
              test_setup: { status: "pending", details: null, startTime: null },
              deployment: { status: "pending", details: null, startTime: null },
              simulations: { status: "pending", details: null, startTime: null }
            }
          });
        }
        
        // For all cases where we reach this point, return default steps
        return res.json({
          status: "success",
          steps: {
            files: { status: "pending", details: null, startTime: null },
            actors: { status: "pending", details: null, startTime: null },
            test_setup: { status: "pending", details: null, startTime: null },
            deployment: { status: "pending", details: null, startTime: null },
            simulations: { status: "pending", details: null, startTime: null }
          }
        });
        
        return res.json({ status: "success", steps: response });
      }
    } catch (error) {
      console.error("Error in /api/analysis/:id endpoint:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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
  
  // Get project summary from external API 
  app.get("/api/project_summary/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      
      // For testing purposes, accept the test-submission-id
      const effectiveSubmissionId = submissionId === "test-submission-id" ? 
        submissionId : submissionId;

      console.log(`Fetching project summary for: ${effectiveSubmissionId}`);
      const response = await fetch(`https://ilumina-451416.uc.r.appspot.com/api/project_summary/${effectiveSubmissionId}`, {
        headers: {
          'Authorization': 'Bearer my_secure_password'
        }
      });
      
      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }
      
      const summaryData = await response.json();
      return res.json(summaryData);
    } catch (error) {
      console.error("Error fetching project summary:", error);
      res.status(500).json({ error: "Failed to fetch project summary" });
    }
  });
  
  // Get actors summary from external API 
  app.get("/api/actors_summary/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      
      // For testing purposes, accept the test-submission-id
      const effectiveSubmissionId = submissionId === "test-submission-id" ? 
        submissionId : submissionId;

      console.log(`Fetching actors summary for: ${effectiveSubmissionId}`);
      const response = await fetch(`https://ilumina-451416.uc.r.appspot.com/api/actors_summary/${effectiveSubmissionId}`, {
        headers: {
          'Authorization': 'Bearer my_secure_password'
        }
      });
      
      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }
      
      const actorsData = await response.json();
      return res.json(actorsData);
    } catch (error) {
      console.error("Error fetching actors summary:", error);
      res.status(500).json({ error: "Failed to fetch actors summary" });
    }
  });
  
  // Get deployment instructions from external API
  app.get("/api/deployment_instructions/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      
      // For testing purposes, accept the test-submission-id
      const effectiveSubmissionId = submissionId === "test-submission-id" ? 
        submissionId : submissionId;

      console.log(`Fetching deployment instructions for: ${effectiveSubmissionId}`);
      const response = await fetch(`https://ilumina-451416.uc.r.appspot.com/api/deployment_instructions/${effectiveSubmissionId}`, {
        headers: {
          'Authorization': 'Bearer my_secure_password'
        }
      });
      
      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }
      
      const deploymentData = await response.json();
      return res.json(deploymentData);
    } catch (error) {
      console.error("Error fetching deployment instructions:", error);
      res.status(500).json({ error: "Failed to fetch deployment instructions" });
    }
  });
  
  // Begin analysis for a submission with external API
  app.post("/api/begin_analysis", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const { submissionId, githubUrl } = req.body;
      
      if (!submissionId || !githubUrl) {
        return res.status(400).json({ error: "Missing required parameters" });
      }
      
      console.log(`Starting analysis for submission ${submissionId} with GitHub URL ${githubUrl}`);
      
      // Call the external API to start the analysis
      const response = await fetch('https://ilumina-451416.uc.r.appspot.com/api/begin_analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer my_secure_password'
        },
        body: JSON.stringify({
          submission_id: submissionId,
          github_repository_url: githubUrl
        })
      });
      
      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }
      
      const analysisResponse = await response.json();
      return res.json(analysisResponse);
    } catch (error) {
      console.error("Error starting analysis:", error);
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  return httpServer;
}
