import type { AnalysisEvent, AnalysisResult, ASRResult } from '../types';
import { transcribeWithASR, analyzeWithASR } from './asrService';

export const generateAnalysis = async (videoTopic: string, videoDuration?: number, videoId?: string): Promise<AnalysisResult> => {
    try {
        console.log('Making API request to /api/analyze with:', { videoTopic, videoDuration, videoId });
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoTopic, videoDuration, videoId }),
        });

        console.log('API response status:', response.status);
        console.log('API response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            const errorMessage = errorData.error || `Request failed with status ${response.status}`;
            console.error('API error response:', errorData);
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('API response data:', data);
        
        // Handle both old format (array) and new format (object with events)
        if (Array.isArray(data)) {
            return {
                events: data as AnalysisEvent[],
                extractionMethod: 'unknown',
                transcriptSegmentCount: data.length
            };
        } else if (data.events && Array.isArray(data.events)) {
            return data as AnalysisResult;
        } else if (data.asrTranscript && Array.isArray(data.asrTranscript)) {
            // Handle ASR fallback case - need to analyze the ASR transcript
            console.log('ASR transcript received, analyzing with ASR service...');
            return await analyzeWithASR(videoId!, 5, videoDuration);
        } else {
            throw new Error("Invalid data format received from analysis server.");
        }
    } catch (e) {
        console.error("Failed to fetch analysis from server:", e);
        if (e instanceof Error) {
            throw e;
        }
        throw new Error("An unknown network error occurred while fetching the analysis.");
    }
};
