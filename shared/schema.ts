import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const translations = pgTable("translations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceRef: text("source_ref"),
  verses: jsonb("verses").notNull().$type<TranslationVerse[]>(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertTranslationSchema = createInsertSchema(translations).omit({
  id: true,
  createdAt: true,
});

export type InsertTranslation = z.infer<typeof insertTranslationSchema>;
export type Translation = typeof translations.$inferSelect;

export interface TranslationVerse {
  chapter: number;
  verse: number;
  hebrew: string;
  english: string;
}

export interface SefariaTextResponse {
  he: string[] | string[][] | string;
  text: string[] | string[][] | string;
  ref: string;
  heRef: string;
  sections: number[];
  toSections: number[];
  sectionNames: string[];
  book: string;
  categories: string[];
  length?: number;
}

export interface SefariaIndexEntry {
  title: string;
  heTitle: string;
  categories: string[];
  order?: number[];
  schema?: {
    nodes?: { title: string; heTitle: string; depth: number; sectionNames: string[] }[];
    sectionNames?: string[];
  };
}

export const translateRequestSchema = z.object({
  verses: z.array(z.object({
    chapter: z.number(),
    verse: z.number(),
    hebrew: z.string(),
  })),
  context: z.string().optional(),
});

export type TranslateRequest = z.infer<typeof translateRequestSchema>;
