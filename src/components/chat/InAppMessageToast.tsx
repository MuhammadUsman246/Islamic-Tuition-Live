import React, { useEffect } from 'react';
import { MessageSquare, X, ArrowRight, Mic, Image, FileText, CheckCheck } from 'lucide-react';
import { ChatMessage } from '../../types';

interface InAppMessageToastProps {
  message: ChatMessage | null;
  channelName?: string;
  onOpenChat: (threadId: string) => void;
  onDismiss: () => void;
}

export const InAppMessageToast: React.FC<InAppMessageToastProps> = ({
  message,
  channelName = 'Chat Message',
  onOpenChat,
  onDismiss
}) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  const renderContentPreview = () => {
    if (message.attachment) {
      if (message.attachment.type === 'audio') {
        return (
          <span className="flex items-center gap-1 text-[#2D8B5C] font-semibold">
            <Mic className="w-3.5 h-3.5" />
            Voice Note ({message.attachment.duration || 1}s)
          </span>
        );
      }
      if (message.attachment.type === 'image') {
        return (
          <span className="flex items-center gap-1 text-sky-600 font-semibold">
            <Image className="w-3.5 h-3.5" />
            Photo Attachment
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
          <FileText className="w-3.5 h-3.5" />
          {message.attachment.name}
        </span>
      );
    }
    return (
      <span className="text-[#161F1A] line-clamp-2">
        {message.text || 'New message'}
      </span>
    );
  };

  const getRoleBadgeStyle = (r: string) => {
    switch (r) {
      case 'admin':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      case 'supervisor':
        return 'bg-violet-100 text-violet-900 border-violet-300';
      case 'tutor':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'student':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <aside
      aria-label="New Message Notification"
      className="fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-[#2D8B5C]/30 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 backdrop-blur-md"
    >
      {/* Top Accent Stripe */}
      <div className="h-1 bg-gradient-to-r from-[#2D8B5C] via-[#34B7F1] to-[#25D366]" />

      <div className="p-3.5 space-y-2.5">
        {/* Header with Sender and Close */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#2D8B5C] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {message.senderName ? message.senderName.slice(0, 2).toUpperCase() : 'IT'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-bold text-[#111B21] truncate max-w-[150px]">
                  {message.senderName}
                </p>
                <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-bold border ${getRoleBadgeStyle(message.senderRole)}`}>
                  {message.senderRole}
                </span>
              </div>
              <p className="text-[10px] text-[#54656F] truncate">
                {channelName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Body */}
        <div className="p-2 rounded-xl bg-[#F0F2F5] text-xs leading-relaxed text-[#111B21]">
          {renderContentPreview()}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-2 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChat(message.threadId);
              onDismiss();
            }}
            className="px-3 py-1 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <span>Open Chat</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
