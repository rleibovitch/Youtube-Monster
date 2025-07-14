import React, { useEffect, useState } from 'react';
import { videoIndexService } from '../services/videoIndexService';
import type { HistoryItem } from '../types';
import { LeaderboardPage } from './LeaderboardPage';

interface RouterProps {
    children: React.ReactNode;
    onVideoLoad: (video: HistoryItem) => void;
}

export const Router: React.FC<RouterProps> = ({ children, onVideoLoad }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isLeaderboard, setIsLeaderboard] = useState(false);

    useEffect(() => {
        // Load indexed videos from storage
        videoIndexService.loadFromStorage();
        
        // Check if we're on a video page or leaderboard
        const path = window.location.pathname;
        if (path === '/leaderboard') {
            setIsLeaderboard(true);
            setIsLoading(false);
            return;
        }
        const videoMatch = path.match(/^\/video\/([^\/]+)$/);
        
        if (videoMatch) {
            const videoId = videoMatch[1];
            const video = videoIndexService.getVideo(videoId);
            
            if (video) {
                onVideoLoad(video);
            } else {
                // Video not found in index, redirect to home
                window.history.replaceState(null, '', '/');
            }
        }
        
        setIsLoading(false);
    }, [onVideoLoad]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    if (isLeaderboard) {
        return <LeaderboardPage />;
    }

    return <>{children}</>;
}; 