import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  bookingId?: string;
  gigId?: string;
  content: string;
  type: 'text' | 'file' | 'system';
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  timestamp: string;
  read: boolean;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  bookingId?: string;
  gigId?: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
}

interface UseRealTimeChatOptions {
  userId: string;
  bookingId?: string;
  gigId?: string;
  autoConnect?: boolean;
}

export const useRealTimeChat = (options: UseRealTimeChatOptions) => {
  const { userId, bookingId, gigId, autoConnect = true } = options;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState<{ [userId: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (socket?.connected) return;

    const newSocket = io('/chat', {
      auth: {
        userId,
        bookingId,
        gigId,
      },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      setError(`Connection failed: ${error.message}`);
      setConnected(false);
    });

    newSocket.on('message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('typing', ({ userId: typingUserId }: { userId: string }) => {
      setTyping(prev => ({ ...prev, [typingUserId]: true }));
    });

    newSocket.on('stop_typing', ({ userId: typingUserId }: { userId: string }) => {
      setTyping(prev => ({ ...prev, [typingUserId]: false }));
    });

    newSocket.on('message_read', ({ messageId }: { messageId: string }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
    });

    // Join the appropriate room
    if (bookingId) {
      newSocket.emit('join_booking_room', { bookingId });
    } else if (gigId) {
      newSocket.emit('join_gig_room', { gigId });
    }

    setSocket(newSocket);
  }, [userId, bookingId, gigId]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    }
  }, [socket]);

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!socket || !connected) {
      throw new Error('Not connected to chat server');
    }

    return new Promise((resolve, reject) => {
      socket.emit('send_message', {
        content,
        recipientId: bookingId ? 'booking_participants' : 'gig_participants',
        bookingId,
        gigId,
        type: 'text',
      }, (response: { success: boolean; error?: string; message?: ChatMessage }) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }, [socket, connected, bookingId, gigId]);

  const sendFile = useCallback(async (file: File): Promise<void> => {
    if (!socket || !connected) {
      throw new Error('Not connected to chat server');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('bookingId', bookingId || '');
    formData.append('gigId', gigId || '');

    try {
      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`File upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Send file message through socket
      return new Promise((resolve, reject) => {
        socket.emit('send_message', {
          content: `Sent a file: ${file.name}`,
          type: 'file',
          fileName: file.name,
          fileUrl: result.url,
          fileSize: file.size,
          recipientId: bookingId ? 'booking_participants' : 'gig_participants',
          bookingId,
          gigId,
        }, (response: { success: boolean; error?: string }) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error || 'Failed to send file'));
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }, [socket, connected, userId, bookingId, gigId]);

  const startTyping = useCallback(() => {
    if (!socket || !connected) return;

    socket.emit('typing', { bookingId, gigId });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { bookingId, gigId });
    }, 3000);
  }, [socket, connected, bookingId, gigId]);

  const stopTyping = useCallback(() => {
    if (!socket || !connected) return;

    socket.emit('stop_typing', { bookingId, gigId });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [socket, connected, bookingId, gigId]);

  const markAsRead = useCallback((messageId: string) => {
    if (!socket || !connected) return;

    socket.emit('mark_read', { messageId });
  }, [socket, connected]);

  const loadChatHistory = useCallback(async (limit = 50, offset = 0): Promise<ChatMessage[]> => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId,
        limit: limit.toString(),
        offset: offset.toString(),
        ...(bookingId && { bookingId }),
        ...(gigId && { gigId }),
      });

      const response = await fetch(`/api/chat/history?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.statusText}`);
      }

      const history = await response.json();
      setMessages(history);
      return history;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat history');
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, bookingId, gigId]);

  const getTypingUsers = useCallback((): string[] => {
    return Object.keys(typing).filter(id => typing[id] && id !== userId);
  }, [typing, userId]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [autoConnect, connect, disconnect]);

  useEffect(() => {
    if (connected) {
      loadChatHistory();
    }
  }, [connected, loadChatHistory]);

  return {
    connected,
    messages,
    typing: getTypingUsers(),
    error,
    loading,
    connect,
    disconnect,
    sendMessage,
    sendFile,
    startTyping,
    stopTyping,
    markAsRead,
    loadChatHistory,
  };
};