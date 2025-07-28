import React, { useEffect } from 'react';
import { CheckCircleIcon } from './icons';

interface NotificationProps {
  message: string;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000); // Display for 4 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-8 right-8 z-50 flex items-center p-4 rounded-lg shadow-lg bg-indigo-600 text-white"
      role="alert"
      aria-live="assertive"
    >
      <CheckCircleIcon className="w-6 h-6 mr-3" />
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default Notification;
