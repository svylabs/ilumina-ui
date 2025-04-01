import { pgTable, text, serial, timestamp, integer, boolean, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Existing tables remain unchanged
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  plan: text("plan", { enum: ["free", "pro", "teams"] }).default("free").notNull(),
  simulationsUsed: integer("simulations_used").default(0).notNull(),
  // Field to track the last date simulations were used for daily limit reset
  lastSimulationDate: timestamp("last_simulation_date"),
});

// New pricing tables
export const pricingPlans = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(),
  period: text("period").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const planFeatures = pgTable("plan_features", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  feature: text("feature").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  githubUrl: text("github_url"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
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
  submissionId: uuid("submission_id").notNull(),
  status: text("status", { enum: ["pending", "running", "success", "failed"] })
    .default("pending")
    .notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  latestLog: text("latest_log"),
});

export const analysisSteps = pgTable("analysis_steps", {
  id: serial("id").primaryKey(),
  submissionId: uuid("submission_id").notNull(),
  stepId: text("step_id", {
    // Updated to match the new step sequence
    enum: ["files", "actors", "deployment", "test_setup", "simulations"]
  }).notNull(),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed"]
  }).default("pending").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table to track simulation runs
export const simulationRuns = pgTable("simulation_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  submissionId: uuid("submission_id").notNull(),
  runId: text("run_id").notNull(), // Client-side generated ID like 'sim-123'
  status: text("status", { enum: ["success", "failure"] }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  logUrl: text("log_url"),
  summary: jsonb("summary"), // Will store totalTests, passed, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table to store project files information
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  submissionId: uuid("submission_id").notNull(),
  projectName: text("project_name").notNull(),
  projectSummary: text("project_summary").notNull(),
  devEnvironment: text("dev_environment").notNull(),
  compiler: text("compiler").notNull(),
  contracts: jsonb("contracts").notNull(), // Will store array of contract info 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export const insertContactSchema = createInsertSchema(contacts, {
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});
export const selectContactSchema = createSelectSchema(contacts);

export const insertPricingPlanSchema = createInsertSchema(pricingPlans);
export const selectPricingPlanSchema = createSelectSchema(pricingPlans);

export const insertPlanFeatureSchema = createInsertSchema(planFeatures);
export const selectPlanFeatureSchema = createSelectSchema(planFeatures);

export const insertSimulationRunSchema = createInsertSchema(simulationRuns);
export const selectSimulationRunSchema = createSelectSchema(simulationRuns);

export const insertProjectFilesSchema = createInsertSchema(projectFiles);
export const selectProjectFilesSchema = createSelectSchema(projectFiles);

export type InsertSubmission = typeof submissions.$inferInsert;
export type SelectSubmission = typeof submissions.$inferSelect;
export type InsertRun = typeof runs.$inferInsert;
export type SelectRun = typeof runs.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type SelectProject = typeof projects.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;
export type SelectContact = typeof contacts.$inferSelect;
export type InsertSimulationRun = typeof simulationRuns.$inferInsert;
export type SelectSimulationRun = typeof simulationRuns.$inferSelect;

export const insertAnalysisStepSchema = createInsertSchema(analysisSteps);
export const selectAnalysisStepSchema = createSelectSchema(analysisSteps);
export type InsertAnalysisStep = typeof analysisSteps.$inferInsert;
export type SelectAnalysisStep = typeof analysisSteps.$inferSelect;

export type InsertPricingPlan = typeof pricingPlans.$inferInsert;
export type SelectPricingPlan = typeof pricingPlans.$inferSelect;
export type InsertPlanFeature = typeof planFeatures.$inferInsert;
export type SelectPlanFeature = typeof planFeatures.$inferSelect;
export type InsertProjectFiles = typeof projectFiles.$inferInsert;
export type SelectProjectFiles = typeof projectFiles.$inferSelect;