import React from 'react';

interface LoadingAnimationProps {
  type: 'upload' | 'generate';
  progress?: number;
}

export default function LoadingAnimation({ type, progress }: LoadingAnimationProps) {
  if (type === 'upload') {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0">
            <svg
              className="animate-bounce w-full h-full text-indigo-500 dark:text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          {typeof progress === 'number' && (
            <div className="absolute inset-0">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-gray-200 dark:text-gray-700"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                  r="42"
                  cx="50"
                  cy="50"
                />
                <circle
                  className="text-indigo-500 dark:text-indigo-400 transform -rotate-90 origin-center transition-all duration-300"
                  strokeWidth="8"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * progress) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="42"
                  cx="50"
                  cy="50"
                />
              </svg>
            </div>
          )}
        </div>
        <p className="text-indigo-600 dark:text-indigo-400 font-medium">
          {progress ? `Uploading... ${progress}%` : 'Processing...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 animate-spin">
          <svg className="w-full h-full text-indigo-500 dark:text-indigo-400" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-2V4c4.418 0 8 3.582 8 8s-3.582 8-8 8z"
              opacity="0.2"
            />
            <path
              fill="currentColor"
              d="M12 4v2c-3.314 0-6 2.686-6 6s2.686 6 6 6 6-2.686 6-6h2c0 4.418-3.582 8-8 8s-8-3.582-8-8 3.582-8 8-8z"
            />
          </svg>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-indigo-600 dark:text-indigo-400 font-medium">Generating Report</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Using AI to analyze your document...</p>
      </div>
    </div>
  );
}