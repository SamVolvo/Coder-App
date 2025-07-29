
import React, { useEffect, useRef } from 'react';
import { Content, Part } from '@google/genai';
import { UserIcon, RobotIcon, SparklesIcon } from './icons';

interface ChatHistoryProps {
  history: Content[];
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ history }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

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
          className="mt-2 rounded-md max-w-full h-auto border border-slate-600"
        />
      )
    }
    return null;
  }

  const renderContent = () => {
    if (history.length === 0) {
      return (
        <div className="text-slate-400 p-4 text-sm text-center">
          Your conversation with the AI will appear here.
        </div>
      );
    }

    return history.map((message, index) => {
      if (message.role === 'user') {
        return (
          <div key={`user-${index}`} className="flex items-start gap-3 p-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-slate-300" />
            </div>
            <div className="bg-slate-700 rounded-lg p-3 max-w-xs md:max-w-sm flex flex-col gap-2">
              {message.parts?.map(renderUserMessagePart)}
            </div>
          </div>
        );
      }
      
      if (message.role === 'model') {
        let summary = "AI responded.";
        try {
            const textContent = message.parts?.[0]?.text;
            if(textContent) {
                const parsed = JSON.parse(textContent);
                if (parsed.files && Array.isArray(parsed.files)) {
                    summary = `AI Update: ${parsed.files.length} file(s) changed.`;
                }
            }
        } catch(e) {
            console.error("Could not parse AI response for history:", e);
            summary = "AI responded with an update."
        }
        
        return (
          <div key={`model-${index}`} className="flex items-start gap-3 p-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                <RobotIcon className="w-5 h-5 text-white" />
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 max-w-xs md:max-w-sm">
                <p className="text-sm text-slate-300 italic">{summary}</p>
            </div>
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div className="bg-slate-800 rounded-lg shadow-lg flex flex-col overflow-hidden h-64 flex-shrink-0">
      <div className="flex items-center bg-slate-900/50 px-4 py-2 border-b border-slate-700 flex-shrink-0">
        <SparklesIcon className="w-5 h-5 mr-3 text-indigo-400" />
        <h3 className="text-md font-semibold text-slate-200">AI Chat History</h3>
      </div>
      <div className="flex-grow overflow-auto p-2 space-y-2">
        {renderContent()}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
};

export default ChatHistory;
