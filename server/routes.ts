import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { submissions, insertSubmissionSchema } from "@db/schema";
import { eq } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";

export function registerRoutes(app: Express): Server {
  app.post("/api/submissions", async (req, res) => {
    const result = insertSubmissionSchema.safeParse(req.body);
    if (!result.success) {
      const error = fromZodError(result.error);
      return res.status(400).send(error.toString());
    }

    // For demonstration, add sample test results
    const sampleTestResults = {
      summary: {
        total: 15,
        passed: 12,
        failed: 3,
        duration: 5432 // milliseconds
      },
      results: {
        "Code Quality": {
          "Check code formatting": {
            passed: true,
            duration: 234,
            category: "Code Quality",
            output: "All files are properly formatted"
          },
          "Lint check": {
            passed: false,
            duration: 567,
            category: "Code Quality",
            errorDetails: {
              message: "Found 2 eslint errors",
              stackTrace: "warning: Missing semicolon (semi)\nwarning: Unexpected console statement (no-console)"
            }
          }
        },
        "Unit Tests": {
          "User authentication": {
            passed: true,
            duration: 789,
            category: "Unit Tests",
            output: "All 5 authentication tests passed"
          },
          "Data validation": {
            passed: true,
            duration: 432,
            category: "Unit Tests",
            output: "Input validation working as expected"
          }
        },
        "Integration Tests": {
          "API endpoints": {
            passed: false,
            duration: 1234,
            category: "Integration Tests",
            errorDetails: {
              message: "Failed to connect to database",
              stackTrace: "Error: Connection refused\n  at Database.connect (/app/db.js:45:12)"
            }
          }
        }
      }
    };

    const submission = await db.insert(submissions).values({
      ...result.data,
      status: "completed",
      testResults: JSON.stringify(sampleTestResults)
    }).returning();

    res.status(201).json(submission[0]);
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

    res.json(submission);
  });

  const httpServer = createServer(app);
  return httpServer;
}