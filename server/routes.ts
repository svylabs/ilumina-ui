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

      // Check if there are any database entries for this submission
      if (steps.length > 0) {
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
        // If files step is "in_progress", we still want to show sample data
        if (stepsStatus.files.status === "in_progress") {
          stepsStatus.files.jsonData = sampleData.files.jsonData;
        }

        const hasInProgressStep = steps.some(step => step.status === "in_progress");
        const status = hasInProgressStep ? "in_progress" : "completed";
        
        res.json({ status, steps: stepsStatus });
      } else {
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