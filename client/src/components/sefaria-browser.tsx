import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, ChevronRight, Search, ArrowLeft, Loader2, FolderOpen, Hash } from "lucide-react";

interface CategoryNode {
  category: string;
  heCategory: string;
  contents: (CategoryNode | BookNode)[];
}

interface BookNode {
  title: string;
  heTitle: string;
}

interface ShapeData {
  title: string;
  heTitle: string;
  length: number;
  chapters: number[];
}

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
  isTranslating: boolean;
}

export function SefariaBrowser({ onSelectText, isTranslating }: Props) {
  const [path, setPath] = useState<CategoryNode[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookNode | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
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

  const chapterCount = shapeData?.length || 0;
  const verseCount = selectedChapter !== null && shapeData?.chapters
    ? shapeData.chapters[selectedChapter - 1] || 0
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
      { label: "Library", action: () => { setPath([]); setSelectedBook(null); setSelectedChapter(null); setFromVerse(null); setToVerse(null); setSearchQuery(""); } },
    ];
    path.forEach((_, i) => {
      const idx = i;
      crumbs.push({
        label: path[idx].category,
        action: () => { setPath(prev => prev.slice(0, idx + 1)); setSelectedBook(null); setSelectedChapter(null); setFromVerse(null); setToVerse(null); setSearchQuery(""); },
      });
    });
    if (selectedBook) {
      crumbs.push({
        label: selectedBook.title,
        action: () => { setSelectedChapter(null); setFromVerse(null); setToVerse(null); },
      });
    }
    if (selectedChapter !== null) {
      crumbs.push({
        label: `Chapter ${selectedChapter}`,
        action: () => { setFromVerse(null); setToVerse(null); },
      });
    }
    return crumbs;
  }, [path, selectedBook, selectedChapter]);

  const handleTranslate = () => {
    if (!selectedBook || selectedChapter === null) return;
    let ref: string;
    if (fromVerse !== null && toVerse !== null && fromVerse !== toVerse) {
      ref = `${selectedBook.title}.${selectedChapter}.${fromVerse}-${selectedChapter}.${toVerse}`;
    } else if (fromVerse !== null) {
      ref = `${selectedBook.title}.${selectedChapter}.${fromVerse}`;
    } else {
      ref = `${selectedBook.title}.${selectedChapter}`;
    }
    onSelectText(ref, selectedBook.title);
  };

  const handleBack = () => {
    if (fromVerse !== null || toVerse !== null) {
      setFromVerse(null);
      setToVerse(null);
    } else if (selectedChapter !== null) {
      setSelectedChapter(null);
    } else if (selectedBook) {
      setSelectedBook(null);
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
    setSelectedChapter(null);
    setFromVerse(null);
    setToVerse(null);
    setSearchQuery("");
  };

  const handleChapterClick = (ch: number) => {
    setSelectedChapter(ch);
    setFromVerse(null);
    setToVerse(null);
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

  const selectionSummary = useMemo(() => {
    if (!selectedBook || selectedChapter === null) return "";
    const base = `${selectedBook.title} ${selectedChapter}`;
    if (fromVerse !== null && toVerse !== null && fromVerse !== toVerse) {
      return `${base}:${fromVerse}-${toVerse}`;
    }
    if (fromVerse !== null) {
      return `${base}:${fromVerse}`;
    }
    return `${base} (full chapter)`;
  }, [selectedBook, selectedChapter, fromVerse, toVerse]);

  if (selectedBook) {
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
        ) : selectedChapter === null ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select a chapter — {chapterCount} chapters available
            </p>
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {Array.from({ length: chapterCount }, (_, i) => {
                  const ch = i + 1;
                  const verses = shapeData?.chapters?.[i] || 0;
                  return (
                    <button
                      key={ch}
                      className="flex flex-col items-center justify-center rounded-md border px-1 py-2 text-sm hover:bg-accent hover:border-primary/30 transition-colors"
                      onClick={() => handleChapterClick(ch)}
                      data-testid={`button-chapter-${ch}`}
                    >
                      <span className="font-medium">{ch}</span>
                      <span className="text-[10px] text-muted-foreground">{verses}v</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        ) : (
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
        )}
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
