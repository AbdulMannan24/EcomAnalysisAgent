'use client';

import { useState } from 'react';

export default function AnalyticsChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: input.trim() 
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [userMessage]
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          metadata: data.metadata,
          sessionId: data.sessionId
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ **Error:** ${data.error}\n\n${data.suggestion ? `**Suggestion:** ${data.suggestion}` : ''}`,
          error: true
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **System Error:** Failed to process your request. Please try again.`,
        error: true
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setIsLoading(false);
  };

  // Simple markdown-like formatting function
  const formatMessageContent = (content) => {
    if (!content) return content;
    
    // Convert markdown-like formatting to JSX
    return content
      .split('\n')
      .map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-bold mt-4 mb-2">{line.substring(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-semibold mt-3 mb-2">{line.substring(4)}</h3>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} className="font-semibold mb-1">{line.slice(2, -2)}</div>;
        }
        if (line.startsWith('• ')) {
          return <div key={i} className="ml-4 mb-1">{line}</div>;
        }
        if (line.startsWith('```sql') || line.startsWith('```python') || line.startsWith('```')) {
          return <div key={i} className="bg-gray-800 text-green-400 p-2 rounded text-sm font-mono mt-2">{line.substring(3)}</div>;
        }
        if (line === '```') {
          return <div key={i}></div>;
        }
        return <div key={i} className="mb-1">{line || <br />}</div>;
      });
  };

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-4">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          AI Analytics Agent
        </h1>
        <p className="text-gray-600">
          Ask questions about your e-commerce data in natural language
        </p>
      </header>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">🚀 Advanced Analytics Agent</h3>
              <p className="text-sm text-blue-700">
                This agent validates queries, generates optimized SQL, saves data to files, 
                performs Python analysis, and provides comprehensive insights - all optimized for cost and performance!
              </p>
            </div>
            <p className="mb-4 font-semibold">Try asking questions like:</p>
            <div className="space-y-2 text-sm max-w-2xl mx-auto">
              <p className="italic bg-gray-50 p-2 rounded">"Analyze sales trends for the last 6 months and identify patterns"</p>
              <p className="italic bg-gray-50 p-2 rounded">"Show me customer segmentation based on purchase behavior"</p>
              <p className="italic bg-gray-50 p-2 rounded">"What are the top performing products and their conversion rates?"</p>
              <p className="italic bg-gray-50 p-2 rounded">"Compare revenue across different regions and time periods"</p>
              <p className="italic bg-gray-50 p-2 rounded">"Find anomalies in our order data and investigate causes"</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-4xl p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.error 
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="font-semibold mb-1">
                {message.role === 'user' ? 'You' : 'Analytics Agent'}
              </div>
              
              {/* Message content with markdown-like formatting */}
              <div className="whitespace-pre-wrap">
                {formatMessageContent(message.content)}
              </div>
              
              {/* Metadata display for assistant messages */}
              {message.metadata && (
                <div className="mt-4 p-3 bg-white rounded border">
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Session:</strong> {message.sessionId}
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>Data Processed:</strong> {message.metadata.dataProcessed}
                  </div>
                  
                  {message.metadata.generatedFiles && message.metadata.generatedFiles.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm font-semibold text-gray-700 mb-1">Generated Files:</div>
                      <div className="text-xs space-y-1">
                        {message.metadata.generatedFiles.map((file, i) => (
                          <div key={i} className="bg-gray-50 p-2 rounded">
                            📁 {file.filename} ({Math.round(file.size/1024)}KB)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {message.metadata.sqlQuery && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600 text-sm">
                        View SQL Query
                      </summary>
                      <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {message.metadata.sqlQuery}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-blue-100 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center space-x-2 mb-2">
                <div className="animate-pulse">🧠</div>
                <span className="font-semibold">Analytics Agent Working...</span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• Validating query against database schemas</div>
                <div>• Generating optimized SQL queries</div>
                <div>• Executing queries and saving data</div>
                <div>• Running Python analysis scripts</div>
                <div>• Compiling insights and recommendations</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your data..."
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}