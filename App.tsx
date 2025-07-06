import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UrlInputForm } from './components/UrlInputForm';
import { YouTubePlayer } from './components/YouTubePlayer';
import { MonsterDetector } from './components/MonsterDetector';
import { ContextualInfoPanel } from './components/ContextualInfoPanel';
import { generateAnalysis } from './services/geminiService';
import type { AnalysisEvent } from './types';
import { LogoIcon } from './components/icons';
import { EVENT_PENALTIES } from './constants';

const App: React.FC = () => {
    const [youtubeUrl, setYoutubeUrl] = useState<string>('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    const [videoId, setVideoId] = useState<string | null>(null);
    const [videoTitle, setVideoTitle] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [analysisEvents, setAnalysisEvents] = useState<AnalysisEvent[]>([]);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [activeDetections, setActiveDetections] = useState<AnalysisEvent[]>([]);
    const [kidFriendlyScore, setKidFriendlyScore] = useState<number | null>(null);
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    
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


    const handleAnalyze = async (url: string) => {
        setIsLoading(true);
        setError(null);
        setAnalysisEvents([]);
        setVideoId(null);
        setKidFriendlyScore(null);
        setVideoDuration(null);
        
        const extractedId = extractVideoId(url);
        if (!extractedId) {
            setError('Invalid YouTube URL. Please use a valid youtube.com or youtu.be link.');
            setIsLoading(false);
            return;
        }

        try {
            const events = await generateAnalysis('a heated online debate or argument');
            setAnalysisEvents(events.sort((a, b) => a.timestamp - b.timestamp));
            setVideoId(extractedId);
        } catch (e) {
            console.error(e);
            if (e instanceof Error) {
                setError(e.message);
            } else {
                setError('An unknown error occurred during analysis.');
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

    useEffect(() => {
        const active = analysisEvents.filter(event => 
            currentTime >= event.timestamp && currentTime < event.timestamp + 5
        );
        setActiveDetections(active);
    }, [currentTime, analysisEvents]);

    useEffect(() => {
        // A score can be calculated as soon as the video duration is known.
        // It will be recalculated if the analysis events change.
        if (videoDuration !== null) {
            const score = calculateScore(analysisEvents, videoDuration);
            setKidFriendlyScore(score);
        } else {
            setKidFriendlyScore(null);
        }
    }, [analysisEvents, videoDuration]);


    return (
        <div className="min-h-screen flex flex-col bg-gray-900">
            <header className="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <LogoIcon />
                    <h1 className="text-xl font-bold text-gray-100">YouTube Monster Scanner</h1>
                </div>
                <UrlInputForm onSubmit={handleAnalyze} isLoading={isLoading} initialUrl={youtubeUrl} />
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
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800">
                                <p className="text-gray-400">Enter a YouTube URL to begin analysis.</p>
                                {error && <p className="mt-4 text-red-400 bg-red-900/50 px-4 py-2 rounded-md">{error}</p>}
                            </div>
                        )}
                    </div>
                    <MonsterDetector activeDetections={activeDetections} />
                </div>
                
                <div className="lg:col-span-1">
                    <ContextualInfoPanel 
                      events={analysisEvents} 
                      activeDetections={activeDetections}
                      onCardClick={handleSeekTo} 
                      videoTitle={videoTitle}
                      isLoading={isLoading}
                      kidFriendlyScore={kidFriendlyScore}
                    />
                </div>
            </main>
        </div>
    );
};

export default App;