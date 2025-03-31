import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { submissions, runs, projects, insertSubmissionSchema, contacts, insertContactSchema, pricingPlans, planFeatures } from "@db/schema";
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

      // Support both old and new step IDs for backwards compatibility
      const stepsStatus: Record<string, AnalysisStepStatus> = {
        // New step IDs
        files: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: {
            "projectName": "Predify",
            "projectSummary": "A decentralized prediction market platform that allows users to create markets, place bets, and earn rewards based on the outcome of various events.",
            "devEnvironment": "Hardhat + Solidity",
            "compiler": "0.8.17",
            "contracts": [
              {
                "name": "Predify.sol",
                "summary": "Main contract for the prediction market platform. Handles creating markets, placing bets, and resolving outcomes.",
                "interfaces": ["IPredictionMarket", "IERC20Receiver"],
                "libraries": ["SafeERC20", "AccessControl"]
              },
              {
                "name": "ManualResolutionStrategy.sol",
                "summary": "Implements a resolution strategy where authorized resolvers manually determine the outcome of markets.",
                "interfaces": ["IResolutionStrategy"],
                "libraries": ["AccessControl"]
              },
              {
                "name": "MockERC20.sol",
                "summary": "A mock ERC20 token used for testing the prediction market.",
                "interfaces": ["IERC20", "IERC20Metadata"],
                "libraries": ["Context"]
              }
            ],
            "dependencies": {
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
          jsonData: {
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
                "summary": "Entity responsible for resolving the market based on a predefined resolution strategy. This may be done manually or automatically.",
                "actions": [
                  {
                    "name": "Resolve Market",
                    "summary": "Resolves a market to determine the winning outcome.",
                    "contract_name": "Predify",
                    "function_name": "resolveMarket",
                    "probability": 1.0
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
          jsonData: {
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
            }
          }
        },
        simulations: { 
          status: "completed", 
          details: null, 
          startTime: null,
          jsonData: {
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

      steps.forEach(step => {
        if (stepsStatus[step.stepId]) {
          stepsStatus[step.stepId] = {
            status: step.status,
            details: step.details,
            startTime: step.status === 'in_progress' ? step.createdAt.toISOString() : null,
            jsonData: step.json_data // Include the JSON data if available
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