import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  plan: text("plan", { enum: ["free", "pro", "teams"] }).default("free").notNull(),
  simulationsUsed: integer("simulations_used").default(0).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  githubUrl: text("github_url"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  githubUrl: text("github_url").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status", { enum: ["pending", "testing", "completed", "failed"] })
    .default("pending")
    .notNull(),
  projectId: integer("project_id"),
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

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  plan: z.enum(["free", "pro", "teams"]).default("free"),
  simulationsUsed: z.number().default(0),
});

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);

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
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type SelectProject = typeof projects.$inferSelect;