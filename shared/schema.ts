import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// USERS
// ============================================================================
export const users = pgTable("users", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // owner, admin, user
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isBanned: boolean("is_banned").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teamMembers, {
    fields: [users.id],
    references: [teamMembers.userId],
  }),
  captainOf: one(teams, {
    fields: [users.id],
    references: [teams.captainId],
  }),
  solves: many(solves),
  submissions: many(submissions),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const registerUserSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  password: z.string().min(8),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRole = "owner" | "admin" | "user";

// ============================================================================
// TEAMS
// ============================================================================
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  inviteCode: varchar("invite_code", { length: 8 }).notNull().unique(),
  captainId: varchar("captain_id", { length: 36 })
    .notNull()
    .references(() => users.id),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ one, many }) => ({
  captain: one(users, {
    fields: [teams.captainId],
    references: [users.id],
  }),
  members: many(teamMembers),
  solves: many(solves),
}));

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  inviteCode: true,
  createdAt: true,
});

export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

// ============================================================================
// TEAM MEMBERS
// ============================================================================
export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueMember: unique().on(table.userId, table.teamId),
  })
);

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export type TeamMember = typeof teamMembers.$inferSelect;

// ============================================================================
// CTF EVENTS
// ============================================================================
export const ctfEvents = pgTable("ctf_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  rules: text("rules"),
  ctfType: text("ctf_type").notNull().default("jeopardy"), // jeopardy or serial
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  registrationStart: timestamp("registration_start"),
  registrationEnd: timestamp("registration_end"),
  isTeamBased: boolean("is_team_based").notNull().default(false),
  maxTeamSize: integer("max_team_size"),
  scoreboardFrozen: boolean("scoreboard_frozen").notNull().default(false),
  scoreboardFreezeTime: timestamp("scoreboard_freeze_time"),
  isPublished: boolean("is_published").notNull().default(false),
  isPrivate: boolean("is_private").notNull().default(false),
  inviteCode: varchar("invite_code", { length: 8 }).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ctfEventsRelations = relations(ctfEvents, ({ many }) => ({
  challenges: many(challenges),
  registrations: many(ctfRegistrations),
  solves: many(solves),
}));

export const insertCtfEventSchema = createInsertSchema(ctfEvents).omit({
  id: true,
  inviteCode: true,
  createdAt: true,
});

export type CtfEvent = typeof ctfEvents.$inferSelect;
export type InsertCtfEvent = z.infer<typeof insertCtfEventSchema>;

// ============================================================================
// CATEGORIES
// ============================================================================
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#8B1538"),
  icon: text("icon").notNull().default("terminal"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  challenges: many(challenges),
}));

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

// ============================================================================
// CHALLENGES
// ============================================================================
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  ctfEventId: integer("ctf_event_id")
    .notNull()
    .references(() => ctfEvents.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  flag: text("flag").notNull(), // The actual flag (stored as-is, compared case-insensitively)
  points: integer("points").notNull(),
  isDynamic: boolean("is_dynamic").notNull().default(false),
  minPoints: integer("min_points"), // For dynamic scoring
  decay: integer("decay"), // For dynamic scoring
  solveCount: integer("solve_count").notNull().default(0),
  authorId: varchar("author_id", { length: 36 }).references(() => users.id),
  isHidden: boolean("is_hidden").notNull().default(false),
  releaseTime: timestamp("release_time"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  ctfEvent: one(ctfEvents, {
    fields: [challenges.ctfEventId],
    references: [ctfEvents.id],
  }),
  category: one(categories, {
    fields: [challenges.categoryId],
    references: [categories.id],
  }),
  author: one(users, {
    fields: [challenges.authorId],
    references: [users.id],
  }),
  files: many(challengeFiles),
  solves: many(solves),
  submissions: many(submissions),
  containerLinks: many(challengeContainers),
}));

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
  solveCount: true,
  createdAt: true,
});

export type Challenge = typeof challenges.$inferSelect;
export type InsertChallenge = z.infer<typeof insertChallengeSchema>;

// ============================================================================
// CHALLENGE FILES
// ============================================================================
export const challengeFiles = pgTable("challenge_files", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(), // Stored filename (UUID-based)
  originalName: text("original_name").notNull(), // Original upload name
  path: text("path").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challengeFilesRelations = relations(challengeFiles, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeFiles.challengeId],
    references: [challenges.id],
  }),
}));

export type ChallengeFile = typeof challengeFiles.$inferSelect;

// ============================================================================
// SUBMISSIONS (all attempts)
// ============================================================================
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  ctfEventId: integer("ctf_event_id")
    .notNull()
    .references(() => ctfEvents.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
  flag: text("flag").notNull(), // Submitted flag
  isCorrect: boolean("is_correct").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const submissionsRelations = relations(submissions, ({ one }) => ({
  challenge: one(challenges, {
    fields: [submissions.challengeId],
    references: [challenges.id],
  }),
  ctfEvent: one(ctfEvents, {
    fields: [submissions.ctfEventId],
    references: [ctfEvents.id],
  }),
  user: one(users, {
    fields: [submissions.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [submissions.teamId],
    references: [teams.id],
  }),
}));

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

// ============================================================================
// SOLVES (successful solves only)
// ============================================================================
export const solves = pgTable(
  "solves",
  {
    id: serial("id").primaryKey(),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
    ctfEventId: integer("ctf_event_id")
      .notNull()
      .references(() => ctfEvents.id, { onDelete: "cascade" }),
    points: integer("points").notNull(), // Points at time of solve
    isFirstBlood: boolean("is_first_blood").notNull().default(false),
    solvedAt: timestamp("solved_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserChallenge: unique().on(table.userId, table.challengeId),
  })
);

export const solvesRelations = relations(solves, ({ one }) => ({
  challenge: one(challenges, {
    fields: [solves.challengeId],
    references: [challenges.id],
  }),
  user: one(users, {
    fields: [solves.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [solves.teamId],
    references: [teams.id],
  }),
  ctfEvent: one(ctfEvents, {
    fields: [solves.ctfEventId],
    references: [ctfEvents.id],
  }),
}));

export type Solve = typeof solves.$inferSelect;

// ============================================================================
// CTF REGISTRATIONS
// ============================================================================
export const ctfRegistrations = pgTable(
  "ctf_registrations",
  {
    id: serial("id").primaryKey(),
    ctfEventId: integer("ctf_event_id")
      .notNull()
      .references(() => ctfEvents.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id").references(() => teams.id, { onDelete: "set null" }),
    registeredAt: timestamp("registered_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueRegistration: unique().on(table.ctfEventId, table.userId),
  })
);

export const ctfRegistrationsRelations = relations(ctfRegistrations, ({ one }) => ({
  ctfEvent: one(ctfEvents, {
    fields: [ctfRegistrations.ctfEventId],
    references: [ctfEvents.id],
  }),
  user: one(users, {
    fields: [ctfRegistrations.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [ctfRegistrations.teamId],
    references: [teams.id],
  }),
}));

export type CtfRegistration = typeof ctfRegistrations.$inferSelect;

// ============================================================================
// PLATFORM SETTINGS
// ============================================================================
export const platformSettings = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  valueType: text("value_type").notNull().default("string"),
  category: text("category").notNull().default("general"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;

export interface PlatformSettingsData {
  platformName: string;
  platformTagline: string;
  primaryColor: string; // HSL format: "345 80% 35%"
  logoUrl: string | null;
  faviconUrl: string | null;
  footerCopyright: string;
}

// ============================================================================
// SESSION (for express-session with connect-pg-simple)
// ============================================================================
export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

// ============================================================================
// CONTAINERS
// ============================================================================
export const containers = pgTable("containers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  deploymentType: text("deployment_type").notNull(), // 'registry' or 'upload'

  // Registry-based deployment
  registryUrl: text("registry_url"),
  imageName: text("image_name"),
  imageTag: text("image_tag").default("latest"),
  registryUsername: text("registry_username"),
  registryPassword: text("registry_password"), // Should be encrypted in production

  // Upload-based deployment
  uploadFilename: text("upload_filename"),
  uploadPath: text("upload_path"),
  uploadSize: integer("upload_size"),

  // Container configuration
  exposedPorts: text("exposed_ports").notNull().default("[]"), // JSON array: [{"containerPort": 80, "protocol": "tcp"}]
  memoryLimit: integer("memory_limit").default(512), // MB
  cpuLimit: integer("cpu_limit").default(256), // CPU shares

  // Metadata
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const containersRelations = relations(containers, ({ one, many }) => ({
  creator: one(users, {
    fields: [containers.createdBy],
    references: [users.id],
  }),
  deployments: many(containerDeployments),
  challengeLinks: many(challengeContainers),
  envVars: many(containerEnvVars),
}));

export const insertContainerSchema = createInsertSchema(containers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Container = typeof containers.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;

// ============================================================================
// CONTAINER DEPLOYMENTS
// ============================================================================
export const containerDeployments = pgTable("container_deployments", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id")
    .notNull()
    .references(() => containers.id, { onDelete: "cascade" }),
  instanceName: text("instance_name").notNull().unique(),

  // Deployment platform
  platform: text("platform").notNull(), // 'docker' or 'ecs'
  platformId: text("platform_id"), // Docker container ID or ECS task ARN

  // Status
  status: text("status").notNull(), // 'starting', 'running', 'stopping', 'stopped', 'failed'
  statusMessage: text("status_message"),

  // Network configuration
  internalIp: text("internal_ip"),
  accessUrl: text("access_url"),

  // Health tracking
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: text("health_status"), // 'healthy', 'unhealthy', 'unknown'

  // Lifecycle
  startedAt: timestamp("started_at"),
  stoppedAt: timestamp("stopped_at"),
  deployedBy: varchar("deployed_by", { length: 36 }).references(() => users.id),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const containerDeploymentsRelations = relations(containerDeployments, ({ one, many }) => ({
  container: one(containers, {
    fields: [containerDeployments.containerId],
    references: [containers.id],
  }),
  deployer: one(users, {
    fields: [containerDeployments.deployedBy],
    references: [users.id],
  }),
  portMappings: many(containerPortMappings),
}));

export type ContainerDeployment = typeof containerDeployments.$inferSelect;
export type InsertContainerDeployment = Omit<typeof containerDeployments.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// CHALLENGE CONTAINERS (many-to-many)
// ============================================================================
export const challengeContainers = pgTable(
  "challenge_containers",
  {
    id: serial("id").primaryKey(),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    containerId: integer("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueLink: unique().on(table.challengeId, table.containerId),
  })
);

export const challengeContainersRelations = relations(challengeContainers, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeContainers.challengeId],
    references: [challenges.id],
  }),
  container: one(containers, {
    fields: [challengeContainers.containerId],
    references: [containers.id],
  }),
}));

export type ChallengeContainer = typeof challengeContainers.$inferSelect;

// ============================================================================
// CONTAINER PORT MAPPINGS
// ============================================================================
export const containerPortMappings = pgTable("container_port_mappings", {
  id: serial("id").primaryKey(),
  deploymentId: integer("deployment_id")
    .notNull()
    .references(() => containerDeployments.id, { onDelete: "cascade" }),
  containerPort: integer("container_port").notNull(),
  hostPort: integer("host_port").notNull(),
  protocol: text("protocol").notNull().default("tcp"),
  subdomain: text("subdomain").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const containerPortMappingsRelations = relations(containerPortMappings, ({ one }) => ({
  deployment: one(containerDeployments, {
    fields: [containerPortMappings.deploymentId],
    references: [containerDeployments.id],
  }),
}));

export type ContainerPortMapping = typeof containerPortMappings.$inferSelect;
export type InsertContainerPortMapping = Omit<typeof containerPortMappings.$inferInsert, 'id' | 'createdAt'>;

// ============================================================================
// CONTAINER ENVIRONMENT VARIABLES
// ============================================================================
export const containerEnvVars = pgTable(
  "container_env_vars",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .notNull()
      .references(() => containers.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    isSecret: boolean("is_secret").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueEnvVar: unique().on(table.containerId, table.key),
  })
);

export const containerEnvVarsRelations = relations(containerEnvVars, ({ one }) => ({
  container: one(containers, {
    fields: [containerEnvVars.containerId],
    references: [containers.id],
  }),
}));

export type ContainerEnvVar = typeof containerEnvVars.$inferSelect;
export type InsertContainerEnvVar = Omit<typeof containerEnvVars.$inferInsert, 'id' | 'createdAt'>;

// ============================================================================
// EMAIL VERIFICATION TOKENS
// ============================================================================
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const emailVerificationTokensRelations = relations(emailVerificationTokens, ({ one }) => ({
  user: one(users, {
    fields: [emailVerificationTokens.userId],
    references: [users.id],
  }),
}));

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// ============================================================================
// SERIAL CHALLENGES
// ============================================================================
export const serialChallenges = pgTable("serial_challenges", {
  id: serial("id").primaryKey(),
  ctfEventId: integer("ctf_event_id")
    .notNull()
    .references(() => ctfEvents.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  authorId: varchar("author_id", { length: 36 })
    .references(() => users.id),
  isHidden: boolean("is_hidden").notNull().default(false),
  releaseTime: timestamp("release_time"),
  totalStages: integer("total_stages").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serialChallengesRelations = relations(serialChallenges, ({ one, many }) => ({
  ctfEvent: one(ctfEvents, {
    fields: [serialChallenges.ctfEventId],
    references: [ctfEvents.id],
  }),
  category: one(categories, {
    fields: [serialChallenges.categoryId],
    references: [categories.id],
  }),
  author: one(users, {
    fields: [serialChallenges.authorId],
    references: [users.id],
  }),
  stages: many(serialStages),
  progress: many(serialProgress),
}));

export const insertSerialChallengeSchema = createInsertSchema(serialChallenges).omit({
  id: true,
  totalStages: true,
  createdAt: true,
});

export type SerialChallenge = typeof serialChallenges.$inferSelect;
export type InsertSerialChallenge = z.infer<typeof insertSerialChallengeSchema>;

// ============================================================================
// SERIAL STAGES
// ============================================================================
export const serialStages = pgTable(
  "serial_stages",
  {
    id: serial("id").primaryKey(),
    serialChallengeId: integer("serial_challenge_id")
      .notNull()
      .references(() => serialChallenges.id, { onDelete: "cascade" }),
    stageOrder: integer("stage_order").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    flag: text("flag").notNull(),
    points: integer("points").notNull(),
    hint: text("hint"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueStageOrder: unique().on(table.serialChallengeId, table.stageOrder),
  })
);

export const serialStagesRelations = relations(serialStages, ({ one, many }) => ({
  serialChallenge: one(serialChallenges, {
    fields: [serialStages.serialChallengeId],
    references: [serialChallenges.id],
  }),
  files: many(serialStageFiles),
  solves: many(serialStageSolves),
}));

export const insertSerialStageSchema = createInsertSchema(serialStages).omit({
  id: true,
  createdAt: true,
});

export type SerialStage = typeof serialStages.$inferSelect;
export type InsertSerialStage = z.infer<typeof insertSerialStageSchema>;

// ============================================================================
// SERIAL STAGE FILES
// ============================================================================
export const serialStageFiles = pgTable("serial_stage_files", {
  id: serial("id").primaryKey(),
  stageId: integer("stage_id")
    .notNull()
    .references(() => serialStages.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  path: text("path").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const serialStageFilesRelations = relations(serialStageFiles, ({ one }) => ({
  stage: one(serialStages, {
    fields: [serialStageFiles.stageId],
    references: [serialStages.id],
  }),
}));

export const insertSerialStageFileSchema = createInsertSchema(serialStageFiles).omit({
  id: true,
  createdAt: true,
});

export type SerialStageFile = typeof serialStageFiles.$inferSelect;
export type InsertSerialStageFile = z.infer<typeof insertSerialStageFileSchema>;

// ============================================================================
// SERIAL PROGRESS
// ============================================================================
export const serialProgress = pgTable(
  "serial_progress",
  {
    id: serial("id").primaryKey(),
    serialChallengeId: integer("serial_challenge_id")
      .notNull()
      .references(() => serialChallenges.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .references(() => teams.id, { onDelete: "set null" }),
    ctfEventId: integer("ctf_event_id")
      .notNull()
      .references(() => ctfEvents.id, { onDelete: "cascade" }),
    currentStage: integer("current_stage").notNull().default(1),
    totalPointsEarned: integer("total_points_earned").notNull().default(0),
    isComplete: boolean("is_complete").notNull().default(false),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    uniqueUserChallenge: unique().on(table.userId, table.serialChallengeId),
  })
);

export const serialProgressRelations = relations(serialProgress, ({ one }) => ({
  serialChallenge: one(serialChallenges, {
    fields: [serialProgress.serialChallengeId],
    references: [serialChallenges.id],
  }),
  user: one(users, {
    fields: [serialProgress.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [serialProgress.teamId],
    references: [teams.id],
  }),
  ctfEvent: one(ctfEvents, {
    fields: [serialProgress.ctfEventId],
    references: [ctfEvents.id],
  }),
}));

export const insertSerialProgressSchema = createInsertSchema(serialProgress).omit({
  id: true,
  startedAt: true,
});

export type SerialProgress = typeof serialProgress.$inferSelect;
export type InsertSerialProgress = z.infer<typeof insertSerialProgressSchema>;

// ============================================================================
// SERIAL STAGE SUBMISSIONS (all attempts)
// ============================================================================
export const serialStageSubmissions = pgTable("serial_stage_submissions", {
  id: serial("id").primaryKey(),
  stageId: integer("stage_id")
    .notNull()
    .references(() => serialStages.id, { onDelete: "cascade" }),
  serialChallengeId: integer("serial_challenge_id")
    .notNull()
    .references(() => serialChallenges.id, { onDelete: "cascade" }),
  ctfEventId: integer("ctf_event_id")
    .notNull()
    .references(() => ctfEvents.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: integer("team_id")
    .references(() => teams.id, { onDelete: "set null" }),
  flag: text("flag").notNull(), // Submitted flag
  isCorrect: boolean("is_correct").notNull(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
});

export const serialStageSubmissionsRelations = relations(serialStageSubmissions, ({ one }) => ({
  stage: one(serialStages, {
    fields: [serialStageSubmissions.stageId],
    references: [serialStages.id],
  }),
  serialChallenge: one(serialChallenges, {
    fields: [serialStageSubmissions.serialChallengeId],
    references: [serialChallenges.id],
  }),
  ctfEvent: one(ctfEvents, {
    fields: [serialStageSubmissions.ctfEventId],
    references: [ctfEvents.id],
  }),
  user: one(users, {
    fields: [serialStageSubmissions.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [serialStageSubmissions.teamId],
    references: [teams.id],
  }),
}));

export type SerialStageSubmission = typeof serialStageSubmissions.$inferSelect;
export type InsertSerialStageSubmission = typeof serialStageSubmissions.$inferInsert;

// ============================================================================
// SERIAL STAGE SOLVES
// ============================================================================
export const serialStageSolves = pgTable(
  "serial_stage_solves",
  {
    id: serial("id").primaryKey(),
    stageId: integer("stage_id")
      .notNull()
      .references(() => serialStages.id, { onDelete: "cascade" }),
    serialChallengeId: integer("serial_challenge_id")
      .notNull()
      .references(() => serialChallenges.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .references(() => teams.id, { onDelete: "set null" }),
    ctfEventId: integer("ctf_event_id")
      .notNull()
      .references(() => ctfEvents.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    isFirstBlood: boolean("is_first_blood").notNull().default(false),
    solvedAt: timestamp("solved_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserStage: unique().on(table.userId, table.stageId),
  })
);

export const serialStageSolvesRelations = relations(serialStageSolves, ({ one }) => ({
  stage: one(serialStages, {
    fields: [serialStageSolves.stageId],
    references: [serialStages.id],
  }),
  serialChallenge: one(serialChallenges, {
    fields: [serialStageSolves.serialChallengeId],
    references: [serialChallenges.id],
  }),
  user: one(users, {
    fields: [serialStageSolves.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [serialStageSolves.teamId],
    references: [teams.id],
  }),
  ctfEvent: one(ctfEvents, {
    fields: [serialStageSolves.ctfEventId],
    references: [ctfEvents.id],
  }),
}));

export const insertSerialStageSolveSchema = createInsertSchema(serialStageSolves).omit({
  id: true,
  solvedAt: true,
});

export type SerialStageSolve = typeof serialStageSolves.$inferSelect;
export type InsertSerialStageSolve = z.infer<typeof insertSerialStageSolveSchema>;
