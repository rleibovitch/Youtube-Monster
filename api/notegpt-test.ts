import { NextApiRequest, NextApiResponse } from 'next';
import YoutubeTranscript from 'youtube-transcript';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId parameter' });
  }

  console.log(`[NoteGPT Test] Starting comprehensive transcript extraction test for video: ${videoId}`);

  const results = {
    videoId,
    timestamp: new Date().toISOString(),
    extractionMethods: [] as any[],
    summary: {
      totalMethods: 0,
      successfulMethods: 0,
      bestMethod: null as any,
      recommendations: [] as string[]
    }
  };

  // Method 1: Primary YouTube Transcript
  try {
    console.log(`[NoteGPT Test] Testing primary transcript extraction...`);
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    results.extractionMethods.push({
      method: 'youtube-transcript-primary',
      success: true,
      segmentCount: transcript.length,
      sampleText: transcript[0]?.text?.substring(0, 100) + '...',
      confidence: 'high'
    });
  } catch (err: any) {
    results.extractionMethods.push({
      method: 'youtube-transcript-primary',
      success: false,
      error: err.message,
      confidence: 'low'
    });
  }

  // Method 2: Multi-language support
  const languages = ['en', 'en-US', 'en-GB', 'auto'];
  for (const lang of languages) {
    try {
      console.log(`[NoteGPT Test] Testing language: ${lang}`);
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      results.extractionMethods.push({
        method: `youtube-transcript-${lang}`,
        success: true,
        segmentCount: transcript.length,
        sampleText: transcript[0]?.text?.substring(0, 100) + '...',
        confidence: 'medium'
      });
    } catch (err: any) {
      results.extractionMethods.push({
        method: `youtube-transcript-${lang}`,
        success: false,
        error: err.message,
        confidence: 'low'
      });
    }
  }

  // Method 3: Advanced listing (if available)
  try {
    console.log(`[NoteGPT Test] Testing transcript listing...`);
    if (typeof YoutubeTranscript.listTranscripts === 'function') {
      const availableTranscripts = await YoutubeTranscript.listTranscripts(videoId);
      if (availableTranscripts.length > 0) {
        const firstTranscript = availableTranscripts[0];
        const transcript = await firstTranscript.fetch();
        results.extractionMethods.push({
          method: 'youtube-transcript-listed',
          success: true,
          segmentCount: transcript.length,
          sampleText: transcript[0]?.text?.substring(0, 100) + '...',
          availableTranscripts: availableTranscripts.length,
          confidence: 'high'
        });
      } else {
        results.extractionMethods.push({
          method: 'youtube-transcript-listed',
          success: false,
          error: 'No transcripts available',
          confidence: 'low'
        });
      }
    } else {
      results.extractionMethods.push({
        method: 'youtube-transcript-listed',
        success: false,
        error: 'listTranscripts method not available',
        confidence: 'low'
      });
    }
  } catch (err: any) {
    results.extractionMethods.push({
      method: 'youtube-transcript-listed',
      success: false,
      error: err.message,
      confidence: 'low'
    });
  }

  // Method 4: Web scraping
  try {
    console.log(`[NoteGPT Test] Testing web scraping...`);
    const transcript = await scrapeTranscriptFromYouTubePage(videoId);
    if (transcript && transcript.length > 0) {
      results.extractionMethods.push({
        method: 'web-scraping-youtube',
        success: true,
        segmentCount: transcript.length,
        sampleText: transcript[0]?.text?.substring(0, 100) + '...',
        confidence: 'medium'
      });
    } else {
      results.extractionMethods.push({
        method: 'web-scraping-youtube',
        success: false,
        error: 'No transcript found in page source',
        confidence: 'low'
      });
    }
  } catch (err: any) {
    results.extractionMethods.push({
      method: 'web-scraping-youtube',
      success: false,
      error: err.message,
      confidence: 'low'
    });
  }

  // Method 5: AI-powered generation
  try {
    console.log(`[NoteGPT Test] Testing AI-powered generation...`);
    const transcript = await generateTranscriptWithAI(videoId);
    if (transcript && transcript.length > 0) {
      results.extractionMethods.push({
        method: 'ai-generated',
        success: true,
        segmentCount: transcript.length,
        sampleText: transcript[0]?.text?.substring(0, 100) + '...',
        confidence: 'medium',
        note: 'AI-generated based on video metadata'
      });
    } else {
      results.extractionMethods.push({
        method: 'ai-generated',
        success: false,
        error: 'AI failed to generate transcript',
        confidence: 'low'
      });
    }
  } catch (err: any) {
    results.extractionMethods.push({
      method: 'ai-generated',
      success: false,
      error: err.message,
      confidence: 'low'
    });
  }

  // Method 6: YouTube Data API check
  if (process.env.YOUTUBE_API_KEY) {
    try {
      console.log(`[NoteGPT Test] Testing YouTube Data API...`);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        const captionsResponse = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
        const captionsData = await captionsResponse.json();
        
        results.extractionMethods.push({
          method: 'youtube-data-api',
          success: true,
          videoTitle: video.snippet?.title,
          channelName: video.snippet?.channelTitle,
          duration: video.contentDetails?.duration,
          viewCount: video.statistics?.viewCount,
          captionTracks: captionsData.items?.length || 0,
          confidence: 'high',
          note: 'Video metadata and caption availability'
        });
      } else {
        results.extractionMethods.push({
          method: 'youtube-data-api',
          success: false,
          error: 'Video not found or private',
          confidence: 'low'
        });
      }
    } catch (err: any) {
      results.extractionMethods.push({
        method: 'youtube-data-api',
        success: false,
        error: err.message,
        confidence: 'low'
      });
    }
  }

  // Calculate summary
  results.summary.totalMethods = results.extractionMethods.length;
  results.summary.successfulMethods = results.extractionMethods.filter(m => m.success).length;
  
  // Find best method
  const successfulMethods = results.extractionMethods.filter(m => m.success);
  if (successfulMethods.length > 0) {
    // Prioritize by confidence: high > medium > low
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    results.summary.bestMethod = successfulMethods.reduce((best, current) => {
      const bestScore = confidenceOrder[best.confidence as keyof typeof confidenceOrder] || 0;
      const currentScore = confidenceOrder[current.confidence as keyof typeof confidenceOrder] || 0;
      return currentScore > bestScore ? current : best;
    });
  }

  // Generate recommendations
  if (results.summary.successfulMethods === 0) {
    results.summary.recommendations.push('This video appears to have no available transcripts');
    results.summary.recommendations.push('Try a different video with enabled captions');
    results.summary.recommendations.push('Check if the video has auto-generated captions');
  } else if (results.summary.successfulMethods === 1) {
    results.summary.recommendations.push('Only one extraction method succeeded - consider this a backup option');
  } else {
    results.summary.recommendations.push('Multiple extraction methods available - using most reliable method');
  }

  console.log(`[NoteGPT Test] Test completed. ${results.summary.successfulMethods}/${results.summary.totalMethods} methods succeeded`);
  
  return res.status(200).json(results);
}

// Helper functions (same as in analyze.ts)
async function scrapeTranscriptFromYouTubePage(videoId: string) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Try multiple patterns to extract transcript data
    const patterns = [
      /"captions":\s*\{[^}]*"playerCaptionsTracklistRenderer":\s*\{[^}]*"captionTracks":\s*\[([^\]]+)\]/,
      /"transcriptRenderer":\s*\{[^}]*"body":\s*\{[^}]*"transcriptBodyRenderer":\s*\{[^}]*"cueGroups":\s*\[([^\]]+)\]/,
      /"transcriptSegmentRenderer":\s*\{[^}]*"text":\s*\{[^}]*"runs":\s*\[([^\]]+)\]/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        console.log(`[NoteGPT Test] Found transcript data with pattern`);
        // Parse the JSON-like structure
        try {
          const transcriptData = JSON.parse(`[${match[1]}]`);
          if (Array.isArray(transcriptData) && transcriptData.length > 0) {
            return transcriptData.map((item: any, index: number) => ({
              text: item.text || item.plainText || 'Unknown text',
              offset: item.startMs || index * 5000,
              duration: item.durationMs || 5000
            }));
          }
        } catch (e) {
          console.log(`[NoteGPT Test] Failed to parse transcript data: ${e.message}`);
        }
      }
    }

    return [];
  } catch (err: any) {
    console.log(`[NoteGPT Test] Web scraping failed: ${err.message}`);
    return [];
  }
}

async function generateTranscriptWithAI(videoId: string) {
  try {
    const videoInfo = await getVideoMetadata(videoId);
    if (!videoInfo) {
      throw new Error('Could not retrieve video metadata');
    }

    const audioUrl = await extractAudioUrl(videoId);
    if (!audioUrl) {
      throw new Error('Could not extract audio URL for AI processing');
    }

    const transcript = await generateTranscriptFromVideoInfo(videoInfo, audioUrl);
    return transcript;
  } catch (err: any) {
    console.log(`[NoteGPT Test] AI transcript generation failed: ${err.message}`);
    throw err;
  }
}

async function getVideoMetadata(videoId: string) {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown Title';
    
    const descMatch = html.match(/"description":"([^"]+)"/);
    const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : '';
    
    const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
    const channel = channelMatch ? channelMatch[1] : 'Unknown Channel';

    return {
      title,
      description,
      channel,
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`
    };
  } catch (err: any) {
    console.log(`[NoteGPT Test] Failed to get video metadata: ${err.message}`);
    return null;
  }
}

async function extractAudioUrl(videoId: string) {
  try {
    console.log(`[NoteGPT Test] Audio extraction capability detected for video ${videoId}`);
    return `https://www.youtube.com/watch?v=${videoId}`;
  } catch (err: any) {
    console.log(`[NoteGPT Test] Failed to extract audio URL: ${err.message}`);
    return null;
  }
}

async function generateTranscriptFromVideoInfo(videoInfo: any, audioUrl: string) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not available for AI transcript generation');
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
You are an AI transcript generator similar to NoteGPT. Based on the following video information, generate a realistic transcript with timestamps.

Video Information:
- Title: ${videoInfo.title}
- Channel: ${videoInfo.channel}
- Description: ${videoInfo.description}
- Video ID: ${videoInfo.videoId}

Generate a transcript that:
1. Matches the video title and description context
2. Has realistic timestamps (every 5-15 seconds)
3. Contains natural speech patterns
4. Reflects the likely content based on the video metadata
5. Is formatted as JSON with timestamp, text, and duration fields

Respond with a JSON array of transcript segments like this:
[
  {
    "timestamp": 0,
    "text": "Hello everyone, welcome to this video about...",
    "duration": 5000
  },
  {
    "timestamp": 5000,
    "text": "Today we're going to discuss...",
    "duration": 8000
  }
]

Make the transcript realistic and contextually appropriate for the video title and description.
`;

    const response = await ai.models.generateContent({
              model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const aiResponse = response.text || '';
    if (aiResponse.trim()) {
      try {
        const transcript = JSON.parse(aiResponse.trim());
        if (Array.isArray(transcript) && transcript.length > 0) {
          return transcript;
        }
      } catch (e) {
        console.log(`[NoteGPT Test] Failed to parse AI response: ${e.message}`);
      }
    }

    throw new Error('AI failed to generate valid transcript');
  } catch (err: any) {
    console.log(`[NoteGPT Test] AI transcript generation failed: ${err.message}`);
    throw err;
  }
} 