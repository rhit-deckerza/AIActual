import React, { useState, useRef, useEffect } from 'react';
import './AIChatButton.scss';
import { useUserData } from '../../hooks/useUserData';

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: string; // string for easier localStorage persistence
};

export function AIChatButton() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [includePersonalData, setIncludePersonalData] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Get user data
  const { accounts, transactions, budgets } = useUserData();

  // -------------------------------
  //  Load conversation from localStorage
  // -------------------------------
  useEffect(() => {
    const savedMessages = localStorage.getItem('aiChatMessages');
    const savedConversationId = localStorage.getItem('aiConversationId');

    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages) as Message[];
        setMessages(parsedMessages);
      } catch (err) {
        console.error('Error parsing saved chat messages', err);
      }
    }

    if (savedConversationId) {
      setConversationId(savedConversationId);
    }
  }, []);

  // -------------------------------
  //  Save conversation to localStorage whenever messages or conversationId change
  // -------------------------------
  useEffect(() => {
    localStorage.setItem('aiChatMessages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('aiConversationId', conversationId);
    }
  }, [conversationId]);

  const handleClick = () => {
    setIsPanelOpen((prev) => !prev);
    console.log('AI Chat button clicked');
  };

  const closePanel = () => {
    setIsPanelOpen(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isPanelOpen) {
      // Focus the input when panel opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isPanelOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // -------------------------------
  //  Create system prompt based on user data and preferences
  // -------------------------------
  const createSystemPrompt = () => {
    let systemContent = 'You are a helpful financial assistant.';
    
    if (includePersonalData) {
      let totalBalance = 0;
      if (accounts?.length) {
        totalBalance = accounts.reduce((sum, acc) => {
          const balance = acc.balance || 0;
          return sum + balance;
        }, 0);
      }

      systemContent += ` 
        The user has ${accounts?.length || 0} accounts 
        with a total combined balance of ${(totalBalance / 100).toFixed(2)}. 
        ${
          budgets?.length
            ? `They have the following budget categories: ${budgets
                .map((b) => b.name || 'Unnamed')
                .join(', ')}.`
            : 'No budget data available.'
        }
        ${
          transactions?.length
            ? `Recent transactions (up to 5): ${transactions
                .slice(0, 5)
                .map((t) => {
                  const amount = t.amount || 0;
                  const formattedAmount = (amount / 100).toFixed(2);
                  return `${t.date || 'Unknown date'}: ${
                    t.imported_payee || 'Unknown payee'
                  } - $${formattedAmount}`;
                })
                .join('; ')}.`
            : 'No recent transactions.'
        }
        Use this data to provide personalized assistance when relevant.
      `;
    }
    
    return {
      role: 'system',
      content: systemContent
    };
  };

  const sendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    // Update messages locally (user's new message)
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetchAIResponse(userMessage.content);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };

      // Add AI message to local state
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------
  //  Build the full conversation for the AI
  // -------------------------------
  const fetchAIResponse = async (newUserMessage: string): Promise<string> => {
    try {
      // Get the system message with user context if enabled
      const systemMessage = createSystemPrompt();

      // Convert the entire chat history in state (plus the new user message)
      // into the format the AI expects: {role: 'user'|'assistant', content: string}
      const conversationHistory = messages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // The new user message that triggered this call
      const newMessageObject = {
        role: 'user',
        content: newUserMessage,
      };

      const payload = {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        max_tokens: 1000,
        // Insert conversationId if we have one
        ...(conversationId && { conversation_id: conversationId }),
        // Put everything into the "messages" array:
        messages: [systemMessage, ...conversationHistory, newMessageObject],
      };

      const response = await fetch('http://127.0.0.1:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const data = await response.json();

      // If your server is providing a conversation_id, store it if you haven't already
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      // Extract the assistant's response from the standard OpenAI-like response
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        console.error('Unexpected response format:', data);
        return 'Sorry, I received an unexpected response format.';
      }
    } catch (error) {
      console.error('Error communicating with AI service:', error);
      throw error; // let the caller handle
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {isPanelOpen && <div className="ai-chat-backdrop" onClick={closePanel} />}
      
      <button 
        className="ai-chat-button" 
        onClick={handleClick}
        aria-label="Open AI Chat"
        aria-expanded={isPanelOpen}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" 
            fill="currentColor"
          />
          <path 
            d="M12 15H14V13H16V11H14V9H12V11H10V13H12V15Z" 
            fill="currentColor"
          />
        </svg>
      </button>

      <div className={`ai-chat-panel ${isPanelOpen ? 'open' : ''}`}>
        <div className="ai-chat-panel-header">
          <h3>AI Assistant</h3>
          <button 
            className="ai-chat-panel-close" 
            onClick={closePanel}
            aria-label="Close AI Chat"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" 
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        
        <div className="ai-chat-panel-content">
          {messages.length === 0 ? (
            <div className="ai-chat-empty-state">
              <div className="ai-chat-empty-icon">
                <svg 
                  width="48" 
                  height="48" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" 
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h4>How can I help you today?</h4>
              <p>Ask me anything about your finances or how to use this app.</p>
            </div>
          ) : (
            <div className="ai-chat-messages">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`ai-chat-message ${
                    message.sender === 'user' ? 'user-message' : 'ai-message'
                  }`}
                >
                  <div className="ai-chat-message-content">
                    {message.content}
                  </div>
                  <div className="ai-chat-message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="ai-chat-message ai-message">
                  <div className="ai-chat-message-content">
                    <div className="ai-chat-loading">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        <div className="ai-chat-input-container">
          <button 
            className="ai-chat-send-button" 
            onClick={sendMessage}
            disabled={inputValue.trim() === '' || isLoading}
            aria-label="Send message"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" 
                fill="currentColor"
              />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            placeholder="Type your message..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
        </div>

        <div className="ai-chat-privacy-toggle">
          <input
            type="checkbox"
            id="include-personal-data"
            checked={includePersonalData}
            onChange={(e) => setIncludePersonalData(e.target.checked)}
          />
          <label htmlFor="include-personal-data">
            Include my financial data in AI responses
          </label>
        </div>
      </div>
    </>
  );
}
