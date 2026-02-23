import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BookOpen, ChevronRight, Search, ArrowLeft, Loader2, FolderOpen } from "lucide-react";

interface CategoryNode {
  category: string;
  heCategory: string;
  contents: (CategoryNode | BookNode)[];
}

interface BookNode {
  title: string;
  heTitle: string;
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
  const [selectionMode, setSelectionMode] = useState<"chapter" | "range">("chapter");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [fromChapter, setFromChapter] = useState<string>("");
  const [fromVerse, setFromVerse] = useState<string>("");
  const [toChapter, setToChapter] = useState<string>("");
  const [toVerse, setToVerse] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: library, isLoading: loadingLibrary } = useQuery<(CategoryNode | BookNode)[]>({
    queryKey: ["/api/sefaria/library"],
  });

  const { data: bookInfo, isLoading: loadingBook } = useQuery({
    queryKey: ["/api/sefaria/index", selectedBook?.title],
    enabled: !!selectedBook,
  });

  const chapterCount = (bookInfo as any)?.schema?.lengths?.[0] ||
    (bookInfo as any)?.length ||
    50;

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
    return [{ label: "Library", node: null }, ...path.map(p => ({ label: p.category, node: p }))];
  }, [path]);

  const handleTranslate = () => {
    if (!selectedBook) return;
    let ref = selectedBook.title;
    if (selectionMode === "chapter" && selectedChapter) {
      ref = `${selectedBook.title}.${selectedChapter}`;
    } else if (selectionMode === "range" && fromChapter && fromVerse) {
      if (toChapter && toVerse) {
        ref = `${selectedBook.title}.${fromChapter}.${fromVerse}-${toChapter}.${toVerse}`;
      } else {
        ref = `${selectedBook.title}.${fromChapter}.${fromVerse}`;
      }
    }
    onSelectText(ref, selectedBook.title);
  };

  const handleBack = () => {
    if (selectedBook) {
      setSelectedBook(null);
      setSelectedChapter("");
      setFromChapter("");
      setFromVerse("");
      setToChapter("");
      setToVerse("");
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
    setSearchQuery("");
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      setPath([]);
    } else {
      setPath(prev => prev.slice(0, index));
    }
    setSearchQuery("");
  };

  if (selectedBook) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Button size="icon" variant="ghost" onClick={handleBack} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate" data-testid="text-selected-book">{selectedBook.title}</h3>
            <p className="text-xs text-muted-foreground font-hebrew" dir="rtl">{selectedBook.heTitle}</p>
          </div>
        </div>

        {loadingBook ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={selectionMode === "chapter" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectionMode("chapter")}
                data-testid="button-mode-chapter"
              >
                Chapter
              </Button>
              <Button
                variant={selectionMode === "range" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectionMode("range")}
                data-testid="button-mode-range"
              >
                Verse Range
              </Button>
            </div>

            {selectionMode === "chapter" ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Select Chapter</Label>
                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                  <SelectTrigger data-testid="select-chapter">
                    <SelectValue placeholder="Choose a chapter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: chapterCount }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Chapter {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Chapter</Label>
                  <Input
                    type="number"
                    min={1}
                    max={chapterCount}
                    value={fromChapter}
                    onChange={(e) => setFromChapter(e.target.value)}
                    placeholder="Ch."
                    data-testid="input-from-chapter"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Verse</Label>
                  <Input
                    type="number"
                    min={1}
                    value={fromVerse}
                    onChange={(e) => setFromVerse(e.target.value)}
                    placeholder="Vs."
                    data-testid="input-from-verse"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Chapter</Label>
                  <Input
                    type="number"
                    min={1}
                    max={chapterCount}
                    value={toChapter}
                    onChange={(e) => setToChapter(e.target.value)}
                    placeholder="Ch."
                    data-testid="input-to-chapter"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Verse</Label>
                  <Input
                    type="number"
                    min={1}
                    value={toVerse}
                    onChange={(e) => setToVerse(e.target.value)}
                    placeholder="Vs."
                    data-testid="input-to-verse"
                  />
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleTranslate}
              disabled={isTranslating || (selectionMode === "chapter" && !selectedChapter) || (selectionMode === "range" && (!fromChapter || !fromVerse))}
              data-testid="button-translate"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Translating...
                </>
              ) : (
                "Translate"
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
                onClick={() => handleBreadcrumbClick(i)}
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
