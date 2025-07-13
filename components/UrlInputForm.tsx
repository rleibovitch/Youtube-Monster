import React, { useState } from 'react';
import { PlayIcon, LoaderIcon } from './icons';

interface UrlInputFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  initialUrl: string;
}

export const UrlInputForm: React.FC<UrlInputFormProps> = ({ onSubmit, isLoading, initialUrl }) => {
  const [url, setUrl] = useState(initialUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Enter YouTube URL..."
        className="w-64 md:w-96 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={isLoading}
        className="flex items-center justify-center gap-2 px-4 py-1.5 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
      >
        {isLoading ? (
          <>
            <LoaderIcon className="animate-spin" />
            <span>Analyzing...</span>
          </>
        ) : (
           <>
            <PlayIcon />
            <span>Analyze</span>
          </>
        )}
      </button>
    </form>
  );
};