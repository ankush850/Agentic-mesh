/**
 * Input Panel Component (FR-U4, FR-I1, FR-I2).
 * Handles multi-language paste tabs, drag-and-drop files or folders, file uploads,
 * size cap enforcement, and displays skipped file notifications.
 */

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Upload, FileCode, Trash2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { TSO_CONFIG, shouldIgnoreFile, detectLanguage, type SupportedLanguage } from "../config";
import { toast } from "../../store/toast";

export interface LoadedFile {
  fileName: string;
  language: SupportedLanguage;
  content: string;
  size: number;
  lineCount: number;
}

interface InputPanelProps {
  files: LoadedFile[];
  onFilesChanged: (files: LoadedFile[]) => void;
  onLoadSample: () => void;
  onClear: () => void;
  isLoading?: boolean;
}

export function InputPanel({
  files,
  onFilesChanged,
  onLoadSample,
  onClear,
  isLoading = false,
}: InputPanelProps) {
  const [activeTab, setActiveTab] = useState<SupportedLanguage>("html");
  const [pastedContent, setPastedContent] = useState<Record<SupportedLanguage, string>>({
    html: "",
    css: "",
    js: "",
  });
  const [isDragging, setIsDragging] = useState(false);
  const [skippedNotice, setSkippedNotice] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync pasted content with loaded files when files change externally (e.g. Load sample)
  const currentFile = files.find((f) => f.language === activeTab);
  const currentContent = currentFile ? currentFile.content : pastedContent[activeTab];

  function handlePasteChange(value: string) {
    setPastedContent((prev) => ({ ...prev, [activeTab]: value }));

    // Update loaded files
    const existingIndex = files.findIndex((f) => f.language === activeTab);
    const fileName = `input.${activeTab}`;
    const size = new Blob([value]).size;
    const lineCount = value.split("\n").length;

    if (value.trim().length === 0) {
      if (existingIndex !== -1) {
        onFilesChanged(files.filter((_, idx) => idx !== existingIndex));
      }
      return;
    }

    // Size limit check (FR-I2)
    if (size > TSO_CONFIG.MAX_FILE_SIZE_BYTES) {
      toast.error(
        "File size cap exceeded",
        `${fileName} (${Math.round(size / 1024)} KB) exceeds 1 MB limit.`,
      );
      return;
    }

    const updatedFile: LoadedFile = {
      fileName,
      language: activeTab,
      content: value,
      size,
      lineCount,
    };

    if (existingIndex !== -1) {
      const next = [...files];
      next[existingIndex] = updatedFile;
      onFilesChanged(next);
    } else {
      onFilesChanged([...files, updatedFile]);
    }
  }

  async function processFiles(fileList: FileList | File[]) {
    const newFiles: LoadedFile[] = [...files];
    const skipped: string[] = [];
    let totalSize = files.reduce((acc, f) => acc + f.size, 0);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const relPath = (file as any).webkitRelativePath || file.name;

      // Check ignore list (FR-I1)
      const ignoreCheck = shouldIgnoreFile(file.name, relPath);
      if (ignoreCheck.ignore) {
        skipped.push(`${file.name} (${ignoreCheck.reason})`);
        continue;
      }

      // Detect language (FR-I1)
      const lang = detectLanguage(file.name);
      if (!lang) {
        skipped.push(`${file.name} (unsupported language)`);
        continue;
      }

      // Check single file size cap (FR-I2)
      if (file.size > TSO_CONFIG.MAX_FILE_SIZE_BYTES) {
        skipped.push(`${file.name} (exceeds 1 MB cap: ${Math.round(file.size / 1024)} KB)`);
        continue;
      }

      // Check total size cap (FR-I2)
      if (totalSize + file.size > TSO_CONFIG.MAX_TOTAL_SIZE_BYTES) {
        skipped.push(`${file.name} (exceeds total 5 MB cap)`);
        continue;
      }

      try {
        const text = await file.text();
        // Check for minified lines over 5000 chars (FR-I2)
        const lines = text.split(/\r?\n/);
        const hasOverlongLine = lines.some((line) => line.length > TSO_CONFIG.MAX_LINE_LENGTH_CHARS);
        if (hasOverlongLine) {
          skipped.push(`${file.name} (contains line > 5,000 chars, treated as minified)`);
          continue;
        }

        // Normalize CRLF to LF and strip UTF-8 BOM (FR-I2)
        const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
        const idx = newFiles.findIndex((f) => f.fileName === file.name);

        const loaded: LoadedFile = {
          fileName: file.name,
          language: lang,
          content: normalized,
          size: file.size,
          lineCount: lines.length,
        };

        if (idx !== -1) {
          newFiles[idx] = loaded;
        } else {
          newFiles.push(loaded);
        }
        totalSize += file.size;
      } catch (err) {
        skipped.push(`${file.name} (read error)`);
      }
    }

    setSkippedNotice(skipped);
    onFilesChanged(newFiles);

    if (skipped.length > 0) {
      toast.warning("Some files were skipped", `${skipped.length} file(s) ignored per configuration.`);
    } else {
      toast.success("Files loaded successfully", `${newFiles.length} file(s) ready for analysis.`);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFiles(e.dataTransfer.files);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      void processFiles(e.target.files);
    }
  }

  return (
    <div className="surface-card flex flex-col gap-4 p-5">
      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-accent" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight text-fg">Input Codebase</h2>
          <Badge tone={files.length > 0 ? "passed" : "queued"}>
            {files.length} {files.length === 1 ? "file" : "files"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onLoadSample} disabled={isLoading}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Load Sample
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPastedContent({ html: "", css: "", js: "" });
              setSkippedNotice([]);
              onClear();
            }}
            disabled={files.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            aria-label="Upload files or folder"
          />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" aria-hidden />
            Upload Files / Folder
          </Button>
        </div>
      </div>

      {/* Drag & drop dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-4 text-center transition-colors ${
          isDragging
            ? "border-accent bg-accent/10 text-accent"
            : "border-line bg-surface-2 text-muted hover:border-line-strong hover:text-fg"
        }`}
      >
        <p className="text-xs font-medium">
          Drag & drop .html, .css, or .js files or folders here (max 1 MB / file, 5 MB total)
        </p>
      </div>

      {/* Skipped files notice (FR-I1, FR-I2) */}
      {skippedNotice.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-healed/40 bg-healed/10 p-3 text-xs text-healed">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">Skipped files notice:</p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5">
              {skippedNotice.slice(0, 4).map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
              {skippedNotice.length > 4 && <li>...and {skippedNotice.length - 4} more</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Language tabs & direct paste area */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 border-b border-line pb-1">
          {(["html", "css", "js"] as SupportedLanguage[]).map((lang) => {
            const hasFile = files.some((f) => f.language === lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveTab(lang)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === lang
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {lang} {hasFile ? "✓" : ""}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <textarea
            value={currentContent}
            onChange={(e) => handlePasteChange(e.target.value)}
            placeholder={`Paste raw ${activeTab.toUpperCase()} content here...`}
            rows={7}
            className="w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-xs text-fg placeholder:text-muted focus:border-accent focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

