import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, ChevronRight, Search, ArrowLeft, Loader2, FolderOpen, CheckSquare, Square } from "lucide-react";

interface CategoryNode {
  category: string;
  heCategory: string;
  contents: (CategoryNode | BookNode)[];
}

interface BookNode {
  title: string;
  heTitle: string;
}

interface SectionInfo {
  title: string;
  heTitle: string;
  refPrefix: string;
  chapters: number[];
  length: number;
}

interface SimpleShapeData {
  title: string;
  heTitle: string;
  isComplex: false;
  length: number;
  chapters: number[];
}

interface ComplexShapeData {
  title: string;
  heTitle: string;
  isComplex: true;
  sections: SectionInfo[];
}

type ShapeData = SimpleShapeData | ComplexShapeData;

function isCategory(node: CategoryNode | BookNode): node is CategoryNode {
  return "category" in node;
}

function isBook(node: CategoryNode | BookNode): node is BookNode {
  return "title" in node;
}

function countBooks(node: CategoryNode | BookNode): number {
  if (isBook(node)) return 1;
  return node.contents.reduce((sum, child) => sum + countBooks(child), 0);
}

function searchTree(nodes: (CategoryNode | BookNode)[], query: string): BookNode[] {
  const results: BookNode[] = [];
  const lower = query.toLowerCase();
  for (const node of nodes) {
    if (isBook(node)) {
      if (node.title.toLowerCase().includes(lower) || node.heTitle.includes(query)) {
        results.push(node);
      }
    } else {
      results.push(...searchTree(node.contents, query));
    }
  }
  return results;
}

function findParentCategory(nodes: (CategoryNode | BookNode)[], book: BookNode): string {
  for (const node of nodes) {
    if (isCategory(node)) {
      for (const child of node.contents) {
        if (isBook(child) && child.title === book.title) return node.category;
      }
      const found = findParentCategory(node.contents, book);
      if (found) return `${node.category} › ${found}`;
    }
  }
  return "";
}

interface Props {
  onSelectText: (ref: string, title: string) => void;
  onSelectMultipleChapters?: (refs: string[], title: string) => void;
  isTranslating: boolean;
}

export function SefariaBrowser({ onSelectText, onSelectMultipleChapters, isTranslating }: Props) {
  const [path, setPath] = useState<CategoryNode[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookNode | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionInfo | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());
  const [fromVerse, setFromVerse] = useState<number | null>(null);
  const [toVerse, setToVerse] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: library, isLoading: loadingLibrary } = useQuery<(CategoryNode | BookNode)[]>({
    queryKey: ["/api/sefaria/library"],
  });

  const { data: shapeData, isLoading: loadingShape } = useQuery<ShapeData>({
    queryKey: ["/api/sefaria/shape", selectedBook?.title],
    enabled: !!selectedBook,
  });

  const isComplex = shapeData?.isComplex === true;

  const chapterCount = useMemo(() => {
    if (!shapeData) return 0;
    if (shapeData.isComplex) {
      return selectedSection?.length || 0;
    }
    return shapeData.length || 0;
  }, [shapeData, selectedSection]);

  const chaptersArray = useMemo(() => {
    if (!shapeData) return [];
    if (shapeData.isComplex) {
      return selectedSection?.chapters || [];
    }
    return shapeData.chapters || [];
  }, [shapeData, selectedSection]);

  const verseCount = selectedChapter !== null && chaptersArray.length > 0
    ? chaptersArray[selectedChapter - 1] || 0
    : 0;

  const currentItems = useMemo(() => {
    if (!library) return [];
    if (path.length === 0) return library;
    return path[path.length - 1].contents;
  }, [library, path]);

  const searchResults = useMemo(() => {
    if (!searchQuery || !library) return [];
    return searchTree(library, searchQuery).slice(0, 50);
  }, [library, searchQuery]);

  const breadcrumb = useMemo(() => {
    const crumbs: { label: string; action: () => void }[] = [
      { label: "Library", action: () => { setPath([]); setSelectedBook(null); setSelectedSection(null); setSelectedChapter(null); setSelectedChapters(new Set()); setFromVerse(null); setToVerse(null); setSearchQuery(""); } },
    ];
    path.forEach((_, i) => {
      const idx = i;
      crumbs.push({
        label: path[idx].category,
        action: () => { setPath(prev => prev.slice(0, idx + 1)); setSelectedBook(null); setSelectedSection(null); setSelectedChapter(null); setSelectedChapters(new Set()); setFromVerse(null); setToVerse(null); setSearchQuery(""); },
      });
    });
    if (selectedBook) {
      crumbs.push({
        label: selectedBook.title,
        action: () => { setSelectedSection(null); setSelectedChapter(null); setSelectedChapters(new Set()); setFromVerse(null); setToVerse(null); },
      });
    }
    if (selectedSection) {
      crumbs.push({
        label: selectedSection.title,
        action: () => { setSelectedChapter(null); setSelectedChapters(new Set()); setFromVerse(null); setToVerse(null); },
      });
    }
    if (selectedChapter !== null) {
      crumbs.push({
        label: `Chapter ${selectedChapter}`,
        action: () => { setFromVerse(null); setToVerse(null); },
      });
    }
    return crumbs;
  }, [path, selectedBook, selectedSection, selectedChapter]);

  const buildRef = (ch: number | null, startV: number | null, endV: number | null): string => {
    if (!selectedBook) return "";
    const base = isComplex && selectedSection
      ? selectedSection.refPrefix
      : selectedBook.title;

    if (ch === null) return base;
    if (startV !== null && endV !== null && startV !== endV) {
      return `${base}.${ch}.${startV}-${ch}.${endV}`;
    }
    if (startV !== null) {
      return `${base}.${ch}.${startV}`;
    }
    return `${base}.${ch}`;
  };

  const handleTranslate = () => {
    if (!selectedBook || selectedChapter === null) return;
    const ref = buildRef(selectedChapter, fromVerse, toVerse);
    onSelectText(ref, selectedBook.title);
  };

  const handleTranslateMultiChapters = () => {
    if (!selectedBook || selectedChapters.size === 0) return;
    const base = isComplex && selectedSection
      ? selectedSection.refPrefix
      : selectedBook.title;
    const sortedChapters = [...selectedChapters].sort((a, b) => a - b);
    const refs = sortedChapters.map(ch => `${base}.${ch}`);
    if (onSelectMultipleChapters) {
      onSelectMultipleChapters(refs, selectedBook.title);
    }
  };

  const selectionSummary = useMemo(() => {
    if (!selectedBook || selectedChapter === null) return "";
    const prefix = selectedSection ? `${selectedSection.title} ` : `${selectedBook.title} `;
    if (fromVerse !== null && toVerse !== null && fromVerse !== toVerse) {
      return `${prefix}${selectedChapter}:${fromVerse}-${toVerse}`;
    }
    if (fromVerse !== null) {
      return `${prefix}${selectedChapter}:${fromVerse}`;
    }
    return `${prefix}${selectedChapter} (full chapter)`;
  }, [selectedBook, selectedSection, selectedChapter, fromVerse, toVerse]);

  const multiChapterSummary = useMemo(() => {
    if (!selectedBook || selectedChapters.size === 0) return "";
    const prefix = selectedSection ? `${selectedSection.title}` : `${selectedBook.title}`;
    const sorted = [...selectedChapters].sort((a, b) => a - b);
    if (sorted.length <= 5) {
      return `${prefix} Ch. ${sorted.join(", ")}`;
    }
    return `${prefix} — ${sorted.length} chapters`;
  }, [selectedBook, selectedSection, selectedChapters]);

  const handleBack = () => {
    if (fromVerse !== null || toVerse !== null) {
      setFromVerse(null);
      setToVerse(null);
    } else if (selectedChapter !== null) {
      setSelectedChapter(null);
    } else if (selectedSection) {
      setSelectedSection(null);
      setSelectedChapters(new Set());
    } else if (selectedBook) {
      setSelectedBook(null);
      setSelectedSection(null);
      setSelectedChapters(new Set());
    } else if (path.length > 0) {
      setPath(prev => prev.slice(0, -1));
    }
  };

  const handleCategoryClick = (cat: CategoryNode) => {
    setPath(prev => [...prev, cat]);
    setSearchQuery("");
  };

  const handleBookClick = (book: BookNode) => {
    setSelectedBook(book);
    setSelectedSection(null);
    setSelectedChapter(null);
    setSelectedChapters(new Set());
    setFromVerse(null);
    setToVerse(null);
    setSearchQuery("");
  };

  const handleSectionClick = (section: SectionInfo) => {
    setSelectedSection(section);
    setSelectedChapter(null);
    setSelectedChapters(new Set());
    setFromVerse(null);
    setToVerse(null);
  };

  const handleChapterToggle = (ch: number) => {
    setSelectedChapters(prev => {
      const next = new Set(prev);
      if (next.has(ch)) {
        next.delete(ch);
      } else {
        next.add(ch);
      }
      return next;
    });
  };

  const handleChapterDrillDown = (ch: number) => {
    const verses = chaptersArray[ch - 1] || 0;
    if (verses === 0) {
      handleChapterToggle(ch);
      return;
    }
    setSelectedChapter(ch);
    setSelectedChapters(new Set());
    setFromVerse(null);
    setToVerse(null);
  };

  const handleSelectAll = () => {
    const all = new Set(Array.from({ length: chapterCount }, (_, i) => i + 1));
    setSelectedChapters(all);
  };

  const handleClearChapters = () => {
    setSelectedChapters(new Set());
  };

  const handleVerseClick = (v: number) => {
    if (fromVerse === null) {
      setFromVerse(v);
      setToVerse(v);
    } else if (toVerse === fromVerse && v !== fromVerse) {
      const lo = Math.min(fromVerse, v);
      const hi = Math.max(fromVerse, v);
      setFromVerse(lo);
      setToVerse(hi);
    } else {
      setFromVerse(v);
      setToVerse(v);
    }
  };

  if (selectedBook) {
    const showSections = isComplex && !selectedSection;
    const showChapters = (!isComplex || selectedSection) && selectedChapter === null;
    const showVerses = selectedChapter !== null;

    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Button size="icon" variant="ghost" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap" data-testid="breadcrumb-nav">
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                  <button
                    className={`hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}`}
                    onClick={crumb.action}
                    data-testid={`breadcrumb-${i}`}
                  >
                    {crumb.label}
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {loadingShape ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : showSections && shapeData?.isComplex ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select a section — {shapeData.sections.length} sections available
            </p>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {shapeData.sections.map((section) => (
                  <button
                    key={section.refPrefix}
                    className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    onClick={() => handleSectionClick(section)}
                    data-testid={`button-section-${section.title}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block truncate">{section.title}</span>
                      <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">{section.heTitle}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{section.length} ch</Badge>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : showChapters ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {chapterCount} chapters — click to select{chaptersArray.some(v => v > 0) ? ", double-click to pick verses" : ""}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={handleSelectAll}
                  data-testid="button-select-all-chapters"
                >
                  All
                </Button>
                {selectedChapters.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={handleClearChapters}
                    data-testid="button-clear-chapters"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {Array.from({ length: chapterCount }, (_, i) => {
                  const ch = i + 1;
                  const verses = chaptersArray[i] || 0;
                  const isSelected = selectedChapters.has(ch);
                  return (
                    <button
                      key={ch}
                      className={`relative flex flex-col items-center justify-center rounded-md border px-1 py-2 text-sm transition-colors ${
                        isSelected
                          ? "bg-primary/15 border-primary/40 text-foreground"
                          : "hover:bg-accent hover:border-primary/30"
                      }`}
                      onClick={() => handleChapterToggle(ch)}
                      onDoubleClick={() => handleChapterDrillDown(ch)}
                      data-testid={`button-chapter-${ch}`}
                    >
                      {isSelected && (
                        <CheckSquare className="absolute top-0.5 right-0.5 w-3 h-3 text-primary" />
                      )}
                      <span className="font-medium">{ch}</span>
                      {verses > 0 && <span className="text-[10px] text-muted-foreground">{verses}v</span>}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {selectedChapters.size > 0 && (
              <>
                <div className="rounded-md bg-muted/50 px-3 py-2 text-sm" data-testid="text-multi-chapter-summary">
                  <span className="text-muted-foreground">Selection: </span>
                  <span className="font-medium">{multiChapterSummary}</span>
                </div>

                <Button
                  className="w-full"
                  onClick={handleTranslateMultiChapters}
                  disabled={isTranslating}
                  data-testid="button-translate-chapters"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Translating...
                    </>
                  ) : (
                    `Translate ${selectedChapters.size} chapter${selectedChapters.size > 1 ? "s" : ""}`
                  )}
                </Button>
              </>
            )}
          </div>
        ) : showVerses ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {verseCount} verses — click to select a verse, click again to set range
              </p>
              {fromVerse !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6 px-2"
                  onClick={() => { setFromVerse(null); setToVerse(null); }}
                  data-testid="button-clear-selection"
                >
                  Clear
                </Button>
              )}
            </div>
            <ScrollArea className="h-[220px]">
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {Array.from({ length: verseCount }, (_, i) => {
                  const v = i + 1;
                  const isSelected = fromVerse !== null && toVerse !== null && v >= fromVerse && v <= toVerse;
                  const isEndpoint = v === fromVerse || v === toVerse;
                  return (
                    <button
                      key={v}
                      className={`rounded-md border px-1 py-1.5 text-sm transition-colors ${
                        isEndpoint
                          ? "bg-primary text-primary-foreground border-primary"
                          : isSelected
                          ? "bg-primary/15 border-primary/30 text-foreground"
                          : "hover:bg-accent hover:border-primary/30"
                      }`}
                      onClick={() => handleVerseClick(v)}
                      data-testid={`button-verse-${v}`}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {selectionSummary && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm" data-testid="text-selection-summary">
                <span className="text-muted-foreground">Selection: </span>
                <span className="font-medium">{selectionSummary}</span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleTranslate}
              disabled={isTranslating}
              data-testid="button-translate"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                `Translate ${selectionSummary}`
              )}
            </Button>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 flex-wrap" data-testid="breadcrumb-nav">
          {breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
              <button
                className={`hover:text-foreground transition-colors ${i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}`}
                onClick={crumb.action}
                data-testid={`breadcrumb-${i}`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Browse and select a text to translate</p>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search all texts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 text-sm"
          data-testid="input-search-books"
        />
      </div>

      <ScrollArea className="h-[340px]">
        {loadingLibrary ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : searchQuery ? (
          <div className="space-y-1">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No texts found matching "{searchQuery}"</p>
            ) : (
              searchResults.map((book) => (
                <button
                  key={book.title}
                  className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  onClick={() => handleBookClick(book)}
                  data-testid={`button-book-${book.title}`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{book.title}</span>
                    <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">{book.heTitle}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] max-w-[120px] truncate">
                    {library ? findParentCategory(library, book).split(" › ").pop() : ""}
                  </Badge>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {currentItems.map((item) =>
              isCategory(item) ? (
                <button
                  key={item.category}
                  className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  onClick={() => handleCategoryClick(item)}
                  data-testid={`button-category-${item.category}`}
                >
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{item.category}</span>
                    <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">{item.heCategory}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{countBooks(item)}</Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              ) : isBook(item) ? (
                <button
                  key={item.title}
                  className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  onClick={() => handleBookClick(item)}
                  data-testid={`button-book-${item.title}`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">{item.heTitle}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ) : null
            )}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
