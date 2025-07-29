import { useEffect, useRef } from 'react';
import Typed from 'typed.js';

interface TypingAnimationProps {
  text?: string;
  className?: string;
  onComplete?: () => void;
}

export default function TypingAnimation({ text = 'Processing...', className = '', onComplete }: TypingAnimationProps) {
  const el = useRef<HTMLSpanElement>(null);
  const typed = useRef<Typed | null>(null);

  useEffect(() => {
    if (!el.current) return;

    // Clean up any existing instance
    if (typed.current) {
      typed.current.destroy();
    }

    const options = {
      strings: [text],
      typeSpeed: 20, // Reduced from 40 to make it faster
      startDelay: 300,
      showCursor: true,
      cursorChar: '|',
      loop: false,
      onComplete: () => {
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Create new Typed instance
    typed.current = new Typed(el.current, options);

    // Cleanup function
    return () => {
      if (typed.current) {
        typed.current.destroy();
      }
    };
  }, [text, onComplete]); // Re-run effect when text or onComplete changes

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" 
             style={{ animationDelay: '0ms', animationDuration: '600ms' }}></div>
        <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" 
             style={{ animationDelay: '150ms', animationDuration: '600ms' }}></div>
        <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" 
             style={{ animationDelay: '300ms', animationDuration: '600ms' }}></div>
      </div>
      <div className="min-h-[28px] flex items-center">
        <span ref={el} className="text-lg text-gray-600 dark:text-gray-300"></span>
      </div>
    </div>
  );
}