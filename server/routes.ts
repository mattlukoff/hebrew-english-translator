import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import type { TranslationVerse } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function flattenHebrewText(he: any): string[] {
  if (typeof he === "string") return [he];
  if (Array.isArray(he)) {
    const result: string[] = [];
    for (const item of he) {
      if (typeof item === "string") {
        result.push(item);
      } else if (Array.isArray(item)) {
        result.push(...item.map((s: any) => (typeof s === "string" ? s : String(s))));
      }
    }
    return result;
  }
  return [String(he)];
}

async function translateVerses(
  verses: { chapter: number; verse: number; hebrew: string }[],
  bookContext?: string
): Promise<TranslationVerse[]> {
  const batchSize = 15;
  const results: TranslationVerse[] = [];

  for (let i = 0; i < verses.length; i += batchSize) {
    const batch = verses.slice(i, i + batchSize);
    const versesText = batch
      .map((v) => `[${v.chapter}:${v.verse}] ${stripHtml(v.hebrew)}`)
      .join("\n");

    const systemPrompt = `You are an expert biblical Hebrew translator. Translate the following Hebrew text into clear, readable English. 
Rules:
- Be faithful to the original meaning but produce natural English
- Preserve verse structure exactly as given
- Maintain theological precision
- Do not paraphrase excessively
- For each verse, output ONLY the English translation on a new line, prefixed with the same verse reference [chapter:verse]
- Do not add any commentary or notes${bookContext ? `\nContext: This text is from ${bookContext}` : ""}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: versesText },
      ],
      max_completion_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content || "";
    const lines = content.split("\n").filter((l) => l.trim());

    for (let j = 0; j < batch.length; j++) {
      const v = batch[j];
      let english = "";

      const pattern = new RegExp(`\\[${v.chapter}:${v.verse}\\]\\s*(.+)`);
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          english = match[1].trim();
          break;
        }
      }

      if (!english && lines[j]) {
        english = lines[j].replace(/^\[\d+:\d+\]\s*/, "").trim();
      }

      results.push({
        chapter: v.chapter,
        verse: v.verse,
        hebrew: v.hebrew,
        english: english || "(Translation unavailable)",
      });
    }
  }

  return results;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/translations", async (_req, res) => {
    try {
      const translations = await storage.getTranslations();
      res.json(translations);
    } catch (error) {
      console.error("Error fetching translations:", error);
      res.status(500).json({ error: "Failed to fetch translations" });
    }
  });

  let cachedLibraryIndex: any = null;
  let cacheTimestamp = 0;
  const CACHE_TTL = 1000 * 60 * 60;

  app.get("/api/sefaria/library", async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedLibraryIndex && now - cacheTimestamp < CACHE_TTL) {
        return res.json(cachedLibraryIndex);
      }
      const response = await fetch("https://www.sefaria.org/api/index/");
      if (!response.ok) throw new Error("Sefaria API error");
      const data = await response.json();

      function simplifyNode(node: any): any {
        if (node.category) {
          return {
            category: node.category,
            heCategory: node.heCategory || node.category,
            contents: (node.contents || []).map(simplifyNode).filter(Boolean),
          };
        }
        if (node.title) {
          return {
            title: node.title,
            heTitle: node.heTitle || node.title,
          };
        }
        return null;
      }

      cachedLibraryIndex = data.map(simplifyNode).filter(Boolean);
      cacheTimestamp = now;
      res.json(cachedLibraryIndex);
    } catch (error) {
      console.error("Sefaria library error:", error);
      res.status(500).json({ error: "Failed to fetch library index" });
    }
  });

  app.get("/api/sefaria/index/:title", async (req, res) => {
    try {
      const { title } = req.params;
      const response = await fetch(`https://www.sefaria.org/api/index/${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error("Sefaria API error");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Sefaria index error:", error);
      res.status(500).json({ error: "Failed to fetch text index" });
    }
  });

  app.get("/api/sefaria/shape/:title", async (req, res) => {
    try {
      const { title } = req.params;
      const response = await fetch(`https://www.sefaria.org/api/shape/${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error("Sefaria API error");
      const data = await response.json();
      const shape = Array.isArray(data) ? data[0] : data;
      res.json({
        title: shape?.title || title,
        heTitle: shape?.heTitle || title,
        length: shape?.length || 0,
        chapters: shape?.chapters || [],
      });
    } catch (error) {
      console.error("Sefaria shape error:", error);
      res.status(500).json({ error: "Failed to fetch text shape" });
    }
  });

  app.post("/api/translate/sefaria", async (req, res) => {
    try {
      const { ref, title } = req.body;
      if (!ref) {
        return res.status(400).json({ error: "Reference is required" });
      }

      const sefariaUrl = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0`;
      const sefariaRes = await fetch(sefariaUrl);
      if (!sefariaRes.ok) {
        throw new Error(`Sefaria API returned ${sefariaRes.status}`);
      }
      const sefariaData = await sefariaRes.json();

      if (sefariaData.error) {
        throw new Error(sefariaData.error);
      }

      const hebrewTexts = flattenHebrewText(sefariaData.he);
      const sections = sefariaData.sections || [1];
      const isChapter = hebrewTexts.length > 1;

      const versesToTranslate = hebrewTexts
        .filter((t) => t && stripHtml(t).trim())
        .map((heText, idx) => ({
          chapter: isChapter ? sections[0] || 1 : (sections[0] || 1),
          verse: isChapter ? idx + 1 : (sections[1] || idx + 1),
          hebrew: heText,
        }));

      if (versesToTranslate.length === 0) {
        return res.status(400).json({ error: "No Hebrew text found for this reference" });
      }

      const translatedVerses = await translateVerses(versesToTranslate, title || ref);

      const saved = await storage.createTranslation({
        title: title || ref,
        sourceRef: ref,
        verses: translatedVerses,
      });

      res.json({
        verses: translatedVerses,
        title: title || ref,
        sourceRef: ref,
        id: saved.id,
      });
    } catch (error: any) {
      console.error("Translation error:", error);
      res.status(500).json({ error: error.message || "Translation failed" });
    }
  });

  app.post("/api/translate/custom", async (req, res) => {
    try {
      const { text, title } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      const lines = text.split("\n").filter((l: string) => l.trim());
      const versesToTranslate = lines.map((line: string, idx: number) => ({
        chapter: 1,
        verse: idx + 1,
        hebrew: line.trim(),
      }));

      const translatedVerses = await translateVerses(versesToTranslate, title);

      const saved = await storage.createTranslation({
        title: title || "Custom Text",
        sourceRef: null,
        verses: translatedVerses,
      });

      res.json({
        verses: translatedVerses,
        title: title || "Custom Text",
        id: saved.id,
      });
    } catch (error: any) {
      console.error("Custom translation error:", error);
      res.status(500).json({ error: error.message || "Translation failed" });
    }
  });

  app.post("/api/export/pdf", async (req, res) => {
    try {
      const { verses, title, sourceRef } = req.body;
      if (!verses || !Array.isArray(verses)) {
        return res.status(400).json({ error: "Verses are required" });
      }

      let textContent = `${title}\n`;
      if (sourceRef) textContent += `Source: ${sourceRef}\n`;
      textContent += `${"=".repeat(50)}\n\n`;

      let currentChapter = -1;
      for (const v of verses) {
        if (v.chapter !== currentChapter) {
          currentChapter = v.chapter;
          textContent += `\n--- Chapter ${v.chapter} ---\n\n`;
        }
        const cleanHebrew = stripHtml(v.hebrew);
        textContent += `[${v.chapter}:${v.verse}]\n`;
        textContent += `Hebrew: ${cleanHebrew}\n`;
        textContent += `English: ${v.english}\n\n`;
      }

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${title.replace(/\s+/g, "_")}_translation.txt"`);
      res.send(textContent);
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Export failed" });
    }
  });

  return httpServer;
}
