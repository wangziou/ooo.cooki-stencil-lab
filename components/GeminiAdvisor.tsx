import React, { useState } from 'react';
import { analyzeTattooDesign } from '../services/geminiService';
import { Sparkles, Send, Loader2, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types';

interface GeminiAdvisorProps {
  currentImageBase64: string | null;
}

const GeminiAdvisor: React.FC<GeminiAdvisorProps> = ({ currentImageBase64 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleAsk = async () => {
    if (!currentImageBase64 || !prompt.trim()) return;

    setLoading(true);
    const userMsg: ChatMessage = { role: 'user', text: prompt };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');

    const response = await analyzeTattooDesign(currentImageBase64, userMsg.text);
    
    setMessages(prev => [...prev, { role: 'model', text: response }]);
    setLoading(false);
  };

  if (!currentImageBase64) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 bg-slate-800 rounded-lg shadow-2xl border border-slate-700 overflow-hidden flex flex-col" style={{height: '400px'}}>
          <div className="bg-purple-900 p-3 border-b border-purple-800 flex justify-between items-center">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-300" />
              AI Art Advisor
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-slate-400 text-sm text-center italic mt-10">
                Ask about placement, style, or shading suggestions for this design.
              </p>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`p-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-slate-700 ml-8' : 'bg-purple-900/40 mr-8 border border-purple-800/30'}`}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="flex justify-center p-2">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
            <input 
              type="text" 
              className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1 text-sm focus:outline-none focus:border-purple-500"
              placeholder="Ask AI..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAsk()}
            />
            <button 
              onClick={handleAsk}
              disabled={loading || !prompt.trim()}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white p-2 rounded"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-full shadow-lg flex items-center gap-2 transition-all hover:scale-105"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-medium pr-1">AI Advisor</span>
      </button>
    </div>
  );
};

export default GeminiAdvisor;