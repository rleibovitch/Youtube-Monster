import React from 'react';
import { videoIndexService } from '../services/videoIndexService';
import type { HistoryItem } from '../types';

export const LeaderboardPage: React.FC = () => {
    const videos: HistoryItem[] = videoIndexService.getAllVideos().slice().sort((a, b) => {
        // Sort by highest monster score to lowest (Infinity at top)
        if (a.kidFriendlyScore === b.kidFriendlyScore) return 0;
        if (a.kidFriendlyScore === Infinity) return -1;
        if (b.kidFriendlyScore === Infinity) return 1;
        return (b.kidFriendlyScore || 0) - (a.kidFriendlyScore || 0);
    });

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-6 text-gray-900">Leaderboard</h2>
                <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
                    <thead>
                        <tr className="bg-gray-100 text-left">
                            <th className="px-4 py-2">Video Title</th>
                            <th className="px-4 py-2">Monster Score</th>
                            <th className="px-4 py-2">Violations</th>
                            <th className="px-4 py-2">View</th>
                        </tr>
                    </thead>
                    <tbody>
                        {videos.map(video => (
                            <tr key={video.videoId} className="border-t border-gray-200 hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-800 truncate max-w-xs">{video.videoTitle}</td>
                                <td className="px-4 py-2 text-gray-700">{video.kidFriendlyScore === Infinity ? 'Perfect' : (video.kidFriendlyScore || 'N/A')}</td>
                                <td className="px-4 py-2 text-gray-700">{video.analysisEvents.length}</td>
                                <td className="px-4 py-2">
                                    <a
                                        href={`/video/${video.videoId}`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        View Analysis
                                    </a>
                                </td>
                            </tr>
                        ))}
                        {videos.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No videos analyzed yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <div className="mt-6">
                    <button
                        onClick={() => window.location.pathname = '/'}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        </div>
    );
}; 