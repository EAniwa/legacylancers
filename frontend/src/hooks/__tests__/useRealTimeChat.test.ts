import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealTimeChat } from '../useRealTimeChat';
import { io } from 'socket.io-client';

// Mock Socket.IO
jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

const mockIo = io as jest.MockedFunction<typeof io>;

describe('useRealTimeChat', () => {
  let mockSocket: any;

  beforeEach(() => {
    mockSocket = {
      connected: false,
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    };
    mockIo.mockReturnValue(mockSocket);
    
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const defaultOptions = {
    userId: 'user-123',
    bookingId: 'booking-456',
    autoConnect: true,
  };

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    expect(result.current.connected).toBe(false);
    expect(result.current.messages).toEqual([]);
    expect(result.current.typing).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('connects to socket when autoConnect is true', () => {
    renderHook(() => useRealTimeChat(defaultOptions));

    expect(mockIo).toHaveBeenCalledWith('/chat', {
      auth: {
        userId: 'user-123',
        bookingId: 'booking-456',
        gigId: undefined,
      },
      transports: ['websocket', 'polling'],
    });
  });

  it('does not auto-connect when autoConnect is false', () => {
    renderHook(() => useRealTimeChat({ ...defaultOptions, autoConnect: false }));

    expect(mockIo).not.toHaveBeenCalled();
  });

  it('joins booking room when bookingId is provided', () => {
    renderHook(() => useRealTimeChat(defaultOptions));

    expect(mockSocket.emit).toHaveBeenCalledWith('join_booking_room', { bookingId: 'booking-456' });
  });

  it('joins gig room when gigId is provided', () => {
    renderHook(() => useRealTimeChat({ ...defaultOptions, bookingId: undefined, gigId: 'gig-789' }));

    expect(mockSocket.emit).toHaveBeenCalledWith('join_gig_room', { gigId: 'gig-789' });
  });

  it('handles connection events', () => {
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    // Simulate connect event
    act(() => {
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('handles disconnect events', () => {
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    // Simulate disconnect event
    act(() => {
      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
      disconnectHandler();
    });

    expect(result.current.connected).toBe(false);
  });

  it('handles incoming messages', () => {
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    const mockMessage = {
      id: 'msg-1',
      senderId: 'user-456',
      recipientId: 'user-123',
      content: 'Hello!',
      type: 'text' as const,
      timestamp: new Date().toISOString(),
      read: false,
    };

    act(() => {
      const messageHandler = mockSocket.on.mock.calls.find(call => call[0] === 'message')[1];
      messageHandler(mockMessage);
    });

    expect(result.current.messages).toContain(mockMessage);
  });

  it('handles typing indicators', () => {
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    act(() => {
      const typingHandler = mockSocket.on.mock.calls.find(call => call[0] === 'typing')[1];
      typingHandler({ userId: 'user-456' });
    });

    expect(result.current.typing).toContain('user-456');
  });

  it('sends messages correctly', async () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    const sendPromise = act(async () => {
      return result.current.sendMessage('Hello world!');
    });

    // Simulate successful response
    const emitCall = mockSocket.emit.mock.calls.find(call => call[0] === 'send_message');
    const callback = emitCall[2];
    callback({ success: true });

    await expect(sendPromise).resolves.toBeUndefined();
  });

  it('throws error when sending message while disconnected', async () => {
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    await expect(result.current.sendMessage('Hello')).rejects.toThrow('Not connected to chat server');
  });

  it('handles file uploads correctly', async () => {
    mockSocket.connected = true;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://example.com/file.pdf' }),
    });

    const { result } = renderHook(() => useRealTimeChat(defaultOptions));
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

    const sendPromise = act(async () => {
      return result.current.sendFile(mockFile);
    });

    // Simulate successful socket response
    const emitCall = mockSocket.emit.mock.calls.find(call => call[0] === 'send_message');
    const callback = emitCall[2];
    callback({ success: true });

    await expect(sendPromise).resolves.toBeUndefined();
  });

  it('loads chat history on connection', async () => {
    const mockHistory = [
      {
        id: 'msg-1',
        senderId: 'user-456',
        recipientId: 'user-123',
        content: 'Previous message',
        type: 'text' as const,
        timestamp: new Date().toISOString(),
        read: true,
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHistory),
    });

    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    // Simulate connection
    act(() => {
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual(mockHistory);
    });
  });

  it('marks messages as read', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    act(() => {
      result.current.markAsRead('msg-1');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('mark_read', { messageId: 'msg-1' });
  });

  it('handles typing timeouts correctly', () => {
    jest.useFakeTimers();
    mockSocket.connected = true;
    const { result } = renderHook(() => useRealTimeChat(defaultOptions));

    act(() => {
      result.current.startTyping();
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('typing', { bookingId: 'booking-456', gigId: undefined });

    // Advance timer to trigger stop typing
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('stop_typing', { bookingId: 'booking-456', gigId: undefined });

    jest.useRealTimers();
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useRealTimeChat(defaultOptions));

    unmount();

    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});