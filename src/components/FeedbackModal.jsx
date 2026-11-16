import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function FeedbackModal({ isOpen, onClose }) {
  const [feedback, setFeedback] = useState('');
  const [isSent, setIsSent] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsSent(false);
      setFeedback('');
    }
  }, [isOpen]);

  // Auto-close success message after 1.5 seconds
  useEffect(() => {
    if (isSent) {
      const timer = setTimeout(() => {
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSent, onClose]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!feedback.trim()) return;
    
    if (supabase) {
      try {
        const { error } = await supabase
          .from('feedbacks')
          .insert([
            {
              category: 'other',
              description: feedback,
              status: 'pending'
            }
          ]);
        if (error) throw error;
        console.log('[Supabase] Feedback saved successfully.');
      } catch (err) {
        console.error('[Supabase] Failed to submit feedback to database:', err);
      }
    } else {
      // Simulate sending
      console.log('Sending feedback locally:', feedback);
    }

    setIsSent(true);
    setFeedback('');
  };

  return (
    <div 
      className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {!isSent ? (
          <>
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div>
                <h3 className="text-white font-bold text-lg">Report an Issue</h3>
                <p className="text-slate-400 text-xs">Tell us what's wrong with the map or service</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Problem Description</label>
                <textarea 
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us the problem..."
                  className="w-full h-40 bg-slate-800/50 border border-slate-700 rounded-2xl p-4 text-white text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all resize-none placeholder:text-slate-600 shadow-inner"
                />
              </div>

              <button 
                onClick={handleSend}
                disabled={!feedback.trim()}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl shadow-xl shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Send Report</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="p-12 text-center space-y-4 bg-slate-900 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-500/20">
              <svg className="w-10 h-10 text-green-400 animate-in slide-in-from-bottom-2 duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-2xl">Sent successfully</h3>
            <p className="text-slate-400 text-sm">Thank you for helping us improve Kutaisi transit.</p>
          </div>
        )}
      </div>
    </div>
  );
}
