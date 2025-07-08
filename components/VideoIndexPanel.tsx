import React from 'react';
import type { HistoryItem } from '../types';

interface VideoIndexPanelProps {
    indexedVideos: HistoryItem[];
    onVideoClick: (item: HistoryItem) => void;
}

export const VideoIndexPanel: React.FC<VideoIndexPanelProps> = ({ indexedVideos, onVideoClick }) => {
    const formatScore = (score: number | null): string => {
        if (score === null) return 'N/A';
        if (score === Infinity) return 'Perfect';
        return `${score.toFixed(1)}s/violation`;
    };

    const getScoreColor = (score: number | null): string => {
        if (score === null) return 'text-gray-400';
        if (score === Infinity) return 'text-green-400';
        if (score >= 100) return 'text-green-400';
        if (score >= 50) return 'text-yellow-400';
        if (score >= 20) return 'text-orange-400';
        return 'text-red-400';
    };

    const getViolationCount = (events: any[]): number => {
        return events.length;
    };

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100">Indexed Videos</h3>
                <span className="text-sm text-gray-400">{indexedVideos.length} videos</span>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {indexedVideos.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400">No videos indexed yet</p>
                        <p className="text-sm text-gray-500 mt-1">Analyze videos to add them to the index</p>
                    </div>
                ) : (
                    indexedVideos.map((video) => (
                        <div
                            key={video.videoId}
                            onClick={() => onVideoClick(video)}
                            className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 hover:border-gray-500"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h4 className="text-sm font-medium text-gray-100 line-clamp-2 flex-1 mr-2">
                                    {video.videoTitle}
                                </h4>
                                <div className="flex flex-col items-end text-xs">
                                    <span className={`font-semibold ${getScoreColor(video.kidFriendlyScore)}`}>
                                        {formatScore(video.kidFriendlyScore)}
                                    </span>
                                    <span className="text-gray-400">
                                        {getViolationCount(video.analysisEvents)} violations
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-gray-400">
                                <span className="truncate">{video.videoId}</span>
                                <a
                                    href={`/video/${video.videoId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    View Page
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}; 