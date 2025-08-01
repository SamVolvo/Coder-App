
import React, { useState, useEffect, useRef } from 'react';
import { Content, Part } from '@google/genai';
import { UserIcon, RobotIcon, SparklesIcon, WrenchIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface InfoPanelProps {
  chatHistory: Content[];
  instructions: string;
  isInstructionsLoading: boolean;
}

type ActiveTab = 'chat' | 'instructions';

const InfoPanel: React.FC<InfoPanelProps> = ({ chatHistory, instructions, isInstructionsLoading }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab]);

  const renderUserMessagePart = (part: Part, index: number) => {
    if (part.text) {
      return <p key={index} className="text-sm text-slate-200">{part.text}</p>;
    }
    if (part.inlineData) {
      return (
        <img
          key={index}
          src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`}
          alt="User attachment"
          className="mt-2 rounded-md max-w-full h-auto border border-slate-500"
        />
      );
    }
    return null;
  };

  const renderChatContent = () => {
    if (chatHistory.length === 0) {
      return (
        <div className="text-slate-400 p-4 text-sm text-center">
          Your conversation with the AI will appear here.
        </div>
      );
    }
    return (
      <div className="p-2 space-y-2">
        {chatHistory.map((message, index) => {
          if (message.role === 'user') {
            return (
              <div key={`user-${index}`} className="flex items-start gap-3 p-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-slate-300" />
                </div>
                <div className="bg-slate-700 rounded-lg p-3 flex flex-col gap-2 break-words">
                  {message.parts?.map(renderUserMessagePart)}
                </div>
              </div>
            );
          }
          if (message.role === 'model') {
            let summary = "AI responded.";
            try {
              const textContent = message.parts?.[0]?.text;
              if (textContent) {
                const parsed = JSON.parse(textContent);
                if (parsed.files && Array.isArray(parsed.files)) {
                  summary = `AI Update: ${parsed.files.length} file(s) changed.`;
                }
              }
            } catch (e) {
              summary = "AI responded with an update.";
            }
            return (
              <div key={`model-${index}`} className="flex items-start gap-3 p-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                  <RobotIcon className="w-5 h-5 text-white" />
                </div>
                <div className="bg-indigo-950/60 rounded-lg p-3 break-words">
                  <p className="text-sm text-indigo-200 italic">{summary}</p>
                </div>
              </div>
            );
          }
          return null;
        })}
        <div ref={endOfMessagesRef} />
      </div>
    );
  };

  const renderInstructionsContent = () => {
    if (isInstructionsLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
          <LoadingSpinner />
          <p className="mt-2 text-sm">Generating instructions...</p>
        </div>
      );
    }
    if (!instructions) {
      return (
        <div className="text-slate-400 p-4 text-sm">
          Setup and usage instructions for your generated code will appear here.
        </div>
      );
    }
    return (
      <div className="p-4 text-slate-300 text-sm whitespace-pre-wrap">
        {instructions}
      </div>
    );
  };

  const TabButton: React.FC<{
    label: string;
    icon: React.ElementType;
    isActive: boolean;
    onClick: () => void;
  }> = ({ label, icon: Icon, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-slate-800 text-slate-100'
          : 'bg-slate-900 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
      role="tab"
      aria-selected={isActive}
    >
      <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
      {label}
    </button>
  );

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg flex flex-col overflow-hidden flex-1 min-h-0">
      <div className="flex items-center border-b border-slate-700 flex-shrink-0" role="tablist">
        <TabButton
          label="AI Chat History"
          icon={SparklesIcon}
          isActive={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        />
        <TabButton
          label="Setup Instructions"
          icon={WrenchIcon}
          isActive={activeTab === 'instructions'}
          onClick={() => setActiveTab('instructions')}
        />
      </div>
      <div className="flex-grow overflow-auto">
        {activeTab === 'chat' && renderChatContent()}
        {activeTab === 'instructions' && renderInstructionsContent()}
      </div>
    </div>
  );
};

export default InfoPanel;
