import type { VercelRequest, VercelResponse } from '@vercel/node';
import { YoutubeTranscript } from 'youtube-transcript';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: "Missing 'videoId' in request body." });
  }

  // Validate videoId format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid video ID format. YouTube video IDs should be 11 characters long." });
  }

  const results = {
    videoId,
    timestamp: new Date().toISOString(),
    tests: [] as any[]
  };

  // Test 1: Check if video exists with YouTube Data API
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const video = data.items[0];
        results.tests.push({
          test: 'YouTube Data API - Video Check',
          success: true,
          details: {
            title: video.snippet?.title,
            channelTitle: video.snippet?.channelTitle,
            publishedAt: video.snippet?.publishedAt,
            duration: video.contentDetails?.duration,
            viewCount: video.statistics?.viewCount,
            status: video.status?.privacyStatus
          }
        });

        // Check captions
        const captionsResponse = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
        const captionsData = await captionsResponse.json();
        
        results.tests.push({
          test: 'YouTube Data API - Captions Check',
          success: true,
          details: {
            captionCount: captionsData.items?.length || 0,
            captions: captionsData.items?.map((caption: any) => ({
              language: caption.snippet?.language,
              trackKind: caption.snippet?.trackKind
            })) || []
          }
        });
      } else {
        results.tests.push({
          test: 'YouTube Data API - Video Check',
          success: false,
          error: 'Video not found or is private'
        });
      }
    } catch (err: any) {
      results.tests.push({
        test: 'YouTube Data API - Video Check',
        success: false,
        error: err.message
      });
    }
  } else {
    results.tests.push({
      test: 'YouTube Data API - Video Check',
      success: false,
      error: 'YOUTUBE_API_KEY not configured'
    });
  }

  // Test 2: Try to list available transcripts
  try {
    const availableTranscripts = await YoutubeTranscript.listTranscripts(videoId);
    results.tests.push({
      test: 'youtube-transcript - List Transcripts',
      success: true,
      details: {
        transcriptCount: availableTranscripts.length,
        transcripts: availableTranscripts.map((t: any) => ({
          language: t.language,
          languageCode: t.languageCode
        }))
      }
    });
  } catch (err: any) {
    results.tests.push({
      test: 'youtube-transcript - List Transcripts',
      success: false,
      error: err.message
    });
  }

  // Test 3: Try to fetch transcript with default language
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    results.tests.push({
      test: 'youtube-transcript - Fetch Default',
      success: true,
      details: {
        segmentCount: transcript.length,
        firstSegment: transcript[0] ? {
          text: transcript[0].text.substring(0, 100) + '...',
          offset: transcript[0].offset,
          duration: transcript[0].duration
        } : null,
        lastSegment: transcript[transcript.length - 1] ? {
          text: transcript[transcript.length - 1].text.substring(0, 100) + '...',
          offset: transcript[transcript.length - 1].offset,
          duration: transcript[transcript.length - 1].duration
        } : null
      }
    });
  } catch (err: any) {
    results.tests.push({
      test: 'youtube-transcript - Fetch Default',
      success: false,
      error: err.message
    });
  }

  // Test 4: Try with specific language codes
  const languageCodes = ['en', 'en-US', 'en-GB', 'auto'];
  for (const lang of languageCodes) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
      results.tests.push({
        test: `youtube-transcript - Fetch ${lang}`,
        success: true,
        details: {
          segmentCount: transcript.length
        }
      });
      break; // Stop after first successful language
    } catch (err: any) {
      results.tests.push({
        test: `youtube-transcript - Fetch ${lang}`,
        success: false,
        error: err.message
      });
    }
  }

  return res.status(200).json(results);
} 