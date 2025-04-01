import { Request, Response } from "express";
import { db } from "@db";
import * as schema from "@db/schema";
import { eq } from "drizzle-orm";
import fs from 'fs';
import path from 'path';

// Handler for /api/files route
export async function getProjectFiles(req: Request, res: Response) {
  try {
    const submissionId = req.query.submissionId as string;
    
    if (!submissionId) {
      return res.status(400).json({ error: "Missing submissionId parameter" });
    }

    // First check if we have project files for this submission
    const projectFiles = await db
      .select()
      .from(schema.projectFiles)
      .where(eq(schema.projectFiles.submissionId, submissionId))
      .limit(1);

    // If no project files exist, we'll create default ones
    if (projectFiles.length === 0) {
      // Default to Predify project for new submissions
      const defaultProjectFiles = {
        submissionId: submissionId,
        projectName: "Predify",
        projectSummary: "A decentralized prediction market platform that allows users to create markets, place bets, and earn rewards based on the outcome of various events.",
        devEnvironment: "Hardhat + Solidity",
        compiler: "0.8.17",
        contracts: [
          {
            name: "Predify.sol",
            summary: "Main contract for the prediction market platform. Handles creating markets, placing bets, and resolving outcomes.",
            interfaces: ["IPredictionMarket", "IERC20Receiver"],
            libraries: ["SafeERC20", "AccessControl"]
          },
          {
            name: "ManualResolutionStrategy.sol",
            summary: "Implements a resolution strategy where authorized resolvers manually determine the outcome of markets.",
            interfaces: ["IResolutionStrategy"],
            libraries: ["AccessControl"]
          },
          {
            name: "MockERC20.sol",
            summary: "A mock ERC20 token used for testing the prediction market.",
            interfaces: ["IERC20", "IERC20Metadata"],
            libraries: ["Context"]
          }
        ]
      };

      // Insert the default project files into the database
      await db.insert(schema.projectFiles).values(defaultProjectFiles);

      // Fetch the newly inserted project files
      const newProjectFiles = await db
        .select()
        .from(schema.projectFiles)
        .where(eq(schema.projectFiles.submissionId, submissionId))
        .limit(1);

      if (newProjectFiles.length === 0) {
        return res.status(500).json({ error: "Failed to create project files" });
      }

      const projectFilesData = newProjectFiles[0];
      
      // Now we need to prepare the response format
      const files = {
        status: "completed", 
        details: null, 
        startTime: null,
        jsonData: {
          projectName: projectFilesData.projectName,
          projectSummary: projectFilesData.projectSummary,
          devEnvironment: projectFilesData.devEnvironment,
          compiler: projectFilesData.compiler,
          contracts: projectFilesData.contracts,
          dependencies: {
            "@openzeppelin/contracts": "4.8.2",
            "hardhat": "2.14.0",
            "ethers": "5.7.2",
            "chai": "4.3.7"
          }
        }
      };

      // Load actors from the asset file for Predify project
      const actorsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'attached_assets/Pasted--actors-name-Market-Creator-summary-Creates-prediction-markets-with-specific-paramete-1743407911398.txt'), 'utf8'));
      
      const actors = {
        status: "completed",
        details: null,
        startTime: null,
        jsonData: actorsData
      };

      return res.json({ files, actors });
    }
    
    // If we already have project files, return them
    const projectFilesData = projectFiles[0];
    
    const files = {
      status: "completed", 
      details: null, 
      startTime: null,
      jsonData: {
        projectName: projectFilesData.projectName,
        projectSummary: projectFilesData.projectSummary,
        devEnvironment: projectFilesData.devEnvironment,
        compiler: projectFilesData.compiler,
        contracts: projectFilesData.contracts,
        dependencies: {
          "@openzeppelin/contracts": "4.8.2",
          "hardhat": "2.14.0",
          "ethers": "5.7.2",
          "chai": "4.3.7"
        }
      }
    };
    
    // Load actors from the asset file for Predify project (fixed default)
    const actorsData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'attached_assets/Pasted--actors-name-Market-Creator-summary-Creates-prediction-markets-with-specific-paramete-1743407911398.txt'), 'utf8'));
    
    const actors = {
      status: "completed",
      details: null,
      startTime: null,
      jsonData: actorsData
    };
    
    return res.json({ files, actors });
  } catch (error) {
    console.error("Error in /api/files:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}