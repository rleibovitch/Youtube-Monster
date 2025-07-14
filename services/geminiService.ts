import type { AnalysisEvent } from '../types';

export const generateAnalysis = async (videoTopic: string, videoDuration?: number, videoId?: string): Promise<AnalysisEvent[]> => {
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ videoTopic, videoDuration, videoId }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})); 
            const errorMessage = errorData.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
            return data as AnalysisEvent[];
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
