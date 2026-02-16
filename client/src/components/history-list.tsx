import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ChevronRight } from "lucide-react";
import type { Translation } from "@shared/schema";

interface Props {
  onSelectTranslation: (translation: Translation) => void;
}

export function HistoryList({ onSelectTranslation }: Props) {
  const { data: translations, isLoading } = useQuery<Translation[]>({
    queryKey: ["/api/translations"],
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Recent Translations</h3>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!translations?.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Recent Translations</h3>
        <div className="py-6 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No translations yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Your translations will appear here</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">Recent Translations</h3>
      <ScrollArea className="h-[200px]">
        <div className="space-y-1">
          {translations.map((t) => (
            <button
              key={t.id}
              className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left hover-elevate active-elevate-2 transition-colors"
              onClick={() => onSelectTranslation(t)}
              data-testid={`button-history-${t.id}`}
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium block truncate">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {(t.verses as any[]).length} verses
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                {new Date(t.createdAt).toLocaleDateString()}
              </Badge>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
