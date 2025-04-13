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

    try {
      // Get only personal projects created by the current user (not deleted)
      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, req.user.id)) // Only projects owned by the current user
        .where(eq(projects.isDeleted, false)) // Filter out soft-deleted projects
        .where(sql`${projects.teamId} IS NULL`) // Only include personal projects (not team projects)
        .orderBy(projects.createdAt);

      console.log("Personal projects:", userProjects.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })));
      res.json(userProjects);
    } catch (error) {
      console.error("Error fetching user projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
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

    // REMOVED: GitHub URL duplication check as requested by user

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
    console.log(`Delete request received for project ID: ${req.params.id}`);
    
    if (!req.isAuthenticated()) {
      console.log("Unauthorized delete attempt - user not authenticated");
      return res.sendStatus(401);
    }

    const projectId = parseInt(req.params.id);
    console.log(`Parsed project ID for deletion: ${projectId}, user ID: ${req.user.id}`);

    // Get the project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    
    console.log(`Project fetch result:`, project);

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
    try {
      console.log(`Attempting to soft delete project ID: ${projectId}`);
      const result = await db
        .update(projects)
        .set({ isDeleted: true })
        .where(eq(projects.id, projectId));
      
      console.log(`Delete result:`, result);
      res.sendStatus(204);
    } catch (error) {
      console.error(`Error deleting project ID: ${projectId}`, error);
      res.status(500).json({ message: "Failed to delete project" });
    }
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
      if (!req.isAuthenticated()) return res.sendStatus(401);
      
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
        
        // If we found a project, check user access and return it
        if (rows.length > 0) {
          const project = {
            id: rows[0].id,
            name: rows[0].name,
            githubUrl: rows[0].github_url,
            userId: rows[0].user_id,
            teamId: rows[0].team_id,
            createdAt: rows[0].created_at,
            isDeleted: rows[0].is_deleted
          };
          
          // Check if the user is the owner or has team access
          const isOwner = project.userId === req.user.id;
          let hasTeamAccess = false;
          
          // If it's a team project, check team membership
          if (project.teamId !== null) {
            // Check if user is a member of the team
            const teamMembership = await db
              .select()
              .from(teamMembers)
              .where(sql`${teamMembers.teamId} = ${project.teamId}`)
              .where(sql`${teamMembers.userId} = ${req.user.id}`)
              .where(sql`${teamMembers.status} = 'active'`);
              
            // Also check if user is the team creator
            const isTeamCreator = await db
              .select()
              .from(teams)
              .where(sql`${teams.id} = ${project.teamId}`)
              .where(sql`${teams.createdBy} = ${req.user.id}`)
              .where(sql`${teams.isDeleted} = false`);
              
            hasTeamAccess = teamMembership.length > 0 || isTeamCreator.length > 0;
          }
          
          // Only return the project if the user has access
          if (isOwner || hasTeamAccess) {
            console.log(`Returning project:`, project);
            return res.json(project);
          } else {
            console.log(`User ${req.user.id} has no access to project ${projectId}`);
            return res.status(403).json({ 
              message: "You don't have permission to access this project" 
            });
          }
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

  // Helper function to fetch data from external Ilumina API
  async function fetchFromExternalApi(endpoint: string, submissionId: string) {
    console.log(`Fetching from external API: ${submissionId}`);
    try {
      const response = await fetch(`https://ilumina-451416.uc.r.appspot.com/api/${endpoint}/${submissionId}`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer my_secure_password'
        }
      });
      
      if (!response.ok) {
        throw new Error(`External API returned ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching from external API:', error);
      return null;
    }
  }
  
  // Get project summary data from external API
  app.get("/api/project_summary/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      const data = await fetchFromExternalApi('project_summary', submissionId);
      
      if (!data) {
        return res.status(404).json({ message: "Project summary not found" });
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching project summary:', error);
      res.status(500).json({ message: "Failed to fetch project summary" });
    }
  });
  
  // Get actors summary data from external API
  app.get("/api/actors_summary/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      const data = await fetchFromExternalApi('actors_summary', submissionId);
      
      if (!data) {
        return res.status(404).json({ message: "Actors summary not found" });
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching actors summary:', error);
      res.status(500).json({ message: "Failed to fetch actors summary" });
    }
  });
  
  // Get deployment instructions from external API
  app.get("/api/deployment_instructions/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      const data = await fetchFromExternalApi('deployment_instructions', submissionId);
      
      if (!data) {
        return res.status(404).json({ message: "Deployment instructions not found" });
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching deployment instructions:', error);
      res.status(500).json({ message: "Failed to fetch deployment instructions" });
    }
  });
  
  // Get submission status and details
  app.get("/api/submission/:id", async (req, res) => {
    try {
      const submissionId = req.params.id;
      const data = await fetchFromExternalApi('submission', submissionId);
      
      if (!data) {
        return res.status(404).json({ message: "Submission not found" });
      }
      
      res.json(data);
    } catch (error) {
      console.error('Error fetching submission:', error);
      res.status(500).json({ message: "Failed to fetch submission" });
    }
  });

  // Function to handle special test submission from external API
  async function getTestSubmissionAnalysis(submissionId: string) {
    // Test submission special case - we only use external API data
    console.log("Fetching test submission from external API");
    const externalSubmissionData = await fetchFromExternalApi('submission', submissionId);
    
    if (!externalSubmissionData) {
      return { error: "Test submission data not found" };
    }
    
    // Initialize steps with default pending status
    const stepsStatus: Record<string, AnalysisStepStatus> = {
      files: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null,
        jsonData: null
      },
      actors: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null,
        jsonData: null
      },
      test_setup: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null,
        jsonData: null
      },
      deployment: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null,
        jsonData: null
      },
      simulations: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null,
        jsonData: null
      },
      // Legacy steps
      workspace: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null 
      },
      abi: { 
        status: "pending" as "pending" | "in_progress" | "completed" | "failed", 
        details: null, 
        startTime: null 
      }
    };
    
    try {
      // Get project summary data for the files step
      const projectSummaryData = await fetchFromExternalApi('project_summary', submissionId);
      if (projectSummaryData && projectSummaryData.project_summary) {
        // Parse the JSON string in the response
        try {
          const parsedProjectSummary = JSON.parse(projectSummaryData.project_summary);
          
          // Transform data to match UI expectations, but only include what's available
          const transformedProjectData: Record<string, any> = {};
          
          // Include only fields that are present in the API response
          if (parsedProjectSummary.name) transformedProjectData.projectName = parsedProjectSummary.name;
          if (parsedProjectSummary.summary) transformedProjectData.projectSummary = parsedProjectSummary.summary;
          if (parsedProjectSummary.dev_tool) transformedProjectData.devEnvironment = parsedProjectSummary.dev_tool;
          if (parsedProjectSummary.contracts) transformedProjectData.contracts = parsedProjectSummary.contracts;
          if (parsedProjectSummary.type) transformedProjectData.type = parsedProjectSummary.type;
          
          // Pass the original data as a fallback for UI components to extract whatever they need
          transformedProjectData._original = parsedProjectSummary;
          
          stepsStatus.files = {
            status: "completed",
            details: JSON.stringify(transformedProjectData),
            startTime: externalSubmissionData.completed_steps?.find(s => s.step === "analyze_project")?.updated_at || null,
            jsonData: transformedProjectData
          };
        } catch (parseError) {
          console.error("Error parsing project summary:", parseError);
          stepsStatus.files = {
            status: "completed",
            details: projectSummaryData.project_summary,
            startTime: null,
            jsonData: null
          };
        }
      }
      
      // Get actors summary data for the actors step
      const actorsSummaryData = await fetchFromExternalApi('actors_summary', submissionId);
      if (actorsSummaryData && actorsSummaryData.actors_summary) {
        // Parse the JSON string in the response
        try {
          const parsedActorsSummary = JSON.parse(actorsSummaryData.actors_summary);
          
          // Store the original data for the UI to access as needed
          // The UI will check for the presence of specific fields and render accordingly
          stepsStatus.actors = {
            status: "completed",
            details: JSON.stringify(parsedActorsSummary),
            startTime: externalSubmissionData.completed_steps?.find(s => s.step === "analyze_actors")?.updated_at || null,
            jsonData: parsedActorsSummary
          };
        } catch (parseError) {
          console.error("Error parsing actors summary:", parseError);
          stepsStatus.actors = {
            status: "completed",
            details: actorsSummaryData.actors_summary,
            startTime: null,
            jsonData: null
          };
        }
      }
      
      // Create minimal test setup data only if we have actual data to work with
      if (stepsStatus.files.status === "completed" && stepsStatus.actors.status === "completed") {
        // Extract environment information from project summary if available
        const projectData = stepsStatus.files.jsonData;
        const actorsData = stepsStatus.actors.jsonData;
        
        // Construct test setup with only the data we have from the API
        const testSetupData: Record<string, any> = {};
        
        // Add environment info if available from project data
        if (projectData && projectData.dev_tool) {
          testSetupData.testEnvironment = projectData.dev_tool;
        } else if (projectData && projectData.devEnvironment) {
          testSetupData.testEnvironment = projectData.devEnvironment;
        } else if (projectData && projectData._original && projectData._original.dev_tool) {
          testSetupData.testEnvironment = projectData._original.dev_tool;
        }
        
        // Add basic network settings 
        testSetupData.networkSettings = {
          name: "Local Development Network",
          chainId: "31337"
        };
        
        // Only include actors if actually present in the data
        if (actorsData && actorsData.actors && Array.isArray(actorsData.actors)) {
          testSetupData.actors = actorsData.actors;
        }
        
        // Include minimal substeps
        testSetupData.substeps = [
          {
            id: "setup",
            name: "Setup Test Environment",
            description: "Configure the test environment",
            output: "Test environment configured"
          }
        ];
        
        // Only add the test_setup step if we have some data to show
        stepsStatus.test_setup = {
          status: "completed",
          details: JSON.stringify(testSetupData),
          startTime: new Date().toISOString(),
          jsonData: testSetupData
        };
      }
      
      // Update completed steps based on external API data
      if (externalSubmissionData.completed_steps) {
        for (const stepData of externalSubmissionData.completed_steps) {
          // Map external API step names to our internal step names
          let stepName = stepData.step;
          if (stepName === 'analyze_project') stepName = 'files';
          if (stepName === 'analyze_actors') stepName = 'actors';
          
          if (stepsStatus[stepName]) {
            stepsStatus[stepName].status = "completed";
          }
        }
      }
      
      // Set current step to in_progress if it exists
      if (externalSubmissionData.step) {
        let currentStep = externalSubmissionData.step;
        if (currentStep === 'analyze_project') currentStep = 'files';
        if (currentStep === 'analyze_actors') currentStep = 'actors';
        
        if (stepsStatus[currentStep]) {
          stepsStatus[currentStep].status = "in_progress";
        }
      }
      
      return { 
        status: externalSubmissionData.status || "in_progress", 
        steps: stepsStatus 
      };
    } catch (error) {
      console.error("Error processing test submission:", error);
      return { error: "Error processing test submission" };
    }
  }

  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const requestedId = req.params.id;
      console.log(`Analysis requested for ID: ${requestedId}`);
      
      // Special case for test submission ID
      if (requestedId === 'test-submission-id') {
        const testResult = await getTestSubmissionAnalysis(requestedId);
        if (testResult.error) {
          return res.status(404).send(testResult.error);
        }
        return res.json(testResult);
      }
      
      // Convert project ID to submission ID if needed
      let uuidSubmissionId = null;
      
      // Check if this is a numeric ID (project ID)
      if (/^\d+$/.test(requestedId)) {
        console.log(`${requestedId} appears to be a project ID, finding corresponding submission...`);
        // Get the latest submission for this project
        const projectSubmissions = await db
          .select()
          .from(submissions)
          .where(eq(submissions.projectId, parseInt(requestedId)))
          .orderBy(submissions.createdAt, "desc")
          .limit(1);
          
        if (projectSubmissions.length > 0) {
          uuidSubmissionId = projectSubmissions[0].id;
          console.log(`Found submission ID ${uuidSubmissionId} for project ID ${requestedId}`);
        }
      } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId)) {
        // It's already a UUID format, use it directly
        uuidSubmissionId = requestedId;
        console.log(`Using UUID submission ID directly: ${uuidSubmissionId}`);
      }
      
      // If we have a valid UUID submission ID, try the external API
      let externalSubmissionData = null;
      if (uuidSubmissionId) {
        console.log(`Fetching from external API with submission ID: ${uuidSubmissionId}`);
        externalSubmissionData = await fetchFromExternalApi('submission', uuidSubmissionId);
      }
      
      // Get the submission from our database
      let submission = [];
      
      // If we have a UUID, try that first
      if (uuidSubmissionId) {
        submission = await db
          .select()
          .from(submissions)
          .where(eq(submissions.id, uuidSubmissionId))
          .limit(1);
      }
      
      // If not found and it's a numeric ID, try by project ID
      if (!submission.length && /^\d+$/.test(requestedId)) {
        submission = await db
          .select()
          .from(submissions)
          .where(eq(submissions.projectId, parseInt(requestedId)))
          .orderBy(submissions.createdAt, "desc")
          .limit(1);
      }

      if (!submission.length) {
        console.log(`No submission found for ID: ${requestedId}`);
        return res.status(404).send("Submission not found");
      }
      
      console.log(`Found submission in database:`, submission[0].id);
      
      // Use the external API data if we have it
      if (uuidSubmissionId) {
        try {
          // Try to fetch from external API using the correct UUID
          console.log(`Trying to fetch data from external API for submission ${uuidSubmissionId}`);
          const projectSummaryData = await fetchFromExternalApi('project_summary', uuidSubmissionId);
          const actorsSummaryData = await fetchFromExternalApi('actors_summary', uuidSubmissionId);
          
          // If we got external data, let's use it to update our database
          if (projectSummaryData) {
            console.log(`Successfully fetched project_summary data from external API, updating database...`);
            // Update analysis steps with the data we got
            await db
              .insert(analysisSteps)
              .values({
                submissionId: submission[0].id,
                stepId: 'files',
                status: 'completed',
                details: 'Completed via external API',
                jsonData: projectSummaryData,
              })
              .onConflictDoUpdate({
                target: [analysisSteps.submissionId, analysisSteps.stepId],
                set: {
                  status: 'completed',
                  details: 'Updated via external API',
                  jsonData: projectSummaryData,
                }
              });
          }
          
          if (actorsSummaryData) {
            console.log(`Successfully fetched actors_summary data from external API, updating database...`);
            // Update analysis steps with the data we got
            await db
              .insert(analysisSteps)
              .values({
                submissionId: submission[0].id,
                stepId: 'actors',
                status: 'completed',
                details: 'Completed via external API',
                jsonData: actorsSummaryData,
              })
              .onConflictDoUpdate({
                target: [analysisSteps.submissionId, analysisSteps.stepId],
                set: {
                  status: 'completed',
                  details: 'Updated via external API',
                  jsonData: actorsSummaryData,
                }
              });
          }
        } catch (error) {
          console.error(`Error fetching or updating data from external API:`, error);
        }
      }
      
      // Get all steps for this submission from database
      let steps = await db
        .select()
        .from(analysisSteps)
        .where(eq(analysisSteps.submissionId, submission[0].id))
        .orderBy(analysisSteps.createdAt);

      // Dynamically determine project type based on the actual project ID
      // Get the real project information
      const [actualProject] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, submission[0].projectId))
        .limit(1);

      // Use the project name to determine the project type
      const projectName = actualProject?.name || '';
      const isStableBaseProject = projectName.toLowerCase().includes('stablebase');

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
                        "summary": "Resolves a given market with provided resolution data to determine the winning outcome.",
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
                    "output": "Contracts deployment configured:\n\n```javascript\nasync function deployStableBase() {\n  // Deploy mock tokens for collateral\n  const MockWETH = await ethers.getContractFactory(\"MockWETH\");\n  const mockWETH = await MockWETH.deploy();\n  await mockWETH.deployed();\n  \n  const MockWBTC = await ethers.getContractFactory(\"MockWBTC\");\n  const mockWBTC = await MockWBTC.deploy();\n  await mockWBTC.deployed();\n  \n  // Deploy oracle for price feeds\n  const Oracle = await ethers.getContractFactory(\"Oracle\");\n  const oracle = await Oracle.deploy();\n  await oracle.deployed();\n  \n  // Set initial prices\n  await oracle.setPrice(mockWETH.address, ethers.utils.parseUnits(\"2000\", 8));\n  await oracle.setPrice(mockWBTC.address, ethers.utils.parseUnits(\"30000\", 8));\n  \n  // Deploy main StableBase contract\n  const StableBase = await ethers.getContractFactory(\"StableBase\");\n  const stableBase = await StableBase.deploy(oracle.address);\n  await stableBase.deployed();\n  \n  // Deploy StabilityPool\n  const StabilityPool = await ethers.getContractFactory(\"StabilityPool\");\n  const stabilityPool = await StabilityPool.deploy(stableBase.address);\n  await stabilityPool.deployed();\n  \n  // Configure StableBase with StabilityPool\n  await stableBase.setStabilityPool(stabilityPool.address);\n  \n  // Register collateral tokens\n  await stableBase.addCollateralToken(mockWETH.address, 150); // 150% collateralization ratio\n  await stableBase.addCollateralToken(mockWBTC.address, 130); // 130% collateralization ratio\n  \n  return {\n    stableBase,\n    stabilityPool,\n    oracle,\n    mockWETH,\n    mockWBTC\n  };\n}\n```"
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
                    "output": "Actor implementations complete:\n\n```javascript\nasync function setupActors(contracts) {\n  const [marketCreator, bettor1, bettor2, resolver, tokenManager] = await ethers.getSigners();\n  \n  // Distribute tokens to actors\n  await contracts.mockUSDC.connect(tokenManager).mint(bettor1.address, ethers.utils.parseUnits(\"10000\", 6));\n  await contracts.mockUSDC.connect(tokenManager).mint(bettor2.address, ethers.utils.parseUnits(\"10000\", 6));\n  await contracts.mockDAI.connect(tokenManager).mint(bettor1.address, ethers.utils.parseEther(\"10000\"));\n  await contracts.mockDAI.connect(tokenManager).mint(bettor2.address, ethers.utils.parseEther(\"10000\"));\n  \n  // Approvals\n  await contracts.mockUSDC.connect(bettor1).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockUSDC.connect(bettor2).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockDAI.connect(bettor1).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  await contracts.mockDAI.connect(bettor2).approve(contracts.predify.address, ethers.constants.MaxUint256);\n  \n  // Grant resolver role\n  await contracts.manualResolutionStrategy.grantRole(await contracts.manualResolutionStrategy.RESOLVER_ROLE(), resolver.address);\n  \n  // Define actor actions\n  const actors = {\n    marketCreator: {\n      signer: marketCreator,\n      createMarket: async (description, outcomes, token, resolutionStrategyAddress) => {\n        return contracts.predify.connect(marketCreator).createMarket(\n          description,\n          outcomes,\n          token,\n          resolutionStrategyAddress || contracts.manualResolutionStrategy.address\n        );\n      }\n    },\n    bettor1: {\n      signer: bettor1,\n      placeBet: async (marketId, outcomeIndex, amount, token) => {\n        return contracts.predify.connect(bettor1).predict(\n          marketId,\n          outcomeIndex,\n          token === contracts.mockUSDC.address ? \n            ethers.utils.parseUnits(amount.toString(), 6) : \n            ethers.utils.parseEther(amount.toString()),\n          token\n        );\n      },\n      claimWinnings: async (marketId) => {\n        return contracts.predify.connect(bettor1).claim(marketId);\n      },\n      withdrawBet: async (marketId) => {\n        return contracts.predify.connect(bettor1).withdrawBet(marketId);\n      }\n    },\n    bettor2: {\n      signer: bettor2,\n      placeBet: async (marketId, outcomeIndex, amount, token) => {\n        return contracts.predify.connect(bettor2).predict(\n          marketId,\n          outcomeIndex,\n          token === contracts.mockUSDC.address ? \n            ethers.utils.parseUnits(amount.toString(), 6) : \n            ethers.utils.parseEther(amount.toString()),\n          token\n        );\n      },\n      claimWinnings: async (marketId) => {\n        return contracts.predify.connect(bettor2).claim(marketId);\n      },\n      withdrawBet: async (marketId) => {\n        return contracts.predify.connect(bettor2).withdrawBet(marketId);\n      }\n    },\n    resolver: {\n      signer: resolver,\n      resolveMarket: async (marketId, winningOutcomeIndex) => {\n        return contracts.predify.connect(resolver).resolveMarket(marketId, winningOutcomeIndex);\n      },\n      manualResolve: async (marketId, winningOutcomeIndex) => {\n        return contracts.manualResolutionStrategy.connect(resolver).resolve(marketId, winningOutcomeIndex);\n      }\n    },\n    tokenManager: {\n      signer: tokenManager,\n      mintTokens: async (token, to, amount) => {\n        const decimals = token === contracts.mockUSDC.address ? 6 : 18;\n        return token === contracts.mockUSDC.address ?\n          contracts.mockUSDC.connect(tokenManager).mint(to, ethers.utils.parseUnits(amount.toString(), decimals)) :\n          contracts.mockDAI.connect(tokenManager).mint(to, ethers.utils.parseUnits(amount.toString(), decimals));\n      }\n    }\n  };\n  \n  return actors;\n}\n```\n\nChat interface ready for adjusting market parameters and actor behaviors."
                  }
                ]
              }
        },
        deployment: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: isStableBaseProject 
            ? {
                "title": "Deployment Instructions",
                "description": "Transaction sequence for local network setup",
                "deploymentSteps": [
                  {
                    "name": "Deploy Token Contract",
                    "params": {
                      "constructor": "\"Stablebase Token\", \"SBT\", 18 (decimals)"
                    },
                    "gas": "~2,500,000",
                    "tx": "TokenOwner deploys Token.sol",
                    "result": "Token contract deployed at 0xToken"
                  },
                  {
                    "name": "Deploy Staking Contract",
                    "params": {
                      "constructor": "Token address (0xToken)"
                    },
                    "gas": "~3,200,000",
                    "tx": "TokenOwner deploys Staking.sol with Token address",
                    "result": "Staking contract deployed at 0xStaking"
                  },
                  {
                    "name": "Deploy StabilityPool Contract",
                    "params": {
                      "constructor": "Token address (0xToken), Fee rate (0.3%)"
                    },
                    "gas": "~4,100,000",
                    "tx": "TokenOwner deploys StabilityPool.sol with Token address",
                    "result": "StabilityPool contract deployed at 0xPool"
                  },
                  {
                    "name": "Configure Token Permissions",
                    "params": {},
                    "gas": "~50,000",
                    "tx": "TokenOwner calls token.setMinter(0xPool, true)",
                    "result": "StabilityPool can now mint reward tokens"
                  },
                  {
                    "name": "Initialize Staking Parameters",
                    "params": {},
                    "gas": "~45,000",
                    "tx": "TokenOwner calls staking.setRewardRate(100)",
                    "result": "Staking rewards configured at 100 tokens per block"
                  },
                  {
                    "name": "Setup Initial Liquidity",
                    "params": {},
                    "gas": "~250,000",
                    "tx": "TokenOwner mints 1,000,000 tokens and adds liquidity to the pool",
                    "result": "Initial liquidity established with 500,000 tokens and 100 ETH"
                  }
                ],
                "networkRecommendations": [
                  {
                    "name": "Ethereum Mainnet",
                    "description": "For production deployment",
                    "gas": "High gas fees, but strong security"
                  },
                  {
                    "name": "Polygon",
                    "description": "For lower gas fees and faster transactions",
                    "gas": "Lower fees than Ethereum mainnet"
                  },
                  {
                    "name": "Arbitrum/Optimism",
                    "description": "For Layer 2 scaling benefits",
                    "gas": "Reduced gas costs with Ethereum security"
                  }
                ]
              }
            : {
                "title": "Deployment Instructions",
                "description": "Transaction sequence for local network setup",
                "deploymentSteps": [
                  {
                    "name": "Deploy Token Contract",
                    "params": {
                      "constructor": "\"Prediction Token\", \"PRT\", 18 (decimals)"
                    },
                    "gas": "~2,500,000",
                    "tx": "TokenOwner deploys MockERC20.sol",
                    "result": "Token contract deployed at 0xToken"
                  },
                  {
                    "name": "Deploy Resolution Strategy Contract",
                    "params": {
                      "constructor": "No parameters"
                    },
                    "gas": "~1,800,000",
                    "tx": "Admin deploys ManualResolutionStrategy.sol",
                    "result": "Strategy contract deployed at 0xStrategy"
                  },
                  {
                    "name": "Deploy Predify Contract",
                    "params": {
                      "constructor": "No parameters"
                    },
                    "gas": "~3,200,000",
                    "tx": "Admin deploys Predify.sol",
                    "result": "Predify contract deployed at 0xPredify"
                  },
                  {
                    "name": "Register Resolution Strategy",
                    "params": {},
                    "gas": "~50,000",
                    "tx": "Admin calls predify.addResolutionStrategy(0xStrategy)",
                    "result": "Manual resolution strategy registered with Predify"
                  },
                  {
                    "name": "Register Token",
                    "params": {},
                    "gas": "~45,000",
                    "tx": "Admin calls predify.addSupportedToken(0xToken)",
                    "result": "Token can now be used for betting in markets"
                  },
                  {
                    "name": "Setup Test Markets",
                    "params": {},
                    "gas": "~150,000 per market",
                    "tx": "Admin creates test markets with various parameters",
                    "result": "Initial markets created and ready for betting"
                  }
                ],
                "networkRecommendations": [
                  {
                    "name": "Ethereum Mainnet",
                    "description": "For production deployment",
                    "gas": "High gas fees, but strong security"
                  },
                  {
                    "name": "Polygon",
                    "description": "For lower gas fees and faster transactions",
                    "gas": "Lower fees than Ethereum mainnet"
                  },
                  {
                    "name": "Arbitrum/Optimism",
                    "description": "For Layer 2 scaling benefits",
                    "gas": "Reduced gas costs with Ethereum security"
                  }
                ]
              }
        },
        simulations: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: isStableBaseProject 
            ? {
                "summary": {
                  "totalTests": 28,
                  "passed": 24,
                  "failed": 4,
                  "warnings": 3,
                  "duration": "22.1s",
                  "coverage": "92%",
                  "securityScore": 72
                },
                "testResults": [
                  {
                    "name": "Stablecoin Minting Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "User can mint stablecoins with valid collateral",
                        "status": "passed",
                        "gas": 285234
                      },
                      {
                        "description": "Cannot mint with insufficient collateral ratio",
                        "status": "passed",
                        "gas": 49876
                      },
                      {
                        "description": "Multiple collateral types are handled correctly",
                        "status": "passed",
                        "gas": 342567
                      }
                    ]
                  },
                  {
                    "name": "Stablecoin Redemption Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "User can redeem stablecoins for collateral",
                        "status": "passed",
                        "gas": 201543
                      },
                      {
                        "description": "Redemption fee is calculated correctly",
                        "status": "passed",
                        "gas": 154678
                      },
                      {
                        "description": "Redemption prioritizes lowest collateral ratio positions",
                        "status": "passed",
                        "gas": 378921
                      }
                    ]
                  },
                  {
                    "name": "Stability Pool Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "Users can deposit stablecoins to stability pool",
                        "status": "passed",
                        "gas": 187432
                      },
                      {
                        "description": "Users can withdraw stablecoins from stability pool",
                        "status": "passed",
                        "gas": 165298
                      },
                      {
                        "description": "Rewards are distributed correctly",
                        "status": "passed",
                        "gas": 254389
                      }
                    ]
                  },
                  {
                    "name": "Liquidation Tests",
                    "status": "failed",
                    "tests": [
                      {
                        "description": "Undercollateralized positions can be liquidated",
                        "status": "passed",
                        "gas": 312765
                      },
                      {
                        "description": "Stability pool absorbs liquidated debt correctly",
                        "status": "passed",
                        "gas": 387654
                      },
                      {
                        "description": "Cannot liquidate healthy positions",
                        "status": "passed",
                        "gas": 52341
                      },
                      {
                        "description": "Liquidation during extreme price volatility",
                        "status": "failed",
                        "reason": "Vulnerability detected: Oracle price updates not processed fast enough during extreme volatility"
                      }
                    ]
                  },
                  {
                    "name": "Oracle Integration Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "Price feeds are updated correctly",
                        "status": "passed",
                        "gas": 145632
                      },
                      {
                        "description": "System handles price feed timeout",
                        "status": "passed",
                        "gas": 98765
                      }
                    ]
                  },
                  {
                    "name": "Security Tests",
                    "status": "failed",
                    "tests": [
                      {
                        "description": "Reentrancy protection works correctly",
                        "status": "passed",
                        "gas": 65432
                      },
                      {
                        "description": "Access controls prevent unauthorized actions",
                        "status": "passed",
                        "gas": 48321
                      },
                      {
                        "description": "System is protected against flash loan attacks",
                        "status": "failed",
                        "reason": "Vulnerability detected: Potential price manipulation through flash loans during liquidation"
                      },
                      {
                        "description": "Integer overflow/underflow protections",
                        "status": "passed",
                        "gas": 54321
                      },
                      {
                        "description": "Oracle manipulation resistance",
                        "status": "failed",
                        "reason": "Vulnerability detected: Single oracle dependency creates a central point of failure"
                      }
                    ]
                  }
                ],
                "vulnerabilities": [
                  {
                    "severity": "high",
                    "description": "Flash loan attack vulnerability",
                    "details": "The protocol is vulnerable to price manipulation attacks using flash loans during liquidation events.",
                    "recommendation": "Implement time-weighted average prices and use multiple oracles",
                    "affected": "StableBase.sol (liquidate function)"
                  },
                  {
                    "severity": "high",
                    "description": "Oracle dependency risk",
                    "details": "The system relies on a single price oracle for critical operations, creating a central point of failure.",
                    "recommendation": "Implement a multi-oracle system with median price selection",
                    "affected": "Oracle.sol"
                  },
                  {
                    "severity": "medium",
                    "description": "Liquidation efficiency during high volatility",
                    "details": "During extreme price volatility, liquidations may not process quickly enough, potentially leaving the system undercollateralized.",
                    "recommendation": "Implement gradual liquidation and dynamic fee adjustment",
                    "affected": "StableBase.sol (liquidate function)"
                  },
                  {
                    "severity": "low",
                    "description": "Precision loss in reward calculations",
                    "details": "Small rounding errors in reward calculations can accumulate over time.",
                    "recommendation": "Implement higher precision mathematics and distribution checks",
                    "affected": "StabilityPool.sol (multiple functions)"
                  }
                ],
                "recommendations": [
                  "Implement a multi-oracle system with median price selection",
                  "Add time-weighted average price mechanism for liquidations",
                  "Introduce dynamic liquidation thresholds based on market volatility",
                  "Enhance reward distribution precision",
                  "Add emergency shutdown capability with governance oversight",
                  "Implement gradual liquidation mechanism for large positions"
                ]
              }
            : {
                "summary": {
                  "totalTests": 22,
                  "passed": 19,
                  "failed": 3,
                  "warnings": 4,
                  "duration": "18.6s",
                  "coverage": "87%",
                  "securityScore": 78
                },
                "testResults": [
                  {
                    "name": "Market Creation Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "Creator can create market with valid parameters",
                        "status": "passed",
                        "gas": 248653
                      },
                      {
                        "description": "Cannot create market with invalid resolution strategy",
                        "status": "passed",
                        "gas": 51203
                      },
                      {
                        "description": "Cannot create market with past resolution date",
                        "status": "passed",
                        "gas": 50122
                      }
                    ]
                  },
                  {
                    "name": "Betting Mechanics Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "Bettor can place bet on existing market",
                        "status": "passed",
                        "gas": 187631
                      },
                      {
                        "description": "Bettor can withdraw bet before market closes",
                        "status": "passed",
                        "gas": 156284
                      },
                      {
                        "description": "Cannot place bet on non-existent outcome",
                        "status": "passed",
                        "gas": 42105
                      },
                      {
                        "description": "Cannot place bet after market closes",
                        "status": "passed",
                        "gas": 45367
                      }
                    ]
                  },
                  {
                    "name": "Market Resolution Tests",
                    "status": "passed",
                    "tests": [
                      {
                        "description": "Resolver can resolve market correctly",
                        "status": "passed",
                        "gas": 198752
                      },
                      {
                        "description": "Winners can claim rewards after resolution",
                        "status": "passed",
                        "gas": 172635
                      }
                    ]
                  },
                  {
                    "name": "Security Tests",
                    "status": "failed",
                    "tests": [
                      {
                        "description": "Market cannot be resolved twice",
                        "status": "passed",
                        "gas": 48305
                      },
                      {
                        "description": "Non-resolver cannot resolve market",
                        "status": "passed",
                        "gas": 40182
                      },
                      {
                        "description": "Cannot manipulate market through flash loans",
                        "status": "failed",
                        "reason": "Vulnerability detected: Price manipulation possible through flash loans without slippage protection"
                      },
                      {
                        "description": "Cannot create market with malicious outcome data",
                        "status": "failed",
                        "reason": "Vulnerability detected: Input validation is incomplete for outcome descriptions"
                      }
                    ]
                  }
                ],
                "vulnerabilities": [
                  {
                    "severity": "high",
                    "description": "Flash loan attack vulnerability",
                    "details": "The prediction market contract lacks slippage protection, making it vulnerable to price manipulation attacks using flash loans.",
                    "recommendation": "Implement slippage protection and price oracle integration",
                    "affected": "Predify.sol (predict function)"
                  },
                  {
                    "severity": "medium",
                    "description": "Input validation vulnerability",
                    "details": "Insufficient validation of market outcome descriptions could allow injection of malicious data.",
                    "recommendation": "Add strict validation for all user inputs",
                    "affected": "Predify.sol (createMarket function)"
                  },
                  {
                    "severity": "low",
                    "description": "Timestamp dependency",
                    "details": "The contract relies on block.timestamp for time-sensitive operations which can be manipulated by miners within a small window.",
                    "recommendation": "Consider using block numbers with estimated time or external time oracle",
                    "affected": "Predify.sol (multiple functions)"
                  }
                ],
                "recommendations": [
                  "Implement price oracle integration to prevent flash loan attacks",
                  "Add comprehensive input validation for all user-provided data",
                  "Consider using OpenZeppelin's ReentrancyGuard for all external functions",
                  "Add emergency pause functionality for critical situations",
                  "Implement a time buffer for market resolution to prevent front-running"
                ]
              }
        },
        // Legacy step IDs (for backwards compatibility)
        workspace: { status: "pending", details: null, startTime: null },
        abi: { status: "pending", details: null, startTime: null }
      };

      // Set up our steps status with the sample data
      const stepsStatus: Record<string, AnalysisStepStatus> = { ...sampleData };

      // Check if we have external API data first
      if (externalSubmissionData) {
        console.log("Using external API data for submission:", submissionId);
        
        // Fetch additional data from external API as needed
        try {
          // Get project summary data
          const projectSummaryData = await fetchFromExternalApi('project_summary', submissionId);
          if (projectSummaryData) {
            stepsStatus.files = {
              status: "completed",
              details: null,
              startTime: null,
              jsonData: projectSummaryData
            };
          }
          
          // Get actors summary data
          const actorsSummaryData = await fetchFromExternalApi('actors_summary', submissionId);
          if (actorsSummaryData) {
            stepsStatus.actors = {
              status: "completed",
              details: null,
              startTime: null,
              jsonData: actorsSummaryData
            };
          }
          
          // Get test environment data if needed
          if (externalSubmissionData.test_environment_configured) {
            const testSetupData = await fetchFromExternalApi('test_environment', submissionId);
            if (testSetupData) {
              stepsStatus.test_setup = {
                status: "completed",
                details: null,
                startTime: null,
                jsonData: testSetupData
              };
            }
          }
          
          // Update step status based on external API data
          if (externalSubmissionData.completed_steps) {
            for (const step of externalSubmissionData.completed_steps) {
              if (stepsStatus[step]) {
                stepsStatus[step].status = "completed";
              }
            }
          }
          
          if (externalSubmissionData.in_progress_steps) {
            for (const step of externalSubmissionData.in_progress_steps) {
              if (stepsStatus[step]) {
                stepsStatus[step].status = "in_progress";
              }
            }
          }
          
          // Override with the overall status from external API if available
          const status = externalSubmissionData.status || "completed";
          return res.json({ status, steps: stepsStatus });
          
        } catch (error) {
          console.error("Error fetching additional data from external API:", error);
          // Continue with database data as fallback
        }
      }
      
      // Check if there are any database entries for this submission
      if (steps.length > 0) {
        console.log("Using database entries for submission:", submissionId);
        
        // Update our step data with anything that exists in the database
        steps.forEach(step => {
          if (stepsStatus[step.stepId]) {
            // If the step exists in the database, override our sample data
            stepsStatus[step.stepId] = {
              status: step.status,
              details: step.details,
              startTime: step.status === 'in_progress' ? step.createdAt.toISOString() : null,
              // Keep the jsonData from our sample if there's none in the database
              jsonData: step.json_data || stepsStatus[step.stepId].jsonData
            };
          }
        });

        // Special handling for files step
        // If files step is "in_progress", fetch from the projectFiles table
        if (stepsStatus.files.status === "in_progress") {
          try {
            // Try to fetch from projectFiles table
            // We need to handle both UUID and project ID format cases
            let actualSubmissionId = submissionId;

            // If this is a project ID (number), we need to get the actual submission ID
            if (/^\d+$/.test(submissionId)) {
              // Find the submission associated with this project ID
              const projectSubmission = await db
                .select()
                .from(submissions)
                .where(eq(submissions.projectId, parseInt(submissionId)))
                .orderBy(submissions.createdAt, "desc")
                .limit(1);
                
              if (projectSubmission.length > 0) {
                actualSubmissionId = projectSubmission[0].id;
              } else {
                console.warn(`No submission found for project ID: ${submissionId}`);
                // If there is sample data, use it
                if (sampleData?.files?.jsonData) {
                  stepsStatus.files.jsonData = sampleData.files.jsonData;
                  return;
                }
              }
            }

            const projectFilesData = await db
              .select()
              .from(projectFiles)
              .where(eq(projectFiles.submissionId, actualSubmissionId))
              .limit(1);
            
            if (projectFilesData.length > 0) {
              // Use data from projectFiles table
              stepsStatus.files.jsonData = {
                projectName: projectFilesData[0].projectName,
                projectSummary: projectFilesData[0].projectSummary,
                devEnvironment: projectFilesData[0].devEnvironment,
                compiler: projectFilesData[0].compiler,
                contracts: projectFilesData[0].contracts,
                dependencies: projectFilesData[0].dependencies
              };
            } else if (sampleData.files.jsonData) {
              // Fallback to sample data if needed
              stepsStatus.files.jsonData = sampleData.files.jsonData;
            }
          } catch (error) {
            console.error("Error fetching project files data:", error);
            // Use sample data as fallback
            if (sampleData.files.jsonData) {
              stepsStatus.files.jsonData = sampleData.files.jsonData;
            }
          }
        }

        const hasInProgressStep = steps.some(step => step.status === "in_progress");
        const status = hasInProgressStep ? "in_progress" : "completed";
        
        res.json({ status, steps: stepsStatus });
      } else {
        console.log("No database entries found, using sample data for submission:", submissionId);
        
        // If no actual steps at all, use our sample data with all steps marked completed
        stepsStatus.files.status = "completed";
        stepsStatus.actors.status = "completed";
        stepsStatus.test_setup.status = "completed";
        stepsStatus.simulations.status = "completed";
        
        // Send the response with sample data
        res.json({ status: "completed", steps: stepsStatus });
      }
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

  // Team Management Endpoints
  
  // Check if user can create a team (Teams plan only)
  app.get("/api/can-create-team", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ 
      canCreate: false,
      message: "You must be logged in"
    });
    
    if (req.user.plan !== 'teams') {
      return res.json({
        canCreate: false,
        message: "Team creation is only available for Teams plan subscribers"
      });
    }
    
    return res.json({
      canCreate: true,
      message: "You can create and manage teams"
    });
  });
  
  // Get all teams for the current user
  app.get("/api/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Get teams created by the user (non-deleted only)
      const createdTeams = await db
        .select()
        .from(teams)
        .where(eq(teams.createdBy, req.user.id))
        .where(eq(teams.isDeleted, false));
      
      // Get teams the user is a member of
      const memberTeams = await db
        .select({
          team: teams,
          role: teamMembers.role,
          status: teamMembers.status
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, req.user.id))
        .where(eq(teams.isDeleted, false));
      
      // Combine and format the results
      const allTeams = [
        ...createdTeams.map(team => ({
          ...team,
          role: 'admin',
          status: 'active',
          isCreator: true
        })),
        ...memberTeams
          .filter(mt => !createdTeams.find(ct => ct.id === mt.team.id))
          .map(mt => ({
            ...mt.team,
            role: mt.role,
            status: mt.status,
            isCreator: false
          }))
      ];
      
      return res.json(allTeams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch teams" 
      });
    }
  });
  
  // Create a new team
  app.post("/api/teams", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    if (req.user.plan !== 'teams') {
      return res.status(403).json({
        success: false,
        message: "Team creation is only available for Teams plan subscribers"
      });
    }
    
    try {
      const { name, description } = req.body;
      
      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: "Team name is required"
        });
      }
      
      // Create the team
      const [newTeam] = await db.insert(teams)
        .values({
          name,
          description: description || null,
          createdBy: req.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      return res.status(201).json({
        success: true,
        team: newTeam
      });
    } catch (error) {
      console.error("Error creating team:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to create team" 
      });
    }
  });
  
  // Get team details including members
  app.get("/api/teams/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.id);
      
      // Get team details (non-deleted only)
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .where(eq(teams.isDeleted, false))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Check if user is a member or creator of the team
      const isCreator = team.createdBy === req.user.id;
      
      if (!isCreator) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, req.user.id))
          .limit(1);
          
        if (!membership || membership.status !== 'active') {
          return res.status(403).json({
            success: false,
            message: "You don't have access to this team"
          });
        }
      }
      
      // Get team members
      const members = await db
        .select({
          id: teamMembers.userId,
          role: teamMembers.role,
          status: teamMembers.status,
          joinedAt: teamMembers.joinedAt,
          invitedBy: teamMembers.invitedBy,
          // Join user data
          name: users.name,
          email: users.email
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, teamId));
      
      // Get team projects (non-deleted only)
      const teamProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.teamId, teamId)) // Only get projects for this team
        .where(eq(projects.isDeleted, false))
        .orderBy(projects.createdAt);
      
      // Get pending invitations
      const pendingInvitations = await db
        .select({
          id: teamInvitations.id,
          email: teamInvitations.email,
          invitedAt: teamInvitations.invitedAt,
          status: teamInvitations.status,
          expiresAt: teamInvitations.expiresAt,
          // Include inviter name
          inviterName: users.name,
          inviterEmail: users.email
        })
        .from(teamInvitations)
        .innerJoin(users, eq(teamInvitations.invitedBy, users.id))
        .where(eq(teamInvitations.teamId, teamId))
        .where(eq(teamInvitations.status, 'pending'));
      
      return res.json({
        ...team,
        isCreator,
        userRole: isCreator ? 'admin' : members.find(m => m.id === req.user.id)?.role || 'member',
        members,
        projects: teamProjects,
        pendingInvitations
      });
    } catch (error) {
      console.error("Error fetching team details:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch team details" 
      });
    }
  });
  
  // Update team details
  app.patch("/api/teams/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.id);
      const { name, description } = req.body;
      
      // Get team to check permissions
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .where(eq(teams.isDeleted, false))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Check if user is the team creator or an admin
      const isCreator = team.createdBy === req.user.id;
      
      if (!isCreator) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, req.user.id))
          .limit(1);
          
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: "Only team admins can update team details"
          });
        }
      }
      
      // Update team
      const [updatedTeam] = await db
        .update(teams)
        .set({
          name: name || team.name,
          description: description !== undefined ? description : team.description,
          updatedAt: new Date()
        })
        .where(eq(teams.id, teamId))
        .returning();
      
      return res.json({
        success: true,
        team: updatedTeam
      });
    } catch (error) {
      console.error("Error updating team:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to update team" 
      });
    }
  });
  
  // Delete a team
  app.delete("/api/teams/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.id);
      
      // Get team to check permissions
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .where(eq(teams.isDeleted, false))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Only team creator can delete a team
      if (team.createdBy !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Only the team creator can delete the team"
        });
      }
      
      // Soft delete the team in a transaction
      await db.transaction(async (tx) => {
        // Mark the team as deleted instead of hard deleting
        await tx
          .update(teams)
          .set({ isDeleted: true })
          .where(eq(teams.id, teamId));
        
        // Remove team association from projects
        await tx
          .update(projects)
          .set({ teamId: null })
          .where(eq(projects.teamId, teamId));
        
        // Keep team members and invitations for potential restoration
      });
      
      return res.json({
        success: true,
        message: "Team deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting team:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to delete team" 
      });
    }
  });
  
  // Invite a user to a team
  app.post("/api/teams/:id/invite", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.id);
      const { email, role = 'member' } = req.body;
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Valid email address is required"
        });
      }
      
      // Get team to check permissions
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Check if user is the team creator or an admin
      const isCreator = team.createdBy === req.user.id;
      
      if (!isCreator) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, req.user.id))
          .limit(1);
          
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: "Only team admins can send invitations"
          });
        }
      }
      
      // Check if the email is already a team member
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      if (existingUser) {
        const [existingMember] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, existingUser.id))
          .limit(1);
        
        if (existingMember) {
          return res.status(400).json({
            success: false,
            message: "This user is already a member of the team"
          });
        }
        
        // User exists but is not a member, add them directly
        const [newMember] = await db
          .insert(teamMembers)
          .values({
            teamId,
            userId: existingUser.id,
            role,
            status: 'invited',
            joinedAt: new Date(),
            invitedBy: req.user.id
          })
          .returning();
        
        // TODO: Send email notification to user
        
        return res.status(201).json({
          success: true,
          message: "User invited to the team",
          member: {
            ...newMember,
            name: existingUser.name,
            email: existingUser.email
          }
        });
      }
      
      // Email doesn't belong to an existing user, create invitation
      // Generate a unique token for the invitation
      const token = Buffer.from(Math.random().toString(36).substring(2) + Date.now().toString(36)).toString('base64');
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      // Create the invitation
      const [invitation] = await db
        .insert(teamInvitations)
        .values({
          teamId,
          email,
          invitedBy: req.user.id,
          invitedAt: new Date(),
          status: 'pending',
          expiresAt,
          token
        })
        .returning();
      
      // TODO: Send invitation email
      
      return res.status(201).json({
        success: true,
        message: "Invitation sent",
        invitation: {
          ...invitation,
          inviterName: req.user.name,
          inviterEmail: req.user.email
        }
      });
    } catch (error) {
      console.error("Error inviting user:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to send invitation" 
      });
    }
  });
  
  // Accept an invitation to join a team
  app.post("/api/teams/accept-invitation", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Invitation token is required"
        });
      }
      
      // Find the invitation
      const [invitation] = await db
        .select()
        .from(teamInvitations)
        .where(eq(teamInvitations.token, token))
        .limit(1);
      
      if (!invitation) {
        return res.status(404).json({
          success: false,
          message: "Invalid or expired invitation"
        });
      }
      
      // Check if invitation has expired
      if (invitation.status !== 'pending' || (invitation.expiresAt && new Date(invitation.expiresAt) < new Date())) {
        return res.status(400).json({
          success: false,
          message: "Invitation has expired or already been used"
        });
      }
      
      // Check if the invitation email matches the current user
      if (invitation.email.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: "This invitation was sent to a different email address"
        });
      }
      
      // Add user to the team
      const [teamMembership] = await db
        .insert(teamMembers)
        .values({
          teamId: invitation.teamId,
          userId: req.user.id,
          role: 'member', // Default role for invited members
          status: 'active',
          joinedAt: new Date(),
          invitedBy: invitation.invitedBy
        })
        .returning();
      
      // Mark the invitation as accepted
      await db
        .update(teamInvitations)
        .set({ status: 'accepted' })
        .where(eq(teamInvitations.id, invitation.id));
      
      // Get team details
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, invitation.teamId))
        .where(eq(teams.isDeleted, false))
        .limit(1);
      
      return res.json({
        success: true,
        message: "You have joined the team",
        team,
        membership: teamMembership
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to accept invitation" 
      });
    }
  });
  
  // Remove a member from a team
  app.delete("/api/teams/:teamId/members/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.teamId);
      const userId = parseInt(req.params.userId);
      
      // Get team
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Check permissions - must be team creator, admin, or removing self
      const isCreator = team.createdBy === req.user.id;
      const isSelf = userId === req.user.id;
      
      if (!isCreator && !isSelf) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, req.user.id))
          .limit(1);
          
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: "You don't have permission to remove this member"
          });
        }
      }
      
      // Check if trying to remove the team creator
      if (userId === team.createdBy && !isSelf) {
        return res.status(403).json({
          success: false,
          message: "The team creator cannot be removed from the team"
        });
      }
      
      // Remove the member
      await db
        .delete(teamMembers)
        .where(eq(teamMembers.teamId, teamId))
        .where(eq(teamMembers.userId, userId));
      
      return res.json({
        success: true,
        message: `${isSelf ? "You have" : "Member has"} been removed from the team`
      });
    } catch (error) {
      console.error("Error removing team member:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to remove team member" 
      });
    }
  });
  
  // Update team member role
  app.patch("/api/teams/:teamId/members/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const teamId = parseInt(req.params.teamId);
      const userId = parseInt(req.params.userId);
      const { role } = req.body;
      
      if (!role || !['member', 'admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role. Must be 'member' or 'admin'"
        });
      }
      
      // Get team
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Check permissions - only team creator or admins can update roles
      const isCreator = team.createdBy === req.user.id;
      
      if (!isCreator) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, req.user.id))
          .limit(1);
          
        if (!membership || membership.role !== 'admin') {
          return res.status(403).json({
            success: false,
            message: "Only team admins can update member roles"
          });
        }
      }
      
      // Update the member's role
      const [updatedMember] = await db
        .update(teamMembers)
        .set({ role })
        .where(eq(teamMembers.teamId, teamId))
        .where(eq(teamMembers.userId, userId))
        .returning();
      
      if (!updatedMember) {
        return res.status(404).json({
          success: false,
          message: "Member not found in this team"
        });
      }
      
      return res.json({
        success: true,
        message: "Member role updated",
        member: updatedMember
      });
    } catch (error) {
      console.error("Error updating member role:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to update member role" 
      });
    }
  });
  
  // Update project to assign it to a team
  app.patch("/api/projects/:id/team", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const projectId = parseInt(req.params.id);
      const { teamId } = req.body;
      
      // Get the project
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);
      
      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found"
        });
      }
      
      // Check if user owns the project
      if (project.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You don't have permission to modify this project"
        });
      }
      
      // If removing from team (teamId = null)
      if (teamId === null) {
        const [updatedProject] = await db
          .update(projects)
          .set({ teamId: null })
          .where(eq(projects.id, projectId))
          .returning();
        
        return res.json({
          success: true,
          message: "Project removed from team",
          project: updatedProject
        });
      }
      
      // Verify the team exists and user is a member
      const [team] = await db
        .select()
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      
      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found"
        });
      }
      
      // Check if user is the team creator or a member
      const isCreator = team.createdBy === req.user.id;
      
      if (!isCreator) {
        const [membership] = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.teamId, teamId))
          .where(eq(teamMembers.userId, req.user.id))
          .limit(1);
          
        if (!membership || membership.status !== 'active') {
          return res.status(403).json({
            success: false,
            message: "You must be an active member of the team to add projects to it"
          });
        }
      }
      
      // Update the project
      const [updatedProject] = await db
        .update(projects)
        .set({ teamId })
        .where(eq(projects.id, projectId))
        .returning();
      
      return res.json({
        success: true,
        message: "Project added to team",
        project: updatedProject
      });
    } catch (error) {
      console.error("Error updating project team:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to update project team" 
      });
    }
  });
  
  // Get all projects for the current user, including team projects
  app.get("/api/all-projects", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      // Get user's personal projects (non-team projects, non-deleted only)
      // Only include projects where user is the owner (userId matches)
      const personalProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.userId, req.user.id)) // Only projects owned by the current user
        .where(sql`${projects.teamId} IS NULL`) // Only projects without teamId
        .where(eq(projects.isDeleted, false))
        .orderBy(projects.createdAt);
      
      console.log("Personal projects:", personalProjects.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })));
      
      // Get teams the user belongs to
      const userTeams = await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          role: teamMembers.role
        })
        .from(teamMembers)
        .innerJoin(teams, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, req.user.id))
        .where(eq(teamMembers.status, 'active'));
      
      // Also include teams created by the user
      const createdTeams = await db
        .select({
          teamId: teams.id,
          teamName: teams.name,
          role: sql<string>`'admin'` // Creator is always admin
        })
        .from(teams)
        .where(eq(teams.createdBy, req.user.id))
        .where(eq(teams.isDeleted, false))
        .where(sql`${teams.id} NOT IN (
          SELECT team_id FROM team_members 
          WHERE user_id = ${req.user.id} AND status = 'active'
        )`);
      
      // Combine all team IDs
      const allTeams = [...userTeams, ...createdTeams];
      const teamIds = allTeams.map(t => t.teamId);
      
      // Get projects for all these teams
      let teamProjects = [];
      if (teamIds.length > 0) {
        teamProjects = await db
          .select({
            project: projects,
            teamName: teams.name
          })
          .from(projects)
          .innerJoin(teams, eq(projects.teamId, teams.id))
          .where(sql`${projects.teamId} IN (${teamIds.join(',')})`)
          .where(eq(projects.isDeleted, false)) // Only non-deleted team projects
          .orderBy(teams.name, projects.createdAt);
      }
      
      // Format the response
      const formattedTeamProjects = teamProjects.map(tp => {
        const project = {
          ...tp.project,
          teamName: tp.teamName
        };
        // Make sure teamId is properly set
        console.log("Original project teamId:", tp.project.teamId, "Type:", typeof tp.project.teamId);
        return project;
      });
      
      console.log("Team projects:", formattedTeamProjects.map(p => ({ id: p.id, name: p.name, teamId: p.teamId })));
      
      // Group projects by team
      const projectsByTeam = {};
      
      // Add personal projects
      projectsByTeam.personal = {
        teamId: null,
        teamName: "Personal Projects",
        projects: personalProjects
      };
      
      // Add team projects
      for (const team of allTeams) {
        const teamProjects = formattedTeamProjects.filter(p => p.teamId === team.teamId);
        projectsByTeam[team.teamId] = {
          teamId: team.teamId,
          teamName: team.teamName,
          role: team.role,
          projects: teamProjects
        };
      }
      
      return res.json({
        personalProjects,
        teamProjects: formattedTeamProjects,
        projectsByTeam: Object.values(projectsByTeam)
      });
    } catch (error) {
      console.error("Error fetching all projects:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Failed to fetch projects" 
      });
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