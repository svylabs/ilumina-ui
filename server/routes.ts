import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { projects, submissions, analysisSteps, chatMessages } from "@db/schema";
import { eq, desc, and, or, asc } from "drizzle-orm";
import crypto from "crypto";
import { SQL, sql } from 'drizzle-orm';
import {
  classifyUserRequest,
  generateChatResponse,
  classifyConversationType,
  generateChecklist,
  type ClassificationResult,
} from "./gemini";
import { parseVerificationLogs, extractErrorMessage, explainVerificationError } from "./verification";

// Middleware to check if user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

// Type for step status
type AnalysisStepStatus = {
  status: "pending" | "in_progress" | "completed" | "failed";
  details: string | null;
  startTime: string | null;
  jsonData?: any; // Support for JSON data
};

// Function to call the external API
async function callExternalIluminaAPI(endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> {
  const baseURL = process.env.ILUMINA_API_URL || 'https://api.iluminascan.com';
  const apiKey = process.env.ILUMINA_API_KEY;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  const options: RequestInit = {
    method,
    headers,
  };
  
  if (body && method === 'POST') {
    options.body = JSON.stringify(body);
  }
  
  try {
    console.log(`Calling external API: ${baseURL}${endpoint}`);
    const response = await fetch(`${baseURL}${endpoint}`, options);
    return response;
  } catch (error) {
    console.error(`Error calling external API: ${error}`);
    throw error;
  }
}

// Helper to validate submission ID
async function getValidSubmissionId(idParam: string): Promise<{ 
  submissionId?: string, 
  projectId?: string,
  statusCode?: number,
  error?: string,
  details?: string
}> {
  // If it looks like a UUID, use it directly
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam)) {
    return { submissionId: idParam };
  }
  
  // If it's a numeric ID, it might be a project ID
  if (/^\d+$/.test(idParam)) {
    try {
      const projectId = parseInt(idParam);
      
      const result = await db.execute(
        sql`SELECT id FROM "submissions" WHERE "project_id" = ${projectId} ORDER BY "created_at" DESC LIMIT 1`
      );
      
      const latestSubmission = result.rows && result.rows.length > 0 ? result.rows[0] : null;
      
      if (latestSubmission) {
        return { 
          submissionId: latestSubmission.id, 
          projectId: idParam 
        };
      } else {
        return {
          statusCode: 404,
          error: "No submission found",
          details: `No submissions exist for project ID ${idParam}`
        };
      }
    } catch (error) {
      console.error("Error finding submission by project ID:", error);
      return {
        statusCode: 500,
        error: "Database error",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  
  // Not a valid format
  return {
    statusCode: 400,
    error: "Invalid ID format",
    details: `ID must be a valid UUID or numeric project ID: ${idParam}`
  };
}

export function registerRoutes(app: Express): Server {
  // Set up authentication
  setupAuth(app);
  
  // Basic health check endpoint
  app.get("/api/health", (_req, res) => {
    return res.json({ status: "healthy" });
  });

  // Get current user endpoint
  app.get("/api/me", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    return res.status(401).json({ error: "Not authenticated" });
  });

  // Main projects list endpoint - support filtering for teams vs personal
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      const projectType = req.query.type || 'personal';
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Use raw SQL with parameters to properly filter projects
      // This handles the bug where users could see other people's projects
      let query;
      
      if (projectType === 'team') {
        query = sql`
          SELECT p.* FROM "projects" p
          JOIN "team_members" tm ON p."team_id" = tm."team_id"
          WHERE tm."user_id" = ${userId}
          AND p."is_deleted" = false
          ORDER BY p."created_at" DESC
        `;
      } else {
        // Personal projects (default)
        query = sql`
          SELECT * FROM "projects"
          WHERE "user_id" = ${userId}
          AND "team_id" IS NULL
          AND "is_deleted" = false
          ORDER BY "created_at" DESC
        `;
      }
      
      const results = await db.execute(query);
      
      // Transform any snake_case column names to camelCase for frontend
      // Check if results is an array and handle it accordingly
      const transformedResults = Array.isArray(results.rows) ? results.rows.map(p => ({
        id: p.id,
        userId: p.user_id,
        teamId: p.team_id,
        projectName: p.project_name,
        githubUrl: p.github_url,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        status: p.status,
        isDeleted: p.is_deleted || false
      })) : [];
      
      return res.json(transformedResults);
    } catch (error) {
      console.error("Error fetching projects:", error);
      return res.status(500).json({ 
        error: "Failed to fetch projects",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Configure HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
