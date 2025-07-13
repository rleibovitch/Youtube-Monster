import React from 'react';
import type { HistoryItem } from '../types';
import { PlayIcon } from './icons';

interface HistoryPanelProps {
    history: HistoryItem[];
    onItemClick: (item: HistoryItem) => void;
}

const HistoryItemCard: React.FC<{ item: HistoryItem; onClick: () => void; }> = ({ item, onClick }) => {
    // YouTube thumbnail URL format (mqdefault is a good balance of quality and size)
    const thumbnailUrl = `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;

    return (
        <div 
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
            aria-label={`Load analysis for ${item.videoTitle}`}
            className="group relative flex-shrink-0 w-60 cursor-pointer rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
        >
            <img src={thumbnailUrl} alt={item.videoTitle} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:bg-black/70 transition-colors flex flex-col justify-end p-3">
                {/* Overlay for play icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-blue-600/80 rounded-full p-3 backdrop-blur-sm">
                        <PlayIcon className="h-8 w-8 text-white" />
                    </div>
                </div>

                {/* Bottom text */}
                <h4 className="font-bold text-white text-sm line-clamp-2 drop-shadow-md">{item.videoTitle}</h4>
            </div>
        </div>
    );
};


export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onItemClick }) => {
    return (
        <aside className="w-full bg-white/90 backdrop-blur-sm border-t border-gray-200 p-4 mt-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4 px-2">Analysis History</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                {history.map(item => (
                    <HistoryItemCard 
                        key={item.videoId}
                        item={item}
                        onClick={() => onItemClick(item)}
                    />
                ))}
            </div>
        </aside>
    );
};
