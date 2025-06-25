import { useState, useEffect, useRef } from 'react';
import { Search, Send, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';

export default function ChatComponent() {
  const navigate = useNavigate();
  const { socket, onlineUsers, isConnected, disconnect } = useSocket();
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const BASE_URL = "http://localhost:3000";

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate('/');
      return;
    }
    
    setCurrentUser(JSON.parse(userData));
  }, []);

  // Socket connection listeners
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Listen for new messages
    const handleNewMessage = (data) => {
      const { message } = data;
      
      // Add message to current conversation
      if (selectedUser && 
          ((message.sender._id === selectedUser.id && message.receiver._id === currentUser.id) ||
           (message.sender._id === currentUser.id && message.receiver._id === selectedUser.id))) {
        setMessages(prev => [...prev, message]);
      }
      
      // Refresh conversations to get latest message
      fetchConversations();
    };

    // Listen for typing indicators with better debugging
    const handleUserTyping = ({ userId, isTyping }) => {
      console.log('=== TYPING EVENT RECEIVED ===');
      console.log('From userId:', userId);
      console.log('isTyping:', isTyping);
      console.log('Current selectedUser:', selectedUser?.id);
      console.log('userId type:', typeof userId);
      console.log('selectedUser.id type:', typeof selectedUser?.id);
      
      // Convert both to strings for comparison
      const userIdString = userId?.toString();
      const selectedUserIdString = selectedUser?.id?.toString();
      
      console.log('Converted userId:', userIdString);
      console.log('Converted selectedUser.id:', selectedUserIdString);
      console.log('Do they match?', userIdString === selectedUserIdString);
      
      if (selectedUser && userIdString === selectedUserIdString) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (isTyping) {
            newSet.add(userIdString);
          } else {
            newSet.delete(userIdString);
          }
          console.log('Updated typing users:', Array.from(newSet));
          return newSet;
        });
        
        // Auto-clear typing indicator after 3 seconds as a fallback
        if (isTyping) {
          setTimeout(() => {
            setTypingUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(userIdString);
              console.log('Auto-cleared typing for:', userIdString);
              return newSet;
            });
          }, 3000);
        }
      } else {
        console.log('Typing event ignored - not from current conversation');
      }
    };

    socket.on('messageReceived', handleNewMessage);
    socket.on('userTyping', handleUserTyping);

    return () => {
      socket.off('messageReceived', handleNewMessage);
      socket.off('userTyping', handleUserTyping);
    };
  }, [socket, selectedUser, currentUser]);

  // Cleanup typing indicator on component unmount
  useEffect(() => {
    return () => {
      if (socket && selectedUser && isTyping) {
        socket.emit('typing', { receiverId: selectedUser.id, isTyping: false });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchConversations();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  });

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${BASE_URL}/chat/users`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${BASE_URL}/chat/messages/conversations`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const response = await fetch(`${BASE_URL}/chat/messages/${userId}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages);
        console.log('Fetched messages:', data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedUser) return;

    // Stop typing indicator immediately
    if (socket && isTyping) {
      setIsTyping(false);
      socket.emit('typing', { receiverId: selectedUser.id, isTyping: false });
      console.log('Stopped typing (message sent):', selectedUser.id);
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      const response = await fetch(`${BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          receiverId: selectedUser.id,
          content: newMessage.trim()
        })
      });

      const data = await response.json();
      if (response.ok) {
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket || !selectedUser) {
      console.log('Cannot send typing - missing socket or selectedUser:', { socket: !!socket, selectedUser: !!selectedUser });
      return;
    }

    const inputValue = e.target.value;

    // If input is empty, immediately stop typing
    if (!inputValue.trim()) {
      if (isTyping) {
        setIsTyping(false);
        socket.emit('typing', { receiverId: selectedUser.id, isTyping: false });
        console.log('Stopped typing (empty input):', selectedUser.id);
      }
      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // Send typing indicator if not already typing
    if (!isTyping) {
      setIsTyping(true);
      console.log('Emitting typing=true to:', selectedUser.id);
      socket.emit('typing', { receiverId: selectedUser.id, isTyping: true });
      console.log('Started typing to:', selectedUser.id);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      console.log('Emitting typing=false to:', selectedUser.id);
      socket.emit('typing', { receiverId: selectedUser.id, isTyping: false });
      console.log('Stopped typing (timeout):', selectedUser.id);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) 
      return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return `${Math.floor(diffInHours * 60)}m ago`;
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    return date.toLocaleDateString();
  };

  const isUserOnline = (userId) => {
    // Convert both IDs to strings for comparison
    const userIdString = userId.toString();
    const result = onlineUsers.has(userIdString);
    console.log(`Checking online status for ${userIdString}:`, result, 'Online users:', Array.from(onlineUsers));
    return result;
  };

  const getDisplayUsers = () => {
    const conversationUserIds = conversations.map(conv => conv.participant._id);
    const conversationUsers = conversations.map(conv => ({
      ...conv.participant,
      lastMessage: conv.lastMessage,
      lastMessageAt: conv.lastMessageAt,
      isOnline: isUserOnline(conv.participant._id) 
    }));
    
    const otherUsers = users.filter(user => !conversationUserIds.includes(user._id))
      .map(user => ({
        ...user,
        isOnline: isUserOnline(user._id) 
      }));
    
    return [...conversationUsers, ...otherUsers].filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleUserSelect = (user) => {
    // Clear typing users when switching conversations
    setTypingUsers(new Set());
    
    // Clear current typing state
    if (isTyping && socket && selectedUser) {
      setIsTyping(false);
      socket.emit('typing', { receiverId: selectedUser.id, isTyping: false });
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    setSelectedUser({ 
      id: user._id, 
      username: user.username, 
      isOnline: isUserOnline(user._id)
    });
  };

  const handleLogout = async () => {
    try {
      // Disconnect socket first
      disconnect();
      
      // Then call logout API
      await fetch(`${BASE_URL}/logout`, { 
        method: 'POST', 
        headers: getAuthHeaders() 
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clean up local storage and navigate
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Force a page reload to ensure clean state
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen min-w-full flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-800">Chats</h1>
            {isConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-purple-600 hover:text-purple-500 rounded transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 text-gray-900 border-0 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {getDisplayUsers().map((user) => (
            <div
              key={user._id}
              onClick={() => handleUserSelect(user)}
              className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                selectedUser?.id === user._id ? 'bg-purple-50 border-r-2 border-r-purple-600' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Online status indicator */}
                  {isUserOnline(user._id) && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 truncate">{user.username}</h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {user.lastMessageAt ? formatTime(user.lastMessageAt) : formatLastSeen(user.lastSeen)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">
                    {user.lastMessage?.content ? (
                      user.lastMessage.content.length > 30 
                        ? `${user.lastMessage.content.substring(0, 30)}...`
                        : user.lastMessage.content
                    ) : (
                      isUserOnline(user._id) ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {selectedUser.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {isUserOnline(selectedUser.id) && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedUser.username}</h2>
                  <p className="text-sm text-gray-600">
                    {typingUsers.has(selectedUser.id.toString()) ? (
                      <span className="text-green-600">typing...</span>
                    ) : (
                      isUserOnline(selectedUser.id) ? 'Online' : 'Offline'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll">
              {messages.map((message) => {
                const isOwn = message.sender._id === currentUser.id;
                return (
                  <div key={message._id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] sm:max-w-[60%] md:max-w-[50%] px-3 py-2 rounded-2xl shadow-sm ${
                      isOwn 
                        ? 'bg-purple-600 text-white rounded-br-md' 
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}>
                      <p className="text-sm chat-message leading-relaxed">
                        {message.content}
                      </p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-purple-200' : 'text-gray-500'}`}>
                        {formatTime(message.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyPress={handleKeyPress}
                    className="w-full px-4 py-3 bg-gray-100 border-0 rounded-full focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-900"
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="w-12 h-12 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-12 h-12 bg-gray-400 rounded-full"></div>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Select a chat</h3>
              <p className="text-gray-500">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}