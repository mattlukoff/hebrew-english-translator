import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, FileText, Columns2, AlignJustify } from "lucide-react";
import type { VerseData, ViewMode } from "@/lib/types";

interface Props {
  verses: VerseData[];
  title: string;
  sourceRef?: string;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export function TranslationDisplay({ verses, title, sourceRef }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("interlinear");

  const handleExportCSV = async () => {
    const headers = "Chapter,Verse,Hebrew,English\n";
    const rows = verses
      .map(
        (v) =>
          `${v.chapter},${v.verse},"${stripHtmlTags(v.hebrew).replace(/"/g, '""')}","${v.english.replace(/"/g, '""')}"`
      )
      .join("\n");
    const csv = headers + rows;
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}_translation.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportText = async () => {
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verses, title, sourceRef }),
      });
      if (!response.ok) throw new Error("Text export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "_")}_translation.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      handleExportCSV();
    }
  };

  const handleExportPDF = () => {
    const chapterGroups = [...new Set(verses.map((v) => v.chapter))];

    let bodyHtml = "";
    for (const ch of chapterGroups) {
      const chVerses = verses.filter((v) => v.chapter === ch);
      bodyHtml += `<h2>Chapter ${ch}</h2>`;
      for (const v of chVerses) {
        const cleanHebrew = stripHtmlTags(v.hebrew);
        bodyHtml += `
          <div class="verse-block">
            <div class="verse-ref">${v.chapter}:${v.verse}</div>
            <div class="hebrew" dir="rtl">${cleanHebrew}</div>
            <div class="english">${v.english}</div>
          </div>`;
      }
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Crimson Pro', Georgia, serif; color: #111; background: #fff; padding: 40px 50px; max-width: 720px; margin: 0 auto; line-height: 1.6; }
    .title-block { text-align: center; margin-bottom: 8px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .source-ref { font-size: 13px; color: #666; }
    hr { border: none; border-top: 1px solid #ccc; margin: 14px 0 22px 0; }
    h2 { font-size: 15px; font-weight: 700; margin: 28px 0 14px 0; padding-bottom: 4px; border-bottom: 1px solid #ddd; page-break-after: avoid; }
    .verse-block { margin-bottom: 18px; page-break-inside: avoid; }
    .verse-ref { font-size: 10px; font-weight: 600; color: #999; letter-spacing: 0.05em; margin-bottom: 3px; }
    .hebrew { font-family: 'Frank Ruhl Libre', 'David Libre', serif; font-size: 17px; line-height: 1.9; text-align: right; margin-bottom: 5px; }
    .english { font-size: 14px; line-height: 1.75; color: #222; }
    @media print {
      body { padding: 20px 30px; }
      h2 { page-break-after: avoid; }
      .verse-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="title-block">
    <h1>${title}</h1>
    ${sourceRef ? `<div class="source-ref">${sourceRef}</div>` : ""}
  </div>
  <hr>
  ${bodyHtml}
  <script>
    document.fonts.ready.then(function() {
      window.print();
    });
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  const currentChapters = [...new Set(verses.map((v) => v.chapter))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold truncate" data-testid="text-translation-title">{title}</h2>
          {sourceRef && (
            <p className="text-xs text-muted-foreground" data-testid="text-source-ref">{sourceRef}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="interlinear" data-testid="button-view-interlinear">
                <AlignJustify className="w-3.5 h-3.5 mr-1.5" />
                Interlinear
              </TabsTrigger>
              <TabsTrigger value="side-by-side" data-testid="button-view-sidebyside">
                <Columns2 className="w-3.5 h-3.5 mr-1.5" />
                Side by Side
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
          <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
          CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportText} data-testid="button-export-txt">
          <FileText className="w-3.5 h-3.5 mr-1.5" />
          Text
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
          <Download className="w-3.5 h-3.5 mr-1.5" />
          PDF
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        {viewMode === "interlinear" ? (
          <InterlinearView verses={verses} chapters={currentChapters} />
        ) : (
          <SideBySideView verses={verses} chapters={currentChapters} />
        )}
      </ScrollArea>
    </div>
  );
}

function InterlinearView({
  verses,
  chapters,
}: {
  verses: VerseData[];
  chapters: number[];
}) {
  return (
    <div className="space-y-6">
      {chapters.map((ch) => {
        const chVerses = verses.filter((v) => v.chapter === ch);
        return (
          <div key={ch}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">
                Chapter {ch}
              </Badge>
            </div>
            <div className="space-y-3">
              {chVerses.map((v) => (
                <Card
                  key={`${v.chapter}-${v.verse}`}
                  className="p-3 sm:p-4"
                  data-testid={`card-verse-${v.chapter}-${v.verse}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 pt-0.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold">
                        {v.verse}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <p
                        dir="rtl"
                        className="font-hebrew text-lg leading-relaxed text-foreground"
                        data-testid={`text-hebrew-${v.chapter}-${v.verse}`}
                        dangerouslySetInnerHTML={{ __html: v.hebrew }}
                      />
                      <p
                        className="font-serif text-base leading-relaxed text-muted-foreground"
                        data-testid={`text-english-${v.chapter}-${v.verse}`}
                      >
                        {v.english}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SideBySideView({
  verses,
  chapters,
}: {
  verses: VerseData[];
  chapters: number[];
}) {
  return (
    <div className="space-y-6">
      {chapters.map((ch) => {
        const chVerses = verses.filter((v) => v.chapter === ch);
        return (
          <div key={ch}>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="text-xs">
                Chapter {ch}
              </Badge>
            </div>
            <Card className="overflow-visible">
              <div className="grid grid-cols-2 divide-x">
                <div className="p-4" dir="rtl">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 text-right">עברית</p>
                  <div className="space-y-3">
                    {chVerses.map((v) => (
                      <div key={`he-${v.chapter}-${v.verse}`} className="flex gap-2">
                        <span className="inline-flex items-start justify-center flex-shrink-0 w-5 h-5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold mt-1">
                          {v.verse}
                        </span>
                        <p
                          className="font-hebrew text-base leading-relaxed flex-1"
                          dangerouslySetInnerHTML={{ __html: v.hebrew }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-3">English</p>
                  <div className="space-y-3">
                    {chVerses.map((v) => (
                      <div key={`en-${v.chapter}-${v.verse}`} className="flex gap-2">
                        <span className="inline-flex items-start justify-center flex-shrink-0 w-5 h-5 rounded-md bg-muted text-muted-foreground text-[10px] font-semibold mt-1">
                          {v.verse}
                        </span>
                        <p className="font-serif text-base leading-relaxed flex-1">
                          {v.english}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
