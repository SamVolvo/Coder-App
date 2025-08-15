import React, { useEffect, useMemo, useRef, useState } from "react";
import SettingsModal from "./components/SettingsModal";
import CodeDisplay from "./components/CodeDisplay";
// If you don't have CodeDisplay, comment it out or swap for your component.

export type AiProvider = "gemini" | "chatgpt" | "ollama";

export interface GeneratedFile {
  fileName: string;
  code: string;
}
export interface GenerateResult {
  files: GeneratedFile[];
  readmeContent?: string;
}

// If you have real services, keep these imports.
// If names differ, adjust the imports or stub the calls below.
import * as geminiService from "./services/geminiService";
import * as chatgptService from "./services/chatgptService";
import * as ollamaService from "./services/ollamaService";

const SYSTEM_INSTRUCTIONS = `
You are a world-class senior software engineer acting as a coding assistant.
- The user will provide the context of their current project files, followed by their request. You MUST use this context to inform your response.
- Your response MUST be a single JSON object: { "files": [{ "fileName": "...", "code": "..." }], "readmeContent": "..." }.
- For each file, "fileName" MUST be the full, relative path including directories.
- "code" must be the raw, complete code for that file.
- "readmeContent" must be the full content for a README.md file formatted as markdown.
- When asked to update, respond with the FULL updated code for ALL relevant files and an updated readmeContent in the same JSON format.
`.trim();

const needsCloudKey = (p: AiProvider) => p === "gemini" || p === "chatgpt";

export default function App() {
  // Provider / model
  const [aiProvider, setAiProvider] = useState<AiProvider>("gemini");
  const [model, setModel] = useState<string>("gemini-2.5-flash");

  // Provider-aware key (fixes “apiKey is not defined”)
  const [providerApiKey, setProviderApiKey] = useState<string | undefined>();

  // UI state (keep yours / add as needed)
  const [prompt, setPrompt] = useState<string>("");
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [readmeContent, setReadmeContent] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load correct key whenever provider changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!needsCloudKey(aiProvider)) {
          if (!cancelled) setProviderApiKey("ollama-local"); // marker; not actually used
          return;
        }
        if (aiProvider === "chatgpt") {
          const k = await window.electronAPI.getChatgptApiKey();
          if (!cancelled) setProviderApiKey(k ?? undefined);
        } else {
          const k = await window.electronAPI.getGeminiApiKey();
          if (!cancelled) setProviderApiKey(k ?? undefined);
        }
      } catch {
        if (!cancelled) setProviderApiKey(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aiProvider]);

  // Legacy compatibility: if your old code used `apiKey`/`storedKey`
  const apiKey = providerApiKey;
  const storedKey = providerApiKey;

  const hasKey = useMemo(() => !needsCloudKey(aiProvider) || Boolean(providerApiKey), [aiProvider, providerApiKey]);

  // Optional: your image attach flow
  const handlePickImage = () => fileInputRef.current?.click();
  const handleImageSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result?.toString() || undefined);
    reader.readAsDataURL(f);
    e.currentTarget.value = "";
  };

  // Helpers for results list
  const addFile = (fileName: string, code: string) => {
    setFiles((prev) => {
      const i = prev.findIndex((f) => f.fileName === fileName);
      if (i >= 0) {
        const copy = prev.slice();
        copy[i] = { fileName, code };
        return copy;
      }
      return [...prev, { fileName, code }];
    });
  };
  const removeFile = (fileName: string) => setFiles((prev) => prev.filter((f) => f.fileName !== fileName));

  // Generate
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert("Please enter a prompt.");
      return;
    }
    if (!hasKey) {
      alert("Please add your API key in Settings.");
      return;
    }

    setIsGenerating(true);
    try {
      const context = { system: SYSTEM_INSTRUCTIONS, prompt, files, imageDataUrl, model };

      let result: GenerateResult | undefined;
      // NOTE: do NOT compare to 'openai' – your union is 'chatgpt'
      if (aiProvider === "gemini") {
        // @ts-ignore tolerant call — adapt to your service’s signature
        result = await (geminiService as any).generateCode?.(context);
      } else if (aiProvider === "chatgpt") {
        // @ts-ignore
        result = await (chatgptService as any).generateCode?.(context);
      } else {
        // @ts-ignore
        result = await (ollamaService as any).generateCode?.(context);
      }

      if (!result) throw new Error("No response from the AI service.");
      setFiles(result.files ?? []);
      setReadmeContent(result.readmeContent ?? "");
    } catch (e: any) {
      console.error("[App] Generate failed:", e);
      alert(e?.message || "Generation failed. Check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  // After saving settings, refresh the in-memory key so the UI updates
  const handleSettingsSaved = async () => {
    try {
      if (!needsCloudKey(aiProvider)) {
        setProviderApiKey("ollama-local");
        return;
      }
      if (aiProvider === "chatgpt") {
        setProviderApiKey((await window.electronAPI.getChatgptApiKey()) ?? undefined);
      } else {
        setProviderApiKey((await window.electronAPI.getGeminiApiKey()) ?? undefined);
      }
    } catch (e) {
      console.error("[App] Failed to refresh key after settings save:", e);
    }
  };

  // ------- UI (keep your existing structure/styles if you have them) -------
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">Coder App</span>
            <span className="rounded-full border border-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
              {aiProvider.toUpperCase()}
            </span>
            {needsCloudKey(aiProvider) && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  hasKey ? "border border-emerald-700 text-emerald-400" : "border border-rose-700 text-rose-400"
                }`}
                title={hasKey ? "API key loaded" : "API key missing"}
              >
                {hasKey ? "key: OK" : "key: missing"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AiProvider)}
            >
              <option value="gemini">Gemini</option>
              <option value="chatgpt">ChatGPT (OpenAI)</option>
              <option value="ollama">Ollama (local)</option>
            </select>

            <button
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1 text-sm hover:bg-neutral-800"
              onClick={() => setIsSettingsOpen(true)}
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <label className="text-sm text-neutral-400">Model</label>
          <input
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={aiProvider === "gemini" ? "gemini-2.5-flash" : aiProvider === "chatgpt" ? "gpt-4o-mini" : "qwen2.5-coder"}
          />

          <label className="mt-3 text-sm text-neutral-400">Your prompt</label>
          <textarea
            className="h-40 w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm leading-6"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want the AI to build or modify…"
          />

          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-medium hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleGenerate}
              disabled={isGenerating || (needsCloudKey(aiProvider) && !hasKey)}
              title={!hasKey && needsCloudKey(aiProvider) ? "Add your API key in Settings" : "Generate"}
            >
              {isGenerating ? "Generating…" : "Generate"}
            </button>

            <button
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm hover:bg-neutral-800"
              onClick={handlePickImage}
              title="Attach an image to the prompt"
            >
              Attach Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />
            {imageDataUrl && <span className="text-xs text-neutral-400">image attached</span>}
          </div>
        </section>

        <section className="flex min-h-[420px] flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">Generated Files</h2>
            <button
              className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs hover:bg-neutral-800"
              onClick={() => {
                setFiles([]);
                setReadmeContent("");
              }}
            >
              Clear
            </button>
          </div>

          {files.length === 0 && !readmeContent && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
              Results will show up here after you click <span className="text-neutral-200">Generate</span>.
            </div>
          )}

          {files.length > 0 && (
            <div className="rounded-lg border border-neutral-800">
              <CodeDisplay files={files} onRemoveFile={removeFile} onChangeFile={(f) => addFile(f.fileName, f.code)} />
            </div>
          )}

          {readmeContent && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
              <div className="mb-2 text-sm font-semibold text-neutral-300">README.md</div>
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs leading-5 text-neutral-200">
                {readmeContent}
              </pre>
            </div>
          )}
        </section>
      </main>

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          onSaved={handleSettingsSaved} // <-- correct prop name
          model={model}
          setModel={setModel}
        />
      )}
    </div>
  );
}
