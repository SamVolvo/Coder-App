import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import PromptForm from './components/PromptForm';
import CodeDisplay from './components/CodeDisplay';
import InstructionsDisplay from './components/InstructionsDisplay';
import FileExplorer from './components/FileExplorer';
import Notification from './components/Notification';
import ConfirmModal from './components/ConfirmModal';
import InputModal from './components/InputModal';
import SettingsModal from './components/SettingsModal';
import { initializeChat, sendMessage, getChatHistory, endChatSession } from './services/geminiService';
import { ModalType, ModalContext, TreeNode, SyntaxTheme } from './types';

const getLanguageFromFileName = (fileName: string | null): string => {
    if (!fileName) return 'plaintext';
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js': case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'py': return 'python';
        case 'java': return 'java';
        case 'cs': return 'csharp';
        case 'go': return 'go';
        case 'rs': return 'rust';
        case 'html': return 'html';
        case 'css': return 'css';
        case 'sql': return 'sql';
        case 'json': return 'json';
        case 'md': return 'markdown';
        default: return 'plaintext';
    }
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);
  const [useTypingEffect, setUseTypingEffect] = useState(true);
  const [syntaxTheme, setSyntaxTheme] = useState<SyntaxTheme>('vsc-dark-plus');

  // --- New State Management for Disk-Based Projects ---
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [recentlyUpdatedPaths, setRecentlyUpdatedPaths] = useState<Set<string>>(new Set());
  const [readmeContent, setReadmeContent] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{ type: ModalType; context: ModalContext }>({ type: 'none', context: null });
  const [onAnimationComplete, setOnAnimationComplete] = useState<{ cb: (() => void) | null }>({ cb: null });
  
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

  // Effect to load initial settings
  useEffect(() => {
    const checkInitialSettings = async () => {
      if (!window.electronAPI) return;
      try {
        const storedKey = await window.electronAPI.getApiKey();
        setApiKey(storedKey);
        if (!storedKey) setModalState({ type: 'settings', context: null });

        const typingEffectEnabled = await window.electronAPI.getTypingEffect();
        setUseTypingEffect(typingEffectEnabled);

        const theme = await window.electronAPI.getSyntaxTheme();
        setSyntaxTheme(theme);
      } catch (e) {
        console.error("Failed to get settings:", e);
      }
    };
    checkInitialSettings();
  }, []);

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
            }
        }
    };

    const removeListener = window.electronAPI.onProjectUpdate(handleUpdate);
    return () => removeListener();
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

  const handleSendMessage = useCallback(async (prompt: string) => {
    if (!projectRoot) {
        setError("No project is open. Please open a folder first.");
        return;
    }
    setIsLoading(true);
    setError(null);
    setRecentlyUpdatedPaths(new Set());
    
    try {
      const history = await window.electronAPI.readChatHistory(projectRoot);
      await initializeChat(history);
      
      const response = await sendMessage(prompt);
      
      const updatedPaths = new Set<string>();

      const animateFileByFile = async () => {
        for (const file of response.files) {
          await window.electronAPI.writeFile(projectRoot, file.fileName, file.code);
          updatedPaths.add(file.fileName);
          setActiveFile(file.fileName);
          
          await new Promise<void>(resolve => {
            setOnAnimationComplete({ cb: resolve });
          });
        }
      };

      await animateFileByFile();
      
      const newHistory = await getChatHistory();
      if(newHistory) await window.electronAPI.writeChatHistory(projectRoot, newHistory);

      if (response.readmeContent) {
          await window.electronAPI.writeFile(projectRoot, 'README.md', response.readmeContent);
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
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setOnAnimationComplete({ cb: null });
    }
  }, [projectRoot, refreshProject]);

  const resetState = () => {
    endChatSession();
    setProjectRoot(null);
    setFileTree([]);
    setActiveFile(null);
    setSelectedNodes(new Set());
    setRecentlyUpdatedPaths(new Set());
    setReadmeContent('');
    setError(null);
    setIsLoading(false);
    setNotification(null);
  };

  const handleNewProject = useCallback(() => {
    resetState();
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
            await initializeChat(history);
            setNotification("Project opened successfully.");
        }
    } catch(e) {
        setError(e instanceof Error ? e.message : 'Failed to open project.');
    }
  }, [resetState, refreshProject]);

  const clearIndicators = () => setRecentlyUpdatedPaths(new Set());

  const handleAddNode = async (filePath: string, isFolder: boolean) => {
      clearIndicators();
      try {
          if (isFolder) {
              await window.electronAPI.createFolder(projectRoot!, filePath);
          } else {
              await window.electronAPI.createFile(projectRoot!, filePath);
              setActiveFile(filePath);
          }
          await refreshProject(projectRoot!);
      } catch (e) {
          setError(`Failed to create ${isFolder ? 'folder' : 'file'}: ${e instanceof Error ? e.message : String(e)}`);
      }
  };

  const handleDeleteNodes = async (pathsToDelete: Set<string>) => {
      clearIndicators();
      try {
        for (const p of pathsToDelete) {
            await window.electronAPI.deleteNode(projectRoot!, p);
        }
        if (pathsToDelete.has(activeFile!)) setActiveFile(null);
        setSelectedNodes(new Set());
        await refreshProject(projectRoot!);
        setNotification(`${pathsToDelete.size} item(s) deleted.`);
      } catch(e) {
        setError(`Failed to delete items: ${e instanceof Error ? e.message : String(e)}`);
      }
  };

  const handleRenameNode = async (oldPath: string, newName: string) => {
      clearIndicators();
      const parentDir = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
      const newRelativePath = parentDir ? `${parentDir}/${newName}` : newName;
      try {
        await window.electronAPI.renameNode(projectRoot!, oldPath, newRelativePath);
        if (activeFile === oldPath) setActiveFile(newRelativePath);
        await refreshProject(projectRoot!);
        setNotification('Renamed successfully.');
      } catch (e) {
        setError(`Failed to rename: ${e instanceof Error ? e.message : String(e)}`);
      }
  };
  
  const handleMoveNodes = async (sourcePaths: string[], destinationPath: string | null) => {
    clearIndicators();
    try {
        for (const source of sourcePaths) {
            const baseName = source.split('/').pop()!;
            const newRelativePath = destinationPath ? `${destinationPath}/${baseName}` : baseName;
            await window.electronAPI.renameNode(projectRoot!, source, newRelativePath);
        }
        setSelectedNodes(new Set());
        await refreshProject(projectRoot!);
        setNotification('Items moved successfully.');
    } catch (e) {
        setError(`Failed to move items: ${e instanceof Error ? e.message : String(e)}`);
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
    if (!isFolder) setActiveFile(path);
  };

  const handleCopyPath = (nodePath: string) => {
      navigator.clipboard.writeText(nodePath);
      setNotification("Path copied to clipboard!");
  };

  const handleSaveSettings = async (settings: { apiKey?: string; useTypingEffect?: boolean; syntaxTheme?: SyntaxTheme }) => {
    clearIndicators();
    if (!window.electronAPI) return;
    try {
        if (settings.apiKey !== undefined) {
            await window.electronAPI.setApiKey(settings.apiKey);
            setApiKey(settings.apiKey);
        }
        if (settings.useTypingEffect !== undefined) {
            await window.electronAPI.setTypingEffect(settings.useTypingEffect);
            setUseTypingEffect(settings.useTypingEffect);
        }
        if (settings.syntaxTheme !== undefined) {
            await window.electronAPI.setSyntaxTheme(settings.syntaxTheme);
            setSyntaxTheme(settings.syntaxTheme);
        }
        setError(null);
        setNotification("Settings saved successfully!");
    } catch(e) {
        setError(`Failed to save settings: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleCodeChange = async (newCode: string) => {
    clearIndicators();
    if (!activeFile || !projectRoot) return;
    setActiveFileContent(newCode); // Update UI immediately
    try {
      await window.electronAPI.writeFile(projectRoot, activeFile, newCode);
    } catch (e) {
      setError(`Failed to save file: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  
  const closeModal = () => setModalState({ type: 'none', context: null });
  const isApiKeySet = !!apiKey;
  const isProjectOpen = !!projectRoot;

  return (
    <div className="min-h-screen flex flex-col font-sans" onClick={() => setSelectedNodes(new Set())}>
      <Header onNewProject={handleNewProject} onOpenProject={handleOpenProject} onOpenSettings={() => setModalState({ type: 'settings', context: null})} />
      
      <main className="flex-grow flex flex-col md:flex-row gap-6 p-4 md:p-6 lg:p-8 max-w-screen-2xl w-full mx-auto">
        <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
          <PromptForm onSendMessage={handleSendMessage} isLoading={isLoading} isSessionActive={isProjectOpen} isApiKeySet={isApiKeySet} />
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
            projectRoot={projectRoot}
          />
          <InstructionsDisplay instructions={readmeContent} isLoading={isLoading && !readmeContent && isProjectOpen} />
        </div>
        <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col flex-grow min-h-0" onClick={(e) => e.stopPropagation()}>
            <CodeDisplay
                code={activeFileContent}
                isLoading={isLoading}
                error={error}
                language={getLanguageFromFileName(activeFile)}
                fileName={activeFile}
                hasFiles={fileTree.length > 0}
                onCodeChange={handleCodeChange}
                useTypingEffect={useTypingEffect}
                syntaxTheme={syntaxTheme}
                onAnimationComplete={onAnimationComplete.cb}
            />
        </div>
      </main>
      
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      
      <SettingsModal 
        isOpen={modalState.type === 'settings'} 
        onClose={closeModal} 
        onSave={handleSaveSettings} 
        currentApiKey={apiKey} 
        currentUseTypingEffect={useTypingEffect} 
        currentSyntaxTheme={syntaxTheme} 
      />

      {modalState.type === 'newFolder' && (modalState.context && 'path' in modalState.context) && (() => {
        const context = modalState.context as { path?: string };
        return <InputModal isOpen={true} onClose={closeModal} onSubmit={(name) => handleAddNode(context?.path ? `${context.path}/${name}` : name, true)} title="Add New Folder" message={`Enter name for the new folder${context?.path ? ` in '${context.path}'` : ''}.`} placeholder="e.g., components" submitButtonText="Add Folder"/>;
      })()}
      
      {modalState.type === 'newFile' && (modalState.context && 'path' in modalState.context) && (() => {
        const context = modalState.context as { path?: string };
        return <InputModal isOpen={true} onClose={closeModal} onSubmit={(name) => handleAddNode(context?.path ? `${context.path}/${name}` : name, false)} title="Add New File" message={`Enter name for the new file${context?.path ? ` in '${context.path}'` : ''}.`} placeholder="e.g., Button.tsx" submitButtonText="Add File"/>;
      })()}

      {modalState.type === 'rename' && (modalState.context && 'path' in modalState.context) && (() => {
        const context = modalState.context as { path: string; isFolder: boolean; initialValue: string; };
        return <InputModal isOpen={true} onClose={closeModal} onSubmit={(newName) => handleRenameNode(context.path, newName)} title={context.isFolder ? 'Rename Folder' : 'Rename File'} message="Enter the new name." placeholder="New name" submitButtonText="Rename" initialValue={context.initialValue}/>;
      })()}

      {modalState.type === 'confirm' && (modalState.context && 'title' in modalState.context) && (() => {
        const context = modalState.context as { title: string; message: string; onConfirm: () => void; };
        return <ConfirmModal isOpen={true} onClose={closeModal} onConfirm={context.onConfirm} title={context.title} message={context.message}/>;
      })()}
      
      {modalState.type === 'confirmDelete' && (modalState.context && 'paths' in modalState.context) && (() => {
        const context = modalState.context as { paths: Set<string>; };
        return <ConfirmModal isOpen={true} onClose={closeModal} onConfirm={() => handleDeleteNodes(context.paths)} title={`Delete ${context.paths.size} item(s)?`} message={`Are you sure? This action cannot be undone.`}/>;
      })()}
    </div>
  );
};

export default App;