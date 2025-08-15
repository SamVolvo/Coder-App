import React, { useEffect, useState } from "react";

type AiProvider = "gemini" | "chatgpt" | "ollama";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  aiProvider: AiProvider;
  setAiProvider: React.Dispatch<React.SetStateAction<AiProvider>>;
  onSaved: () => Promise<void> | void;
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
};

const needsCloudKey = (p: AiProvider) => p === "gemini" || p === "chatgpt";

export default function SettingsModal({
  isOpen,
  onClose,
  aiProvider,
  setAiProvider,
  onSaved,
  model,
  setModel,
}: SettingsModalProps) {
  const [localProvider, setLocalProvider] = useState<AiProvider>(aiProvider);
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [modelInput, setModelInput] = useState<string>(model);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocalProvider(aiProvider);
    setModelInput(model);

    (async () => {
      try {
        if (!needsCloudKey(aiProvider)) {
          setApiKeyInput("");
          return;
        }
        if (aiProvider === "chatgpt") {
          const k = await window.electronAPI.getChatgptApiKey();
          setApiKeyInput(k ?? "");
        } else {
          const k = await window.electronAPI.getGeminiApiKey();
          setApiKeyInput(k ?? "");
        }
      } catch {
        setApiKeyInput("");
      }
    })();
  }, [isOpen, aiProvider, model]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      setAiProvider(localProvider);
      setModel(modelInput);

      if (needsCloudKey(localProvider)) {
        const key = apiKeyInput.trim();
        if (localProvider === "chatgpt") {
          await window.electronAPI.setChatgptApiKey?.(key);
        } else {
          await window.electronAPI.setGeminiApiKey?.(key);
        }
      }

      await onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-200">Settings</h2>
          <button
            type="button"
            className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* one form only (fixes nested <form> warning) */}
        <form className="space-y-4 px-4 py-4" onSubmit={handleSubmit}>
          {/* Provider */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">AI Provider</label>
            <select
              className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-2 text-sm text-neutral-200"
              value={localProvider}
              onChange={(e) => setLocalProvider(e.target.value as AiProvider)}
            >
              <option value="gemini">Gemini</option>
              <option value="chatgpt">ChatGPT (OpenAI)</option>
              <option value="ollama">Ollama (local)</option>
            </select>
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-400">Model</label>
            <input
              className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder={
                localProvider === "gemini"
                  ? "gemini-2.5-flash"
                  : localProvider === "chatgpt"
                  ? "gpt-4o-mini"
                  : "qwen2.5-coder (ignored for Ollama)"
              }
            />
            {localProvider === "ollama" && (
              <p className="text-xs text-neutral-500">Ollama runs locally and doesn’t need an API key.</p>
            )}
          </div>

          {/* API Key (only when needed) */}
          {needsCloudKey(localProvider) && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-400">
                {localProvider === "chatgpt" ? "OpenAI API Key" : "Gemini API Key"}
              </label>
              <input
                type="password"
                className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={localProvider === "chatgpt" ? "sk-..." : "AIza..."}
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md border border-emerald-700 bg-emerald-900/40 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-900/60 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
