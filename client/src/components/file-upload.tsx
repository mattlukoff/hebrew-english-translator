import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onSubmitText: (text: string, fileName: string) => void;
  isTranslating: boolean;
}

export function FileUpload({ onSubmitText, isTranslating }: Props) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
    } else {
      toast({
        title: "Unsupported file type",
        description: "Please upload a .txt file with Hebrew text.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearFile = () => {
    setText("");
    setFileName(null);
  };

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-1">Custom Text</h3>
      <p className="text-xs text-muted-foreground mb-3">Paste or upload Hebrew text to translate</p>

      {fileName ? (
        <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-card border border-card-border">
          <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-xs truncate flex-1">{fileName}</span>
          <Button size="icon" variant="ghost" onClick={clearFile} data-testid="button-clear-file">
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-md p-6 text-center mb-3 transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          data-testid="dropzone"
        >
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground mb-2">Drag & drop a .txt file here</p>
          <label>
            <input
              type="file"
              accept=".txt"
              className="hidden"
              onChange={handleFileInput}
              data-testid="input-file-upload"
            />
            <Button variant="outline" size="sm" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
        </div>
      )}

      <div className="space-y-1.5 mb-3">
        <Textarea
          dir="rtl"
          placeholder="...או הדביקו טקסט עברי כאן"
          value={text}
          onChange={(e) => { setText(e.target.value); if (!fileName) setFileName(null); }}
          className="min-h-[120px] font-hebrew text-base leading-relaxed resize-none"
          data-testid="textarea-hebrew-input"
        />
      </div>

      <Button
        className="w-full"
        onClick={() => onSubmitText(text, fileName || "Custom Text")}
        disabled={!text.trim() || isTranslating}
        data-testid="button-translate-custom"
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
    </Card>
  );
}
