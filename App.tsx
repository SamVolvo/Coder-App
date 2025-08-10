import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import PromptForm from './components/PromptForm';
import CodeDisplay from './components/CodeDisplay';
import FileExplorer from './components/FileExplorer';
import Notification from './components/Notification';
import ConfirmModal from './components/ConfirmModal';
import InputModal from './components/InputModal';
import SettingsModal from './components/SettingsModal';
import InfoPanel from './components/InfoPanel';
import MobileNav from './components/MobileNav';
import { initializeChat, sendMessage as sendMessageGemini, getChatHistory, endChatSession } from './services/geminiService';
import { sendMessage as sendMessageOllama } from './services/ollamaService';
import { ModalType, ModalContext, TreeNode, NewNodeModalContext, RenameModalContext, ConfirmDeleteModalContext, GenericConfirmModalContext, AiProvider, OllamaConfig } from './types';
import { Content, Part } from '@google/genai';

const getProjectContextString = async (root: string, tree: TreeNode[], activeFile: string | null, activeFileContent: string): Promise<string> => {
    const contextParts: string[] = [];

    const processNode = async (node: TreeNode) => {
        if (node.type === 'file') {
            try {
                const content = node.path === activeFile 
                    ? activeFileContent 
                    : await window.electronAPI.readFile(root, node.path);
                
                const lang = node.name.split('.').pop() || '';
                contextParts.push(`File: \`${node.path}\`\n\`\`\`${lang}\n${content}\n\`\`\``);
            } catch (e) {
                console.error(`Could not read file for context: ${node.path}`, e);
            }
        } else if (node.children) {
            await Promise.all(node.children.map(processNode));
        }
    };

    await Promise.all(tree.map(processNode));

    if (contextParts.length === 0) {
        return "CONTEXT: This is a new project with no existing files.\n\n";
    }

    return `CONTEXT: The current state of the project files is as follows:\n\n---\n` +
           contextParts.join('\n\n---\n') +
           `\n\n---\n\n`;
};

// Sorts folders before files, then alphabetically
const sortTree = (a: TreeNode, b: TreeNode) => {
  if (a.type === 'folder' && b.type === 'file') return -1;
  if (a.type === 'file' && b.type === 'folder') return 1;
  return a.name.localeCompare(b.name);
};

// Creates a context string with just the file tree and active file content for performance.
const getFileTreeContextString = (tree: TreeNode[], activeFile: string | null, activeFileContent: string): string => {
    const contextParts: string[] = ["Project file structure:"];
    
    const buildTreeString = (nodes: TreeNode[], prefix = '') => {
        const sortedNodes = [...nodes].sort(sortTree);
        sortedNodes.forEach((node, index) => {
            const isLast = index === sortedNodes.length - 1;
            const linePrefix = prefix + (isLast ? '└── ' : '├── ');
            contextParts.push(`${linePrefix}${node.name}`);
            if (node.type === 'folder' && node.children.length > 0) {
                const childPrefix = prefix + (isLast ? '    ' : '│   ');
                buildTreeString(node.children, childPrefix);
            }
        });
    };
    buildTreeString(tree);

    if (activeFile && activeFileContent) {
        const lang = activeFile.split('.').pop() || '';
        contextParts.push(`\n\nContent of active file ('${activeFile}'):\n\`\`\`${lang}\n${activeFileContent}\n\`\`\``);
    } else if (activeFile) {
        contextParts.push(`\n\nNo content available for active file ('${activeFile}'). It might be empty.`);
    }
    
    return `CONTEXT:\n` + contextParts.join('\n') + `\n\n`;
};


const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig | undefined>();

  // --- New State Management for Disk-Based Projects ---
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [recentlyUpdatedPaths, setRecentlyUpdatedPaths] = useState<Set<string>>(new Set());
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Content[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ type: ModalType; context: ModalContext }>({ type: 'none', context: null });
  
  const debounceWriteFileRef = useRef<number | null>(null);
  const [mobileView, setMobileView] = useState<'controls' | 'code'>('controls');


  const refreshProject = useCallback(async (root: string) => {
    if (!window.electronAPI) return;
    try {
        const tree = await window.electronAPI.readProjectTree(root);
        setFileTree(tree || []);
        
        // Try to find and load README.md
        const readmeFile = tree?.find(node => node.name.toLowerCase() === 'readme.md');
        if (readmeFile && readmeFile.type === 'file') {
            const content = await window.electronAPI.readFile(root, readmeFile.path);
            setReadmeContent(content);
        } else {
            const readmeInRoot = (await window.electronAPI.readProjectTree(root))?.find(n => n.name.toLowerCase() === 'readme.md');
            if (readmeInRoot) {
                 const content = await window.electronAPI.readFile(root, readmeInRoot.path);
                 setReadmeContent(content);
            } else {
                setReadmeContent('');
            }
        }
    } catch (e) {
        setError(e instanceof Error ? `Failed to refresh project: ${e.message}` : 'Unknown error refreshing project.');
    }
  }, []);

  const resetState = useCallback(() => {
    endChatSession();
    setProjectRoot(null);
    setFileTree([]);
    setActiveFile(null);
    setSelectedNodes(new Set());
    setRecentlyUpdatedPaths(new Set());
    setReadmeContent('');
    setChatHistory([]);
    setError(null);
    setIsLoading(false);
    setNotification(null);
  }, []);

  const handleOpenProject = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
        const rootPath = await window.electronAPI.openProject();
        if (rootPath) {
            resetState();
            setProjectRoot(rootPath);
            await refreshProject(rootPath);
            const history = await window.electronAPI.readChatHistory(rootPath);
            setChatHistory(history);
            if (aiProvider === 'gemini') {
                await initializeChat(history);
            }
            setNotification("Project opened successfully.");
        }
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Failed to open project.');
    }
  }, [resetState, refreshProject, aiProvider]);

  const handleCloseProject = useCallback(() => {
    if (!projectRoot) return;
    setModalState({
        type: 'confirm',
        context: {
            title: 'Close Project',
            message: 'Are you sure you want to close the current project? You can reopen it at any time.',
            onConfirm: resetState,
        }
    });
  }, [projectRoot, resetState]);

  const handleOpenTerminal = useCallback(async () => {
    if (projectRoot && window.electronAPI) {
      try {
        await window.electronAPI.openInTerminal(projectRoot);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to open terminal.');
      }
    }
  }, [projectRoot]);
  
  const fetchSettings = useCallback(async () => {
      if (!window.electronAPI) return;
      try {
        const [storedKey, provider, ollamaConf] = await Promise.all([
          window.electronAPI.getApiKey(),
          window.electronAPI.getAiProvider(),
          window.electronAPI.getOllamaConfig()
        ]);
        setApiKey(storedKey);
        setAiProvider(provider);
        setOllamaConfig(ollamaConf);
        if (!storedKey && provider === 'gemini') setModalState({ type: 'settings', context: null });
      } catch (e) {
        console.error("Failed to get settings:", e);
      }
  }, []);

  // Effect to load initial settings
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Effect to watch for external file changes
  useEffect(() => {
    if (!projectRoot || !window.electronAPI?.onProjectUpdate) return;

    const handleUpdate = async () => {
        console.log("Project updated externally, refreshing...");
        await refreshProject(projectRoot);

        if (activeFile) {
            try {
                const newContent = await window.electronAPI.readFile(projectRoot, activeFile);
                setActiveFileContent(newContent);
            } catch (e) {
                console.error(`Failed to reload active file ${activeFile}:`, e);
                // File might have been deleted, deselect it
                setActiveFile(null);
                setActiveFileContent('');
            }
        }
    };

    const removeListener = window.electronAPI.onProjectUpdate(handleUpdate);
    
    return () => {
        removeListener();
    };
  }, [projectRoot, refreshProject, activeFile]);


  // Effect to load file content when activeFile changes
  useEffect(() => {
    const loadContent = async () => {
        if (activeFile && projectRoot) {
            try {
                const content = await window.electronAPI.readFile(projectRoot, activeFile);
                setActiveFileContent(content);
            } catch (e) {
                setError(`Failed to read file: ${activeFile}`);
                setActiveFileContent('');
            }
        } else {
            setActiveFileContent('');
        }
    };
    loadContent();
  }, [activeFile, projectRoot]);


  const handleSendMessage = useCallback(async (prompt: string, imageBase64: string | null) => {
    if (!projectRoot) {
        setError("No project is open. Please open a folder first.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setRecentlyUpdatedPaths(new Set());
    
    try {
      const userParts: Part[] = [{ text: prompt }];
      if (imageBase64) {
          userParts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } });
      }
      const userContent: Content = { role: 'user', parts: userParts };
      
      // Optimistic UI update for user message
      setChatHistory(prev => prev.concat(userContent));
      const currentHistory = [...chatHistory];
      
      let response;
      
      if (aiProvider === 'ollama') {
        if (!ollamaConfig?.url || !ollamaConfig?.model) throw new Error("Ollama is not configured.");
        const projectContextForOllama = getFileTreeContextString(fileTree, activeFile, activeFileContent);
        response = await sendMessageOllama(userContent, projectContextForOllama, currentHistory, ollamaConfig);
      } else { // gemini
        const projectContext = await getProjectContextString(projectRoot, fileTree, activeFile, activeFileContent);
        const apiUserParts: Part[] = [{ text: `${projectContext}USER REQUEST: ${prompt}` }];
        if (imageBase64) {
            apiUserParts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } });
        }
        const apiUserContent: Content = { role: 'user', parts: apiUserParts };

        const historyOnDisk = await window.electronAPI.readChatHistory(projectRoot);
        await initializeChat(historyOnDisk);
        response = await sendMessageGemini(apiUserContent);
      }
      
      const updatedPaths = new Set<string>();
      for (const file of response.files) {
        await window.electronAPI.writeFile({ projectRoot, relativePath: file.fileName, content: file.code });
        updatedPaths.add(file.fileName);
      }

      if (response.files.length > 0) {
        setActiveFile(response.files[response.files.length - 1].fileName);
      }
      
      let newHistory: Content[];
      if(aiProvider === 'gemini') {
          newHistory = await getChatHistory() ?? [];
      } else {
          const modelResponsePart: Part = { text: JSON.stringify(response) };
          const modelContent: Content = { role: 'model', parts: [modelResponsePart] };
          newHistory = [...currentHistory, userContent, modelContent];
      }

      if(newHistory.length > 0) {
          setChatHistory(newHistory);
          await window.electronAPI.writeChatHistory(projectRoot, newHistory);
      }

      if (response.readmeContent) {
          await window.electronAPI.writeFile({ projectRoot, relativePath: 'README.md', content: response.readmeContent });
      }
      setReadmeContent(response.readmeContent || '');
      
      const getParentDirs = (p: string) => {
          const parts = p.split('/');
          let current = '';
          const parents = new Set<string>();
          for (let i = 0; i < parts.length - 1; i++) {
              current = current ? `${current}/${parts[i]}` : parts[i];
              parents.add(current);
          }
          return parents;
      };

      const allUpdatedPaths = new Set(updatedPaths);
      updatedPaths.forEach(p => getParentDirs(p).forEach(parent => allUpdatedPaths.add(parent)));
      
      setRecentlyUpdatedPaths(allUpdatedPaths);
      await refreshProject(projectRoot);
      setNotification('Project updated successfully!');

    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(message);
      // Revert optimistic UI update on error
      setChatHistory(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [projectRoot, refreshProject, fileTree, activeFile, activeFileContent, aiProvider, ollamaConfig, chatHistory]);

  const clearIndicators = () => setRecentlyUpdatedPaths(new Set());

  const handleAddNode = async (filePath: string, isFolder: boolean) => {
      clearIndicators();
      if (!projectRoot) return;
      try {
          if (isFolder) {
              await window.electronAPI.createFolder(projectRoot, filePath);
          } else {
              await window.electronAPI.createFile(projectRoot, filePath);
              setActiveFile(filePath);
          }
          await refreshProject(projectRoot);
      } catch (e) {
          setError(`Failed to create ${isFolder ? 'folder' : 'file'}: ${e instanceof Error ? e.message : String(e)}`);
      }
  };

  const handleDeleteNodes = async (pathsToDelete: Set<string>) => {
      clearIndicators();
      if (!projectRoot) return;
      try {
        for (const p of pathsToDelete) {
            await window.electronAPI.deleteNode(projectRoot, p);
        }
        if (pathsToDelete.has(activeFile!)) setActiveFile(null);
        setSelectedNodes(new Set());
        await refreshProject(projectRoot);
        setNotification(`${pathsToDelete.size} item(s) deleted.`);
      } catch(e) {
        setError(`Failed to delete items: ${e instanceof Error ? e.message : String(e)}`);
      }
  };

  const handleRenameNode = async (oldPath: string, newName: string) => {
      clearIndicators();
      if (!projectRoot) return;
      const parentDir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
      const newRelativePath = parentDir ? `${parentDir}/${newName}` : newName;
      try {
        await window.electronAPI.renameNode(projectRoot, oldPath, newRelativePath);
        if (activeFile === oldPath) setActiveFile(newRelativePath);
        await refreshProject(projectRoot);
        setNotification('Renamed successfully.');
      } catch (e) {
        setError(`Failed to rename: ${e instanceof Error ? e.message : String(e)}`);
      }
  };
  
  const handleMoveNodes = async (sourcePaths: string[], destinationPath: string | null) => {
    clearIndicators();
    if (!projectRoot) return;
    try {
        for (const source of sourcePaths) {
            const baseName = source.split('/').pop()!;
            const newRelativePath = destinationPath ? `${destinationPath}/${baseName}` : baseName;
            await window.electronAPI.renameNode(projectRoot, source, newRelativePath);
        }
        setSelectedNodes(new Set());
        await refreshProject(projectRoot);
        setNotification('Items moved successfully.');
    } catch (e) {
        setError(`Failed to move items: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  
  const handleUploadFile = async () => {
    clearIndicators();
    if (!projectRoot) return;
    try {
        const uploadedFilePath = await window.electronAPI.uploadFile(projectRoot);
        if (uploadedFilePath) {
            await refreshProject(projectRoot);
            setActiveFile(uploadedFilePath);
            setNotification('File uploaded successfully!');
        }
    } catch (e) {
        setError(`Failed to upload file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSelectNode = (path: string, isCtrlOrMeta: boolean, isFolder: boolean) => {
    setSelectedNodes(prev => {
      const newSelection = new Set(prev);
      if (isCtrlOrMeta) {
        newSelection.has(path) ? newSelection.delete(path) : newSelection.add(path);
      } else {
        newSelection.clear();
        newSelection.add(path);
      }
      return newSelection;
    });
    if (!isFolder) {
      setActiveFile(path);
      if (window.innerWidth < 768) { // md breakpoint
          setMobileView('code');
      }
    }
  };

  const handleCopyPath = (nodePath: string) => {
      navigator.clipboard.writeText(nodePath);
      setNotification("Path copied to clipboard!");
  };

  const handleSaveSettings = useCallback(async (settings: { apiKey?: string; aiProvider?: AiProvider; ollamaConfig?: OllamaConfig }) => {
    if (!window.electronAPI) return;
    try {
      const newProvider = settings.aiProvider;
      const oldProvider = aiProvider;

      // Save all settings to persistent storage first
      if (settings.apiKey !== undefined) await window.electronAPI.setApiKey(settings.apiKey);
      if (newProvider) await window.electronAPI.setAiProvider(newProvider);
      if (settings.ollamaConfig !== undefined) await window.electronAPI.setOllamaConfig(settings.ollamaConfig);
      
      // Refetch settings to update the component's state from the source of truth
      await fetchSettings();

      // Handle provider state transition *after* settings have been saved and state updated
      if (newProvider && newProvider !== oldProvider) {
        if (oldProvider === 'gemini') {
          endChatSession();
        }
        if (newProvider === 'gemini' && projectRoot) {
          // If we switched TO Gemini and a project is currently open, initialize a chat session for it.
          const historyOnDisk = await window.electronAPI.readChatHistory(projectRoot);
          await initializeChat(historyOnDisk);
        }
      }

      setError(null);
      setNotification("Settings saved successfully!");
    } catch(e) {
      setError(`Failed to save settings: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [aiProvider, projectRoot, fetchSettings]);


  const debouncedWriteFile = useCallback((projectR: string, fileP: string, content: string) => {
    if (debounceWriteFileRef.current) clearTimeout(debounceWriteFileRef.current);
    debounceWriteFileRef.current = window.setTimeout(async () => {
        try {
            await window.electronAPI.writeFile({ projectRoot: projectR, relativePath: fileP, content });
        } catch (e) {
            setError(`Failed to save file: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, 300);
  }, []);

  const handleCodeChange = (newCode: string) => {
    clearIndicators();
    if (!activeFile || !projectRoot) return;
    setActiveFileContent(newCode); // Update UI immediately
    debouncedWriteFile(projectRoot, activeFile, newCode);
  };
  
  const handleClearChatHistory = useCallback(() => {
    if (!projectRoot) return;
    setModalState({
      type: 'confirm',
      context: {
        title: 'Clear Chat History',
        message: 'Are you sure you want to permanently delete the chat history for this project?',
        onConfirm: async () => {
          try {
            setChatHistory([]);
            await window.electronAPI.writeChatHistory(projectRoot, []);
            if (aiProvider === 'gemini') {
                await initializeChat([]); // Re-initialize with empty history
            }
            setNotification("Chat history cleared.");
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to clear chat history.');
          }
        },
      },
    });
  }, [projectRoot, aiProvider]);

  const closeModal = () => setModalState({ type: 'none', context: null });
  
  const isProviderConfigured = (aiProvider === 'gemini' && !!apiKey) || (aiProvider === 'ollama' && !!ollamaConfig?.url && !!ollamaConfig?.model);
  const isProjectOpen = !!projectRoot;
  
  const renderModals = () => {
    switch (modalState.type) {
      case 'newFolder':
      case 'newFile': {
        const context = modalState.context as NewNodeModalContext;
        const isFolder = modalState.type === 'newFolder';
        return <InputModal isOpen={true} onClose={closeModal} onSubmit={(name) => handleAddNode(context?.path ? `${context.path}/${name}` : name, isFolder)} title={isFolder ? 'Add New Folder' : 'Add New File'} message={`Enter name for the new ${isFolder ? 'folder' : 'file'}${context?.path ? ` in '${context.path}'` : ''}.`} placeholder={isFolder ? "e.g., components" : "e.g., Button.tsx"} submitButtonText={isFolder ? "Add Folder" : "Add File"}/>;
      }
      case 'rename': {
        const context = modalState.context as RenameModalContext;
        return <InputModal isOpen={true} onClose={closeModal} onSubmit={(newName) => handleRenameNode(context.path, newName)} title={context.isFolder ? 'Rename Folder' : 'Rename File'} message="Enter the new name." placeholder="New name" submitButtonText="Rename" initialValue={context.initialValue}/>;
      }
      case 'confirm': {
        const context = modalState.context as GenericConfirmModalContext;
        return <ConfirmModal isOpen={true} onClose={closeModal} onConfirm={context.onConfirm} title={context.title} message={context.message}/>;
      }
      case 'confirmDelete': {
        const context = modalState.context as ConfirmDeleteModalContext;
        return <ConfirmModal isOpen={true} onClose={closeModal} onConfirm={() => handleDeleteNodes(context.paths)} title={`Delete ${context.paths.size} item(s)?`} message={`Are you sure? This action cannot be undone.`}/>;
      }
      case 'settings': {
        return <SettingsModal isOpen={true} onClose={closeModal} onSave={handleSaveSettings} currentApiKey={apiKey} currentAiProvider={aiProvider} currentOllamaConfig={ollamaConfig} />;
      }
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col font-sans bg-gray-900 overflow-hidden" onClick={() => setSelectedNodes(new Set())}>
      <Header 
        onOpenProject={handleOpenProject}
        onCloseProject={handleCloseProject}
        onOpenSettings={() => setModalState({ type: 'settings', context: null })}
        isProjectOpen={isProjectOpen}
        onOpenTerminal={handleOpenTerminal}
      />
      
      <main className="flex-grow flex flex-col md:flex-row gap-6 p-4 md:p-6 lg:p-8 max-w-screen-2xl w-full mx-auto min-h-0 md:pb-6 pb-20">
        <div 
            className={`flex-col gap-6 w-full md:flex-shrink-0 md:w-96 lg:w-[420px] ${mobileView === 'controls' ? 'flex' : 'hidden'} md:flex`}
            onClick={(e) => e.stopPropagation()}
        >
          <PromptForm onSendMessage={handleSendMessage} isLoading={isLoading} isSessionActive={isProjectOpen} isProviderConfigured={isProviderConfigured} />
          <FileExplorer 
            fileTree={fileTree} 
            activeFile={activeFile} 
            selectedNodes={selectedNodes}
            recentlyUpdatedPaths={recentlyUpdatedPaths}
            onSelectNode={handleSelectNode}
            isLoading={isLoading && fileTree.length === 0} 
            onAddFolder={(context) => setModalState({ type: 'newFolder', context })}
            onAddFile={(context) => setModalState({ type: 'newFile', context })}
            onDeleteNodes={(context) => setModalState({ type: 'confirmDelete', context })}
            onRenameNode={(context) => setModalState({ type: 'rename', context: { ...context, initialValue: context.path.split('/').pop() || '' } })}
            onCopyPath={handleCopyPath}
            onMoveNodes={handleMoveNodes}
            onUploadFile={handleUploadFile}
            projectRoot={projectRoot}
          />
          <InfoPanel 
            chatHistory={chatHistory}
            instructions={readmeContent}
            isInstructionsLoading={isLoading && !readmeContent && isProjectOpen}
            onClearChat={handleClearChatHistory}
            projectIsOpen={isProjectOpen}
          />
        </div>
        <div 
            className={`w-full flex-col flex-grow min-h-0 ${mobileView === 'code' ? 'flex' : 'hidden'} md:flex`}
            onClick={(e) => e.stopPropagation()}
        >
            <CodeDisplay
                code={activeFileContent}
                isLoading={isLoading}
                error={error}
                fileName={activeFile}
                hasFiles={fileTree.length > 0}
                onCodeChange={handleCodeChange}
            />
        </div>
      </main>
      
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      
      {renderModals()}

      <MobileNav activeView={mobileView} onNavigate={setMobileView} />
    </div>
  );
};

export default App;