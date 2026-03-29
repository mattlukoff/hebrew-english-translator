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
  const totalChars = verses.reduce((sum, v) => sum + v.hebrew.length, 0);
  const batchSize = totalChars > 20000 ? 5 : totalChars > 8000 ? 10 : 20;

  const batches: { chapter: number; verse: number; hebrew: string }[][] = [];
  for (let i = 0; i < verses.length; i += batchSize) {
    batches.push(verses.slice(i, i + batchSize));
  }

  const systemPrompt = `You are an expert biblical Hebrew translator. Translate the following Hebrew text into clear, readable English. 
Rules:
- Be faithful to the original meaning but produce natural English
- Preserve verse structure exactly as given
- Maintain theological precision
- Do not paraphrase excessively
- For each verse, output ONLY the English translation on a new line, prefixed with the same verse reference [chapter:verse]
- Do not add any commentary or notes${bookContext ? `\nContext: This text is from ${bookContext}` : ""}`;

  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const versesText = batch
        .map((v) => `[${v.chapter}:${v.verse}] ${stripHtml(v.hebrew)}`)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: versesText },
        ],
      });

      const content = response.choices[0]?.message?.content || "";
      const lines = content.split("\n").filter((l) => l.trim());

      const parsed: TranslationVerse[] = [];
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

        parsed.push({
          chapter: v.chapter,
          verse: v.verse,
          hebrew: v.hebrew,
          english: english || "(Translation unavailable)",
        });
      }
      return parsed;
    })
  );

  return batchResults.flat();
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

      const indexRes = await fetch(`https://www.sefaria.org/api/index/${encodeURIComponent(title)}`);
      if (!indexRes.ok) throw new Error("Sefaria API error");
      const indexData = await indexRes.json();
      const schema = indexData.schema;

      if (schema?.nodes) {
        const shapeRes = await fetch(`https://www.sefaria.org/api/shape/${encodeURIComponent(title)}`);
        if (!shapeRes.ok) throw new Error("Sefaria shape API error");
        const shapeData = await shapeRes.json();
        const shapeArr = Array.isArray(shapeData) ? shapeData : [shapeData];
        const rawShapeSections = shapeArr[0]?.chapters || [];

        const shapeSections: { title: string; heTitle: string; length: number; chapters: number[] | number }[] = [];
        function collectShapeSections(items: any[]) {
          for (const item of items) {
            if (item && typeof item === "object" && item.title) {
              const chaps = item.chapters;
              shapeSections.push({
                title: item.title,
                heTitle: item.heTitle || "",
                length: item.length || 0,
                chapters: chaps,
              });
            }
          }
        }
        collectShapeSections(rawShapeSections);

        interface SectionInfo {
          title: string;
          heTitle: string;
          refPrefix: string;
          chapters: number[];
          length: number;
        }
        const sections: SectionInfo[] = [];

        if (shapeSections.length > 0) {
          for (const ss of shapeSections) {
            const refPrefix = ss.title;
            let chaptersArr: number[];
            if (typeof ss.chapters === "number") {
              // Depth-1 text: N paragraphs addressed directly as Section.1 … Section.N
              // Create N chapters (one per paragraph) with 0 drillable sub-verses.
              chaptersArr = Array.from({ length: ss.chapters }, () => 0);
            } else if (Array.isArray(ss.chapters)) {
              chaptersArr = ss.chapters.map((c: any) => typeof c === "number" ? c : 0);
            } else {
              chaptersArr = ss.length > 0 ? Array.from({ length: ss.length }, () => 0) : [1];
            }

            const displayTitle = ss.title.replace(`${title}, `, "");

            sections.push({
              title: displayTitle,
              heTitle: ss.heTitle.replace(/^[^,]+, /, ""),
              refPrefix,
              chapters: chaptersArr,
              length: chaptersArr.length,
            });
          }
        } else if (schema.nodes && Array.isArray(schema.nodes)) {
          const schemaNodes = schema.nodes;
          const mainShapeChapters = rawShapeSections;

          for (const node of schemaNodes) {
            const nodeName = node.titles?.find((t: any) => t.lang === "en" && t.primary)?.text || node.key;
            const nodeHeName = node.titles?.find((t: any) => t.lang === "he" && t.primary)?.text || nodeName;
            const isDefault = node.default === true;
            const depth = node.depth || 2;

            if (!isDefault) {
              const nodeShapeRes = await fetch(`https://www.sefaria.org/api/shape/${encodeURIComponent(title + ", " + nodeName)}`);
              if (nodeShapeRes.ok) {
                const nodeShapeData = await nodeShapeRes.json();
                const nodeShape = Array.isArray(nodeShapeData) ? nodeShapeData[0] : nodeShapeData;
                const nodeChapters = nodeShape?.chapters || [];
                const chaptersArr = nodeChapters.map((c: any) => typeof c === "number" ? c : 0);

                sections.push({
                  title: nodeName,
                  heTitle: nodeHeName,
                  refPrefix: `${title}, ${nodeName}`,
                  chapters: chaptersArr,
                  length: chaptersArr.length,
                });
              }
            } else if (depth >= 3 && Array.isArray(mainShapeChapters)) {
              for (let gateIdx = 0; gateIdx < mainShapeChapters.length; gateIdx++) {
                const gateData = mainShapeChapters[gateIdx];
                const gateNum = gateIdx + 1;
                let chaptersArr: number[];

                if (Array.isArray(gateData)) {
                  chaptersArr = gateData.map((c: any) => typeof c === "number" ? c : 0);
                } else if (typeof gateData === "number") {
                  chaptersArr = [gateData];
                } else {
                  chaptersArr = [0];
                }

                const sectionLabel = (node.sectionNames && node.sectionNames[0]) || "Gate";

                sections.push({
                  title: `${sectionLabel} ${gateNum}`,
                  heTitle: `${nodeHeName} ${gateNum}`,
                  refPrefix: `${title}.${gateNum}`,
                  chapters: chaptersArr,
                  length: chaptersArr.length,
                });
              }
            } else if (Array.isArray(mainShapeChapters)) {
              const chaptersArr = mainShapeChapters.map((c: any) => typeof c === "number" ? c : 0);
              sections.push({
                title: title,
                heTitle: nodeHeName,
                refPrefix: title,
                chapters: chaptersArr,
                length: chaptersArr.length,
              });
            }
          }
        }

        res.json({
          title: schema.title || title,
          heTitle: schema.heTitle || title,
          isComplex: true,
          sections,
        });
      } else {
        const shapeRes = await fetch(`https://www.sefaria.org/api/shape/${encodeURIComponent(title)}`);
        if (!shapeRes.ok) throw new Error("Sefaria shape API error");
        const shapeData = await shapeRes.json();
        const shape = Array.isArray(shapeData) ? shapeData[0] : shapeData;
        const rawChapters = shape?.chapters || [];

        function flattenChapters(chapters: any[]): number[] {
          const result: number[] = [];
          for (const ch of chapters) {
            if (typeof ch === "number") {
              result.push(ch);
            } else if (ch && typeof ch === "object") {
              if (typeof ch.chapters === "number") {
                result.push(ch.chapters);
              } else if (Array.isArray(ch.chapters)) {
                result.push(...flattenChapters(ch.chapters));
              } else if (typeof ch.length === "number" && ch.length > 0) {
                result.push(ch.length);
              } else {
                result.push(0);
              }
            }
          }
          return result;
        }

        const chapters = flattenChapters(rawChapters);

        res.json({
          title: shape?.title || title,
          heTitle: shape?.heTitle || title,
          isComplex: false,
          length: chapters.length,
          chapters,
        });
      }
    } catch (error) {
      console.error("Sefaria shape error:", error);
      res.status(500).json({ error: "Failed to fetch text shape" });
    }
  });

  async function fetchAndParseSefariaRef(ref: string): Promise<{ chapter: number; verse: number; hebrew: string }[]> {
    const sefariaUrl = `https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}?context=0`;
    console.log("Fetching Sefaria text:", ref, "URL:", sefariaUrl);
    const sefariaRes = await fetch(sefariaUrl);
    if (!sefariaRes.ok) {
      const errorBody = await sefariaRes.text();
      console.error("Sefaria API error body:", errorBody);
      throw new Error(`Sefaria API returned ${sefariaRes.status}: ${errorBody}`);
    }
    const sefariaData = await sefariaRes.json();

    if (sefariaData.error) {
      throw new Error(sefariaData.error);
    }

    const hebrewTexts = flattenHebrewText(sefariaData.he);
    const sections = sefariaData.sections || [1];
    const isChapter = hebrewTexts.length > 1;

    return hebrewTexts
      .filter((t) => t && stripHtml(t).trim())
      .map((heText, idx) => ({
        chapter: isChapter ? sections[0] || 1 : (sections[0] || 1),
        verse: isChapter ? idx + 1 : (sections[1] || idx + 1),
        hebrew: heText,
      }));
  }

  app.post("/api/translate/sefaria", async (req, res) => {
    try {
      const { ref, refs, title } = req.body;

      const refsToFetch: string[] = refs && Array.isArray(refs) ? refs : ref ? [ref] : [];
      if (refsToFetch.length === 0) {
        return res.status(400).json({ error: "Reference is required" });
      }

      const allChapterResults = await Promise.all(
        refsToFetch.map((r: string) => fetchAndParseSefariaRef(r))
      );
      const versesToTranslate = allChapterResults.flat();

      if (versesToTranslate.length === 0) {
        return res.status(400).json({ error: "No Hebrew text found for this reference" });
      }

      const displayRef = refsToFetch.length === 1 ? refsToFetch[0] : `${title || refsToFetch[0]} (${refsToFetch.length} chapters)`;

      const translatedVerses = await translateVerses(versesToTranslate, title || displayRef);

      const saved = await storage.createTranslation({
        title: title || displayRef,
        sourceRef: displayRef,
        verses: translatedVerses,
      });

      res.json({
        verses: translatedVerses,
        title: title || displayRef,
        sourceRef: displayRef,
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
