import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SefariaBrowser } from "@/components/sefaria-browser";
import { FileUpload } from "@/components/file-upload";
import { TranslationDisplay } from "@/components/translation-display";
import { TranslationSkeleton } from "@/components/translation-skeleton";
import { HistoryList } from "@/components/history-list";
import { Header } from "@/components/header";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Library, Upload } from "lucide-react";
import type { VerseData } from "@/lib/types";
import type { Translation } from "@shared/schema";

export default function Home() {
  const [verses, setVerses] = useState<VerseData[]>([]);
  const [translationTitle, setTranslationTitle] = useState("");
  const [sourceRef, setSourceRef] = useState("");
  const { toast } = useToast();

  const translateMutation = useMutation({
    mutationFn: async ({
      ref,
      title,
      refs,
    }: {
      ref: string;
      title: string;
      refs?: string[];
    }) => {
      const body: Record<string, unknown> = { title };
      if (refs && refs.length > 0) {
        body.refs = refs;
      } else {
        body.ref = ref;
      }
      const res = await apiRequest("POST", "/api/translate/sefaria", body);
      return res.json();
    },
    onSuccess: (data: { verses: VerseData[]; title: string; sourceRef: string }) => {
      setVerses(data.verses);
      setTranslationTitle(data.title);
      setSourceRef(data.sourceRef);
      queryClient.invalidateQueries({ queryKey: ["/api/translations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Translation failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const translateCustomMutation = useMutation({
    mutationFn: async ({
      text,
      fileName,
    }: {
      text: string;
      fileName: string;
    }) => {
      const res = await apiRequest("POST", "/api/translate/custom", {
        text,
        title: fileName,
      });
      return res.json();
    },
    onSuccess: (data: { verses: VerseData[]; title: string }) => {
      setVerses(data.verses);
      setTranslationTitle(data.title);
      setSourceRef("");
      queryClient.invalidateQueries({ queryKey: ["/api/translations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Translation failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSefariaSelect = useCallback(
    (ref: string, title: string) => {
      translateMutation.mutate({ ref, title });
    },
    [translateMutation]
  );

  const handleMultipleChapters = useCallback(
    (refs: string[], title: string) => {
      translateMutation.mutate({ ref: "", title, refs } as any);
    },
    [translateMutation]
  );

  const handleCustomText = useCallback(
    (text: string, fileName: string) => {
      translateCustomMutation.mutate({ text, fileName });
    },
    [translateCustomMutation]
  );

  const handleHistorySelect = useCallback((translation: Translation) => {
    setVerses(translation.verses as VerseData[]);
    setTranslationTitle(translation.title);
    setSourceRef(translation.sourceRef || "");
  }, []);

  const isTranslating = translateMutation.isPending || translateCustomMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <aside className="space-y-4">
            <Tabs defaultValue="library">
              <TabsList className="w-full">
                <TabsTrigger value="library" className="flex-1" data-testid="tab-library">
                  <Library className="w-3.5 h-3.5 mr-1.5" />
                  Library
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1" data-testid="tab-upload">
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  Upload
                </TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="mt-3">
                <SefariaBrowser
                  onSelectText={handleSefariaSelect}
                  onSelectMultipleChapters={handleMultipleChapters}
                  isTranslating={isTranslating}
                />
              </TabsContent>
              <TabsContent value="upload" className="mt-3">
                <FileUpload
                  onSubmitText={handleCustomText}
                  isTranslating={isTranslating}
                />
              </TabsContent>
            </Tabs>

            <HistoryList onSelectTranslation={handleHistorySelect} />
          </aside>

          <section className="min-w-0">
            {isTranslating ? (
              <TranslationSkeleton />
            ) : verses.length > 0 ? (
              <TranslationDisplay
                verses={verses}
                title={translationTitle}
                sourceRef={sourceRef}
              />
            ) : (
              <EmptyState />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Library className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <h2 className="text-lg font-semibold mb-1" data-testid="text-empty-title">
        Select a Text to Translate
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Browse the Sefaria library to choose a biblical text, or upload your own Hebrew document for translation.
      </p>
    </div>
  );
}
