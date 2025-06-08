import { pgTable, text, serial, timestamp, integer, boolean, uuid, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define the relations for models
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
  // Chat messages for free plan users (10 messages per month)
  chatMessagesUsed: integer("chat_messages_used").default(0).notNull(),
  chatMessagesResetDate: timestamp("chat_messages_reset_date").defaultNow().notNull(),
});

// Define teams table for team management
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull(), // User who created the team
  isDeleted: boolean("is_deleted").default(false).notNull(), // Soft delete flag
});

// Define team members table to track team membership
export const teamMembers = pgTable("team_members", {
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role", { enum: ["admin", "member"] }).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  invitedBy: integer("invited_by").notNull(),
  status: text("status", { enum: ["invited", "active"] }).default("invited").notNull(),
  // Composite primary key to ensure each user is only once in each team
  }, (t) => ({
    pk: primaryKey({ columns: [t.teamId, t.userId] }),
}));

// Define team invitations table for pending invites
export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  email: text("email").notNull(),
  invitedBy: integer("invited_by").notNull(),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).default("pending").notNull(),
  expiresAt: timestamp("expires_at"),
  token: text("token").notNull(), // Unique token for invitation
});

// New pricing tables
export const pricingPlans = pgTable("pricing_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // Price set to 39 for pro plan in the database
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

// Table to track credit purchases for free users
export const creditPurchases = pgTable("credit_purchases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  credits: integer("credits").notNull(), // Number of credits purchased (50 or 100)
  price: integer("price").notNull(), // Price in cents (500 for $5, 1000 for $10)
  status: text("status", { enum: ["pending", "completed", "failed"] })
    .default("pending")
    .notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  githubUrl: text("github_url"),
  userId: integer("user_id").notNull(),
  teamId: integer("team_id"), // Optional, null for personal projects
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(), // Soft delete flag
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
  jsonData: jsonb("json_data"),
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

// Table to store chat message history
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  submissionId: uuid("submission_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  classification: jsonb("classification"), // Store step, action, confidence, etc.
  actionTaken: boolean("action_taken").default(false),
  section: text("section").default("general"),
  conversationId: text("conversation_id").notNull() // Unique ID for each conversation session
});

// New table to store project files data
export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  submissionId: uuid("submission_id").notNull(),
  projectName: text("project_name").notNull(),
  projectSummary: text("project_summary").notNull(),
  devEnvironment: text("dev_environment").notNull(),
  compiler: text("compiler").notNull(),
  contracts: jsonb("contracts").notNull(), // Will store array of contract objects
  dependencies: jsonb("dependencies").notNull(), // Will store dependencies object
  projectType: text("project_type", { enum: ["StableBase", "Predify"] }).notNull(),
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

export const insertChatMessageSchema = createInsertSchema(chatMessages);
export const selectChatMessageSchema = createSelectSchema(chatMessages);

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
export type InsertProjectFiles = typeof projectFiles.$inferInsert;
export type SelectProjectFiles = typeof projectFiles.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type SelectChatMessage = typeof chatMessages.$inferSelect;

export const insertAnalysisStepSchema = createInsertSchema(analysisSteps);
export const selectAnalysisStepSchema = createSelectSchema(analysisSteps);
export type InsertAnalysisStep = typeof analysisSteps.$inferInsert;
export type SelectAnalysisStep = typeof analysisSteps.$inferSelect;

// Team type definitions
export const insertTeamSchema = createInsertSchema(teams, {
  name: z.string().min(1, "Team name is required"),
  description: z.string().optional(),
});
export const selectTeamSchema = createSelectSchema(teams);
export type InsertTeam = typeof teams.$inferInsert;
export type SelectTeam = typeof teams.$inferSelect;

export const insertTeamMemberSchema = createInsertSchema(teamMembers);
export const selectTeamMemberSchema = createSelectSchema(teamMembers);
export type InsertTeamMember = typeof teamMembers.$inferInsert;
export type SelectTeamMember = typeof teamMembers.$inferSelect;

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations, {
  email: z.string().email("Invalid email address"),
});
export const selectTeamInvitationSchema = createSelectSchema(teamInvitations);
export type InsertTeamInvitation = typeof teamInvitations.$inferInsert;
export type SelectTeamInvitation = typeof teamInvitations.$inferSelect;

export type InsertPricingPlan = typeof pricingPlans.$inferInsert;
export type SelectPricingPlan = typeof pricingPlans.$inferSelect;
export type InsertPlanFeature = typeof planFeatures.$inferInsert;
export type SelectPlanFeature = typeof planFeatures.$inferSelect;

export const insertCreditPurchaseSchema = createInsertSchema(creditPurchases);
export const selectCreditPurchaseSchema = createSelectSchema(creditPurchases);
export type InsertCreditPurchase = typeof creditPurchases.$inferInsert;
export type SelectCreditPurchase = typeof creditPurchases.$inferSelect;

// Define relations between tables
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  teamMemberships: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
  members: many(teamMembers),
  projects: many(projects),
  creator: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [teamMembers.invitedBy],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  owner: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
    relationName: "team_projects",
  }),
}));