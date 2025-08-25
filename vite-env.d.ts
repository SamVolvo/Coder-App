
import { Content } from '@google/genai';
import { AiProvider, OllamaConfig, TreeNode } from './types';

// --- Main API Definition ---
declare global {
  // Manually define Vite's import.meta.env to fix type errors when `vite/client` isn't found.
  interface ImportMetaEnv {
    [key: string]: any;
    BASE_URL: string;
    MODE: string;
    DEV: boolean;
    PROD: boolean;
    SSR: boolean;
  }

  /// <reference types="vite/client" />

declare global {
  interface Window {
    electronAPI: {
      // Keys
      getGeminiApiKey: () => Promise<string | undefined>;
      setGeminiApiKey: (key: string) => Promise<void>;
      getChatgptApiKey: () => Promise<string | undefined>;
      setChatgptApiKey: (key: string) => Promise<void>;

      // (add other methods you actually expose here, e.g. sendFeedback, read/write files, etc.)
      // sendFeedback?: (payload: any) => Promise<void>;
      // getChatHistory?: () => Promise<any>;
    };
  }
}

export {};


  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface Window {
    electronAPI: {
      // Settings
      getGeminiApiKey: () => Promise<string | undefined>;
      setGeminiApiKey: (key: string) => Promise<void>;
      getChatgptApiKey: () => Promise<string | undefined>;
      setChatgptApiKey: (key: string) => Promise<void>;
      getAiProvider: () => Promise<AiProvider>;
      setAiProvider: (provider: AiProvider) => Promise<void>;
      getOllamaConfig: () => Promise<OllamaConfig | undefined>;
      setOllamaConfig: (config: OllamaConfig) => Promise<void>;
      getOllamaModels: (url: string) => Promise<string[]>;
      
      // App Info
      getAppVersion: () => Promise<string>;

      // Project & File System
      openProject: () => Promise<string | null>; // Returns project root path
      readProjectTree: (projectRoot: string) => Promise<TreeNode[] | null>;
      readFile: (projectRoot: string, relativePath: string) => Promise<string>;
      writeFile: (payload: { projectRoot: string, relativePath: string, content: string }) => Promise<void>;
      deleteNode: (projectRoot: string, relativePath: string) => Promise<void>;
      renameNode: (projectRoot: string, oldRelativePath: string, newRelativePath: string) => Promise<void>;
      createFile: (projectRoot: string, relativePath: string) => Promise<void>;
      createFolder: (projectRoot: string, relativePath: string) => Promise<void>;
      uploadFile: (projectRoot: string) => Promise<string | null>;
      onProjectUpdate: (callback: () => void) => () => void; // Listener for external changes
      openInTerminal: (projectRoot: string) => Promise<void>;

      // Chat History
      readChatHistory: (projectRoot: string) => Promise<Content[]>;
      writeChatHistory: (projectRoot: string, history: Content[]) => Promise<void>;
      
      // AI Services
      invokeOllama: (payload: { config: OllamaConfig, messages: any[] }) => Promise<string>;

      // Updater
      getAllowPrerelease: () => Promise<boolean>;
      setAllowPrerelease: (value: boolean) => Promise<void>;
      checkForUpdates: () => void;
      startUpdateDownload: () => void;
      quitAndInstall: () => void;
      onUpdateStatus: (callback: (data: {
        status: 'idle' | 'checking' | 'not-available' | 'available' | 'downloading' | 'downloaded' | 'error';
        info?: { version?: string };
        error?: string;
        progress?: { percent: number };
      }) => void) => () => void;
      openLogFile: () => void;

      // Feedback
      sendFeedback: (payload: { type: 'bug' | 'idea', message: string, version: string }) => Promise<{ success: boolean; message: string; }>;
    };
  }
}

// This export statement is needed to turn this file into a module
export {};