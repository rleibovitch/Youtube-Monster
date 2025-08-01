import React, { useState, useEffect } from 'react';
import type { AnalysisEvent } from '../types';
import { NegativeCategory } from '../types';
import { InfoIcon, LoaderIcon } from './icons';

interface ContextualInfoPanelProps {
    events: AnalysisEvent[];
    activeDetections: AnalysisEvent[];
    onCardClick: (timestamp: number) => void;
    videoTitle: string;
    isLoading: boolean;
    kidFriendlyScore: number | null;
    extractionMethod?: string;
}

const formatTimestamp = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const getCategoryColor = (category: string): string => {
    switch (category) {
        case 'Negative Speech':
            return '#ca8a04'; // yellow-600
        case 'Negative Behavior':
            return '#dc2626'; // red-600
        case 'Potential Emotions':
            return '#9333ea'; // purple-600
        default:
            return '#6b7280'; // gray-500
    }
};

const ScoreDisplay: React.FC<{ score: number | null }> = ({ score }) => {
    if (score === null) return null;

    const getScoreStyle = () => {
        // Higher score (more seconds per violation point) is better.
        if (score === Infinity) return 'bg-green-600 border-green-500'; // Perfect score
        if (score > 60) return 'bg-green-600 border-green-500';      // Good: > 1 min per violation
        if (score > 20) return 'bg-yellow-600 border-yellow-500';  // Warning: > 20s per violation
        return 'bg-red-700 border-red-600';                        // Bad
    };

    const displayValue = score === Infinity ? '∞' : score.toFixed(1);

    return (
        <div className="flex flex-col items-center p-4 mb-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-base font-bold text-gray-700 mb-2">Monster Score</h3>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg border-4 ${getScoreStyle()}`}>
                <span className="text-4xl font-bold tracking-tight">{displayValue}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">Seconds per Violation | Higher is better</p>
        </div>
    );
};

const EventList: React.FC<{ events: AnalysisEvent[]; onCardClick: (timestamp: number) => void; expandedTimestamp?: number | null; onExpand?: (timestamp: number) => void; }> = ({ events, onCardClick, expandedTimestamp, onExpand }) => (
    <ul className="space-y-3">
        {events.map((event, index) => {
            const isExpanded = expandedTimestamp === event.timestamp;
            return (
                <li
                    key={index}
                    onClick={() => {
                        if (onExpand) onExpand(isExpanded ? null : event.timestamp);
                        onCardClick(event.timestamp);
                    }}
                    className={`bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-all border-l-4 border border-gray-200 ${isExpanded ? 'ring-2 ring-blue-200' : ''}`}
                    style={{ borderColor: getCategoryColor(event.category) }}
                >
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-gray-800">{event.subCategory}</span>
                        <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded">{formatTimestamp(event.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                    {isExpanded && (
                        <div className="mt-3 p-3 bg-gray-100 rounded">
                            <div className="mb-2">
                                <span className="font-semibold text-gray-700">Phrase:</span>
                                <span className="ml-2 italic text-gray-800">"{event.phrase || 'No phrase available.'}"</span>
                            </div>
                            <div>
                                <span className="font-semibold text-gray-700">Executive Summary:</span>
                                <span className="ml-2 text-gray-700">{generateExecutiveSummary(event)}</span>
                            </div>
                        </div>
                    )}
                </li>
            );
        })}
    </ul>
);

function generateExecutiveSummary(event: AnalysisEvent): string {
    switch (event.category) {
        case 'Negative Speech':
            return `Flagged for negative speech (${event.subCategory}): ${event.description}`;
        case 'Negative Behavior':
            return `Flagged for negative behavior (${event.subCategory}): ${event.description}`;
        case 'Potential Emotions':
            return `Flagged for potential negative emotion (${event.subCategory}): ${event.description}`;
        default:
            return event.description;
    }
}

export const ContextualInfoPanel: React.FC<ContextualInfoPanelProps> = ({ events, activeDetections, onCardClick, videoTitle, isLoading, kidFriendlyScore, extractionMethod }) => {
    const [viewMode, setViewMode] = useState<'all' | 'current'>('all');
    const [expandedTimestamp, setExpandedTimestamp] = useState<number | null>(null);
    
    useEffect(() => {
        // Reset to 'all' view when a new analysis starts
        if (isLoading || events.length === 0) {
            setViewMode('all');
            setExpandedTimestamp(null);
        }
    }, [isLoading, events]);

    const getExtractionMethodDisplay = (method: string) => {
        const methodMap: { [key: string]: { label: string; color: string; description: string } } = {
            'youtube-transcript-primary': { label: 'Primary Transcript', color: 'bg-green-100 text-green-800', description: 'Direct YouTube transcript' },
            'youtube-transcript-en': { label: 'English Transcript', color: 'bg-blue-100 text-blue-800', description: 'English language transcript' },
            'youtube-transcript-en-US': { label: 'US English Transcript', color: 'bg-blue-100 text-blue-800', description: 'US English transcript' },
            'youtube-transcript-en-GB': { label: 'UK English Transcript', color: 'bg-blue-100 text-blue-800', description: 'UK English transcript' },
            'youtube-transcript-auto': { label: 'Auto Transcript', color: 'bg-purple-100 text-purple-800', description: 'Auto-generated transcript' },
            'youtube-transcript-listed': { label: 'Listed Transcript', color: 'bg-indigo-100 text-indigo-800', description: 'From available transcripts list' },
            'web-scraping-youtube': { label: 'Web Scraped', color: 'bg-orange-100 text-orange-800', description: 'Extracted from YouTube page' },
            'ai-generated': { label: 'AI Generated', color: 'bg-pink-100 text-pink-800', description: 'AI-generated based on metadata' },
            'youtube-data-api': { label: 'YouTube API', color: 'bg-gray-100 text-gray-800', description: 'YouTube Data API metadata' },
            'huggingface-whisper-asr': { label: 'ASR Transcription', color: 'bg-teal-100 text-teal-800', description: 'Hugging Face Whisper speech recognition' },
            'unknown': { label: 'Unknown Method', color: 'bg-gray-100 text-gray-800', description: 'Method not specified' }
        };

        const methodInfo = methodMap[method] || { label: method, color: 'bg-gray-100 text-gray-800', description: 'Custom extraction method' };
        
        return (
            <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${methodInfo.color}`}>
                    {methodInfo.label}
                </span>
                <span className="text-xs text-gray-500">{methodInfo.description}</span>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg shadow-xl shadow-gray-200/50 h-full flex flex-col border border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                     <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <InfoIcon />
                        Contextual Information
                    </h2>
                     {!isLoading && events.length > 0 && (
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm">
                            <button onClick={() => setViewMode('current')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'current' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 hover:bg-gray-200'}`}>Current</button>
                            <button onClick={() => setViewMode('all')} className={`px-3 py-1 rounded-md transition-colors ${viewMode === 'all' ? 'bg-blue-600 text-white font-semibold' : 'text-gray-600 hover:bg-gray-200'}`}>All</button>
                        </div>
                    )}
                </div>
                {videoTitle && <p className="text-sm text-gray-500 mt-2 truncate">Analyzing: {videoTitle}</p>}
            </div>

            <div className="flex-grow p-4 overflow-y-auto no-scrollbar">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <LoaderIcon className="animate-spin h-8 w-8 mb-4" />
                        <p className="font-semibold">Generating AI Analysis...</p>
                        <p className="text-sm text-center mt-2">This may take a moment.</p>
                    </div>
                )}
                {!isLoading && events.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                        <p className="font-semibold">No Analysis Data</p>
                        <p className="text-sm mt-2">Press "Analyze" on a YouTube video to see detected events here.</p>
                    </div>
                )}
                {!isLoading && events.length > 0 && viewMode === 'all' && (
                    <>
                        <ScoreDisplay score={kidFriendlyScore} />
                        {extractionMethod && getExtractionMethodDisplay(extractionMethod)}
                        <EventList events={events} onCardClick={onCardClick} expandedTimestamp={expandedTimestamp} onExpand={setExpandedTimestamp} />
                    </>
                )}
                {!isLoading && events.length > 0 && viewMode === 'current' && (
                    activeDetections.length > 0 ? (
                        <EventList events={activeDetections} onCardClick={onCardClick} expandedTimestamp={expandedTimestamp} onExpand={setExpandedTimestamp} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
                            <p className="font-semibold">No Active Events</p>
                            <p className="text-sm mt-2">Nothing detected at the current timestamp.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};