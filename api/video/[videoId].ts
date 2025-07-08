import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { videoId } = req.query;

    if (!videoId || typeof videoId !== 'string') {
        return res.status(400).json({ error: 'Video ID is required' });
    }

    try {
        // For now, return a simple response
        // In the future, this could fetch from a database
        res.status(200).json({
            videoId,
            message: 'Video data endpoint - implement database integration here',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching video data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
} 