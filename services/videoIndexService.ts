import type { HistoryItem } from '../types';

// In-memory storage for demo purposes
// In production, this would be replaced with a database
let videoIndex: HistoryItem[] = [];

export const videoIndexService = {
    // Add or update a video in the index
    addVideo: (video: HistoryItem): void => {
        const existingIndex = videoIndex.findIndex(v => v.videoId === video.videoId);
        if (existingIndex >= 0) {
            videoIndex[existingIndex] = video;
        } else {
            videoIndex.push(video);
        }
        
        // Save to localStorage for persistence
        try {
            localStorage.setItem('youtube-monster-index', JSON.stringify(videoIndex));
        } catch (e) {
            console.warn('Failed to save to localStorage:', e);
        }
    },

    // Get all indexed videos
    getAllVideos: (): HistoryItem[] => {
        return [...videoIndex];
    },

    // Get a specific video by ID
    getVideo: (videoId: string): HistoryItem | undefined => {
        return videoIndex.find(v => v.videoId === videoId);
    },

    // Remove a video from the index
    removeVideo: (videoId: string): boolean => {
        const initialLength = videoIndex.length;
        videoIndex = videoIndex.filter(v => v.videoId !== videoId);
        
        if (videoIndex.length !== initialLength) {
            try {
                localStorage.setItem('youtube-monster-index', JSON.stringify(videoIndex));
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
            }
            return true;
        }
        return false;
    },

    // Load videos from localStorage on app start
    loadFromStorage: (): void => {
        try {
            const stored = localStorage.getItem('youtube-monster-index');
            if (stored) {
                videoIndex = JSON.parse(stored);
            }
        } catch (e) {
            console.warn('Failed to load from localStorage:', e);
            videoIndex = [];
        }
    },

    // Get video statistics
    getStats: () => {
        const totalVideos = videoIndex.length;
        const perfectVideos = videoIndex.filter(v => v.kidFriendlyScore === Infinity).length;
        const highScoreVideos = videoIndex.filter(v => v.kidFriendlyScore !== null && v.kidFriendlyScore >= 100).length;
        const totalViolations = videoIndex.reduce((sum, v) => sum + v.analysisEvents.length, 0);
        
        return {
            totalVideos,
            perfectVideos,
            highScoreVideos,
            totalViolations,
            averageViolations: totalVideos > 0 ? (totalViolations / totalVideos).toFixed(1) : '0'
        };
    },

    // Search videos by title or ID
    searchVideos: (query: string): HistoryItem[] => {
        const lowerQuery = query.toLowerCase();
        return videoIndex.filter(video => 
            video.videoTitle.toLowerCase().includes(lowerQuery) ||
            video.videoId.toLowerCase().includes(lowerQuery)
        );
    },

    // Get videos sorted by score (best first)
    getVideosByScore: (): HistoryItem[] => {
        return [...videoIndex].sort((a, b) => {
            if (a.kidFriendlyScore === null && b.kidFriendlyScore === null) return 0;
            if (a.kidFriendlyScore === null) return 1;
            if (b.kidFriendlyScore === null) return -1;
            if (a.kidFriendlyScore === Infinity && b.kidFriendlyScore === Infinity) return 0;
            if (a.kidFriendlyScore === Infinity) return -1;
            if (b.kidFriendlyScore === Infinity) return 1;
            return b.kidFriendlyScore - a.kidFriendlyScore;
        });
    }
}; 