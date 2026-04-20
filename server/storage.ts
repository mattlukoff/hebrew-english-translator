import { db } from "./db";
import { translations, type InsertTranslation, type Translation } from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getTranslations(): Promise<Translation[]>;
  createTranslation(data: InsertTranslation): Promise<Translation>;
}

export class DatabaseStorage implements IStorage {
  async getTranslations(): Promise<Translation[]> {
    return db.select().from(translations).orderBy(desc(translations.createdAt)).limit(20);
  }

  async createTranslation(data: InsertTranslation): Promise<Translation> {
    const [translation] = await db.insert(translations).values(data).returning();
    return translation;
  }
}

export const storage = new DatabaseStorage();
