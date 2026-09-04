import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// NOTE: these tables are the primary, multi-tenant data store (Postgres via Neon).
// Every row that belongs to a project or its history/effort log carries an
// `ownerId` so every query can be scoped to the signed-in user.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  description: text("description").notNull().default(""),
  version: text("version").notNull().default(""),
  platforms: jsonb("platforms")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  tools: jsonb("tools")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  startDate: text("start_date").notNull(),
  modifiedAt: timestamp("modified_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
  githubUrl: text("github_url").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  status: text("status").notNull().default("Planning"),
  documentation: text("documentation").notNull().default(""),
  documentationUpdatedAt: timestamp("documentation_updated_at", { mode: "string", withTimezone: true }),
});

export const documentationHistory = pgTable("documentation_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectName: text("project_name").notNull(),
  documentation: text("documentation").notNull(),
  reason: text("reason").notNull(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
  repository: text("repository"),
  branch: text("branch"),
  commitMessages: jsonb("commit_messages").$type<string[]>(),
});

export const effortEntries = pgTable("effort_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectName: text("project_name").notNull(),
  actor: text("actor").notNull(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { mode: "string", withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { mode: "string", withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  notes: text("notes").notNull().default(""),
  idleMinutesExcluded: integer("idle_minutes_excluded").default(0),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true }).notNull().defaultNow(),
});
