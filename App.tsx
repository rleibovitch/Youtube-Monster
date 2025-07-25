import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UrlInputForm } from './components/UrlInputForm';
import { YouTubePlayer } from './components/YouTubePlayer';
import { MonsterDetector } from './components/MonsterDetector';
import { ContextualInfoPanel } from './components/ContextualInfoPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { VideoIndexPanel } from './components/VideoIndexPanel';
import { Router } from './components/Router';
import { generateAnalysis } from './services/geminiService';
import { videoIndexService } from './services/videoIndexService';
import type { AnalysisEvent, HistoryItem } from './types';
import { LogoIcon } from './components/icons';
import { EVENT_PENALTIES } from './constants';

const App: React.FC = () => {
    const [youtubeUrl, setYoutubeUrl] = useState<string>('');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [videoTitle, setVideoTitle] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisEvents, setAnalysisEvents] = useState<AnalysisEvent[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [activeDetections, setActiveDetections] = useState<AnalysisEvent[]>([]);
    const [kidFriendlyScore, setKidFriendlyScore] = useState<number | null>(null);
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [indexedVideos, setIndexedVideos] = useState<HistoryItem[]>([]);
    const [showIndexPanel, setShowIndexPanel] = useState<boolean>(false);
    const [extractionMethod, setExtractionMethod] = useState<string>('');
    
    const playerRef = useRef<YT.Player | null>(null);

    const extractVideoId = (url: string): string | null => {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === 'youtu.be') {
                return urlObj.pathname.slice(1);
            }
            if (urlObj.hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }
        } catch (e) {
            // Ignore invalid URLs
        }
        return null;
    };
    
    const calculateScore = (events: AnalysisEvent[], duration: number | null): number | null => {
        if (!duration || duration <= 0) {
            return null;
        }

        let penaltySum = 0;
        for (const event of events) {
            penaltySum += EVENT_PENALTIES[event.subCategory] || 0;
        }
        
        if (penaltySum === 0) {
            return Infinity; // Perfect score: infinite seconds per violation.
        }

        // The score is seconds per violation point. Higher is better.
        return duration / penaltySum;
    };

    const updateUrl = (newVideoId: string) => {
        const newUrl = `/video/${newVideoId}`;
        window.history.pushState(null, '', newUrl);
    };

    const handleAnalyze = async (url: string) => {
        setIsLoading(true);
        setError(null);
        setAnalysisEvents([]);
        setKidFriendlyScore(null);
        setVideoDuration(null);
        setYoutubeUrl(url);
        
        const extractedId = extractVideoId(url);
        if (!extractedId) {
            setError('Invalid YouTube URL. Please use a valid youtube.com or youtu.be link.');
            setIsLoading(false);
            return;
        }

        console.log('Starting analysis for video:', extractedId);
        
        try {
            // If videoDuration is available, pass it; otherwise, skip
            const result = await generateAnalysis('a heated online debate or argument', videoDuration || undefined, extractedId);
            console.log('Analysis result:', result);
            
            if (result.events && result.events.length > 0) {
                setAnalysisEvents(result.events.sort((a, b) => a.timestamp - b.timestamp));
                setExtractionMethod(result.extractionMethod || 'unknown');
                setVideoId(extractedId);
                updateUrl(extractedId);
                console.log('Analysis completed successfully with', result.events.length, 'events');
            } else {
                console.log('Analysis completed but no events found');
                setError('Analysis completed but no negative content was detected in this video.');
                setVideoId(extractedId);
                updateUrl(extractedId);
            }
        } catch (e) {
            console.error('Analysis failed:', e);
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError('An unknown error occurred during analysis.');
            }
            // Keep the current videoId if analysis fails, so the UI doesn't disappear
            // Only set videoId if we don't already have one
            if (!videoId) {
                setVideoId(extractedId);
                updateUrl(extractedId);
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handlePlayerReady = useCallback((player: YT.Player) => {
        playerRef.current = player;
        const videoData = (player.getVideoData as any)();
        setVideoTitle(videoData.title);
    }, []);

    const handleDurationChange = useCallback((duration: number) => {
        setVideoDuration(duration);
    }, []);

    const handleTimeUpdate = useCallback((time: number) => {
        setCurrentTime(time);
    }, []);

    const handleSeekTo = (time: number) => {
        playerRef.current?.seekTo(time, true);
    };

    const handleHistoryClick = (item: HistoryItem) => {
        setIsLoading(false);
        setError(null);

        setYoutubeUrl(item.youtubeUrl);
        setVideoId(item.videoId);
        setVideoTitle(item.videoTitle);
        setAnalysisEvents(item.analysisEvents);
        setKidFriendlyScore(item.kidFriendlyScore);
        setExtractionMethod(item.extractionMethod || 'unknown');
        
        setCurrentTime(0);
        setVideoDuration(null);
        
        playerRef.current?.seekTo(0, true);
        updateUrl(item.videoId);
    };

    const handleVideoLoad = (video: HistoryItem) => {
        setYoutubeUrl(video.youtubeUrl);
        setVideoId(video.videoId);
        setVideoTitle(video.videoTitle);
        setAnalysisEvents(video.analysisEvents);
        setKidFriendlyScore(video.kidFriendlyScore);
        setExtractionMethod(video.extractionMethod || 'unknown');
        setCurrentTime(0);
        setVideoDuration(null);
    };

    const handleIndexVideoClick = (item: HistoryItem) => {
        handleHistoryClick(item);
    };

    const refreshIndexedVideos = () => {
        setIndexedVideos(videoIndexService.getAllVideos());
    };

    useEffect(() => {
        const active = analysisEvents.filter(event => 
            currentTime >= event.timestamp && currentTime < event.timestamp + 5
        );
        setActiveDetections(active);
    }, [currentTime, analysisEvents]);

    useEffect(() => {
        if (videoDuration !== null) {
            const score = calculateScore(analysisEvents, videoDuration);
            setKidFriendlyScore(score);

            // Once all data is available for a new video, add it to history and index
            if (videoId && videoTitle && analysisEvents.length > 0 && youtubeUrl) {
                const newHistoryItem: HistoryItem = {
                   videoId,
                   videoTitle,
                   youtubeUrl,
                   analysisEvents,
                   kidFriendlyScore: score,
                   extractionMethod,
                };
                
                setHistory(prevHistory => {
                    // Remove any existing entry for this videoId to prevent duplicates
                    const filteredHistory = prevHistory.filter(item => item.videoId !== videoId);
                    // Add the new or updated item to the front
                    return [newHistoryItem, ...filteredHistory];
                });

                // Add to video index
                videoIndexService.addVideo(newHistoryItem);
                refreshIndexedVideos();
            }
        } else {
            setKidFriendlyScore(null);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysisEvents, videoDuration, videoId, videoTitle]); // youtubeUrl is intentionally omitted to avoid loops on manual input change

    useEffect(() => {
        // Load indexed videos on component mount
        refreshIndexedVideos();
    }, []);

    // On mount, auto-load the video with the lowest monster score (excluding Infinity if possible)
    useEffect(() => {
        if (history.length > 0 && !videoId) {
            // Find the video with the lowest kidFriendlyScore (excluding Infinity if possible)
            let minVideo = history[0];
            for (const vid of history) {
                if (
                    (vid.kidFriendlyScore !== Infinity &&
                        (minVideo.kidFriendlyScore === Infinity || (vid.kidFriendlyScore || 0) < (minVideo.kidFriendlyScore || 0))) ||
                    (vid.kidFriendlyScore === Infinity && minVideo.kidFriendlyScore === Infinity)
                ) {
                    minVideo = vid;
                }
            }
            handleHistoryClick(minVideo);
        }
    }, [history, videoId]);

    return (
        <Router onVideoLoad={handleVideoLoad}>
            <div className="min-h-screen flex flex-col bg-gray-50">
                <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <LogoIcon />
                        <h1 className="text-xl font-bold text-gray-900">YouTube Monster Scanner</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => window.location.pathname = '/leaderboard'}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm transition-colors font-semibold"
                        >
                            Leaderboard
                        </button>
                        <button
                            onClick={() => setShowIndexPanel(!showIndexPanel)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                        >
                            {showIndexPanel ? 'Hide Index' : 'Show Index'}
                        </button>
                        <UrlInputForm onSubmit={handleAnalyze} isLoading={isLoading} initialUrl={youtubeUrl} />
                    </div>
                </header>
                
                <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <div className="flex-grow aspect-video bg-black rounded-lg overflow-hidden shadow-2xl shadow-black/50">
                            {videoId ? (
                                <YouTubePlayer 
                                    videoId={videoId} 
                                    onReady={handlePlayerReady}
                                    onTimeUpdate={handleTimeUpdate} 
                                    onDurationChange={handleDurationChange}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                                    <p className="text-gray-600">Enter a YouTube URL to begin analysis.</p>
                                    {error && <p className="mt-4 text-red-600 bg-red-100 px-4 py-2 rounded-md">{error}</p>}
                                </div>
                            )}
                        </div>
                        <MonsterDetector activeDetections={activeDetections} />
                        {history.length > 0 && (
                            <HistoryPanel history={history} onItemClick={handleHistoryClick} />
                        )}
                    </div>
                    
                    <div className="lg:col-span-1">
                        <ContextualInfoPanel 
                          events={analysisEvents} 
                          activeDetections={activeDetections}
                          onCardClick={handleSeekTo} 
                          videoTitle={videoTitle}
                          isLoading={isLoading}
                          kidFriendlyScore={kidFriendlyScore}
                          extractionMethod={extractionMethod}
                        />
                    </div>
                </main>

                {showIndexPanel && (
                    <div className="border-t border-gray-200 p-4">
                        <VideoIndexPanel 
                            indexedVideos={indexedVideos} 
                            onVideoClick={handleIndexVideoClick} 
                        />
                    </div>
                )}
            </div>
        </Router>
    );
};

export default App;
