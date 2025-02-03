import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  githubUrl: text("github_url").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status", { enum: ["pending", "testing", "completed", "failed"] })
    .default("pending")
    .notNull(),
  testResults: text("test_results"),
});

export const insertSubmissionSchema = createInsertSchema(submissions, {
  githubUrl: z
    .string()
    .url()
    .regex(/^https:\/\/github\.com\/[^/]+\/[^/]+$/i, "Invalid GitHub repository URL"),
  email: z.string().email(),
});

// Schema for the test results JSON structure
export const testResultSchema = z.object({
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    duration: z.number(),
  }),
  results: z.record(
    z.string(),
    z.record(
      z.string(),
      z.object({
        passed: z.boolean(),
        output: z.string().optional(),
        duration: z.number(),
        category: z.string(),
        errorDetails: z
          .object({
            message: z.string(),
            stackTrace: z.string().optional(),
          })
          .optional(),
      }),
    ),
  ),
});

export const selectSubmissionSchema = createSelectSchema(submissions);
export type InsertSubmission = typeof submissions.$inferInsert;
export type SelectSubmission = typeof submissions.$inferSelect;
export type TestResults = z.infer<typeof testResultSchema>;