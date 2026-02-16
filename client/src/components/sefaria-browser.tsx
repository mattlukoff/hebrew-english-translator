import { useState } from "react";
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
import { BookOpen, ChevronRight, Search, ArrowLeft, Loader2 } from "lucide-react";

interface SefariaBook {
  title: string;
  heTitle: string;
  categories: string[];
}

interface Props {
  onSelectText: (ref: string, title: string) => void;
  isTranslating: boolean;
}

const TORAH_BOOKS = [
  { title: "Genesis", heTitle: "בראשית" },
  { title: "Exodus", heTitle: "שמות" },
  { title: "Leviticus", heTitle: "ויקרא" },
  { title: "Numbers", heTitle: "במדבר" },
  { title: "Deuteronomy", heTitle: "דברים" },
];

const PROPHETS = [
  { title: "Joshua", heTitle: "יהושע" },
  { title: "Judges", heTitle: "שופטים" },
  { title: "I Samuel", heTitle: "שמואל א" },
  { title: "II Samuel", heTitle: "שמואל ב" },
  { title: "I Kings", heTitle: "מלכים א" },
  { title: "II Kings", heTitle: "מלכים ב" },
  { title: "Isaiah", heTitle: "ישעיהו" },
  { title: "Jeremiah", heTitle: "ירמיהו" },
  { title: "Ezekiel", heTitle: "יחזקאל" },
];

const WRITINGS = [
  { title: "Psalms", heTitle: "תהלים" },
  { title: "Proverbs", heTitle: "משלי" },
  { title: "Job", heTitle: "איוב" },
  { title: "Song of Songs", heTitle: "שיר השירים" },
  { title: "Ruth", heTitle: "רות" },
  { title: "Lamentations", heTitle: "איכה" },
  { title: "Ecclesiastes", heTitle: "קהלת" },
  { title: "Esther", heTitle: "אסתר" },
  { title: "Daniel", heTitle: "דניאל" },
  { title: "Ezra", heTitle: "עזרא" },
  { title: "Nehemiah", heTitle: "נחמיה" },
  { title: "I Chronicles", heTitle: "דברי הימים א" },
  { title: "II Chronicles", heTitle: "דברי הימים ב" },
];

const CATEGORIES = [
  { name: "Torah", books: TORAH_BOOKS },
  { name: "Prophets", books: PROPHETS },
  { name: "Writings", books: WRITINGS },
];

export function SefariaBrowser({ onSelectText, isTranslating }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<{ title: string; heTitle: string } | null>(null);
  const [selectionMode, setSelectionMode] = useState<"chapter" | "range">("chapter");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [fromChapter, setFromChapter] = useState<string>("");
  const [fromVerse, setFromVerse] = useState<string>("");
  const [toChapter, setToChapter] = useState<string>("");
  const [toVerse, setToVerse] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: bookInfo, isLoading: loadingBook } = useQuery({
    queryKey: ["/api/sefaria/index", selectedBook?.title],
    enabled: !!selectedBook,
  });

  const chapterCount = (bookInfo as any)?.schema?.lengths?.[0] ||
    (bookInfo as any)?.length ||
    (selectedBook?.title === "Psalms" ? 150 : 50);

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
    } else {
      setSelectedCategory(null);
    }
  };

  const filteredCategories = searchQuery
    ? CATEGORIES.map((cat) => ({
        ...cat,
        books: cat.books.filter(
          (b) =>
            b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.heTitle.includes(searchQuery)
        ),
      })).filter((cat) => cat.books.length > 0)
    : CATEGORIES;

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
      <div className="flex items-center gap-2 mb-4">
        {selectedCategory && (
          <Button size="icon" variant="ghost" onClick={handleBack} data-testid="button-back-cat">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">
            {selectedCategory || "Sefaria Library"}
          </h3>
          <p className="text-xs text-muted-foreground">Browse and select a text to translate</p>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search books..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 text-sm"
          data-testid="input-search-books"
        />
      </div>

      <ScrollArea className="h-[340px]">
        <div className="space-y-1">
          {!selectedCategory ? (
            filteredCategories.map((cat) => (
              <div key={cat.name}>
                {searchQuery ? (
                  cat.books.map((book) => (
                    <button
                      key={book.title}
                      className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover-elevate active-elevate-2 transition-colors"
                      onClick={() => setSelectedBook(book)}
                      data-testid={`button-book-${book.title}`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block truncate">{book.title}</span>
                        <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">{book.heTitle}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{cat.name}</Badge>
                    </button>
                  ))
                ) : (
                  <button
                    className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover-elevate active-elevate-2 transition-colors"
                    onClick={() => setSelectedCategory(cat.name)}
                    data-testid={`button-category-${cat.name}`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground block">{cat.books.length} books</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            ))
          ) : (
            CATEGORIES.find((c) => c.name === selectedCategory)?.books
              .filter(
                (b) =>
                  !searchQuery ||
                  b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  b.heTitle.includes(searchQuery)
              )
              .map((book) => (
                <button
                  key={book.title}
                  className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover-elevate active-elevate-2 transition-colors"
                  onClick={() => setSelectedBook(book)}
                  data-testid={`button-book-${book.title}`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium block">{book.title}</span>
                    <span className="text-xs text-muted-foreground font-hebrew" dir="rtl">{book.heTitle}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              ))
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
