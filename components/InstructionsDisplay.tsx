
import React from 'react';
import { WrenchIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface InstructionsDisplayProps {
  instructions: string;
  isLoading: boolean;
}

const InstructionsDisplay: React.FC<InstructionsDisplayProps> = ({ instructions, isLoading }) => {
  const renderContent = () => {
    if (isLoading) {
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
  
  return (
    <div className="bg-slate-800 rounded-lg shadow-lg flex flex-col overflow-hidden h-56 flex-shrink-0">
        <div className="flex items-center bg-slate-900/50 px-4 py-2 border-b border-slate-700 flex-shrink-0">
            <WrenchIcon className="w-5 h-5 mr-3 text-indigo-400"/>
            <h3 className="text-md font-semibold text-slate-200">
                Setup Instructions
            </h3>
        </div>
        <div className="flex-grow overflow-auto">
            {renderContent()}
        </div>
    </div>
  );
};

export default InstructionsDisplay;
