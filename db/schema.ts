import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
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
});

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull(),
  status: text("status", { enum: ["pending", "running", "success", "failed"] })
    .default("pending")
    .notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  latestLog: text("latest_log"),
});

export const insertSubmissionSchema = createInsertSchema(submissions, {
  githubUrl: z
    .string()
    .url()
    .regex(/^https:\/\/github\.com\/[^/]+\/[^/]+$/i, "Invalid GitHub repository URL"),
  email: z.string().email(),
});

export const insertRunSchema = createInsertSchema(runs);
export const selectRunSchema = createSelectSchema(runs);

export const selectSubmissionSchema = createSelectSchema(submissions);
export type InsertSubmission = typeof submissions.$inferInsert;
export type SelectSubmission = typeof submissions.$inferSelect;
export type InsertRun = typeof runs.$inferInsert;
export type SelectRun = typeof runs.$inferSelect;