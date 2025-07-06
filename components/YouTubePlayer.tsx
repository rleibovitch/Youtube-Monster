
import React, { useEffect, useRef } from 'react';

interface YouTubePlayerProps {
    videoId: string;
    onReady: (player: YT.Player) => void;
    onTimeUpdate: (time: number) => void;
    onDurationChange: (duration: number) => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ videoId, onReady, onTimeUpdate, onDurationChange }) => {
    const playerRef = useRef<HTMLDivElement>(null); // This is the div element
    const playerInstanceRef = useRef<YT.Player | null>(null); // This holds the YT.Player object
    const timeIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        // This function creates the YouTube player
        const createPlayer = () => {
            if (!playerRef.current) return;

            // Defensive cleanup of any existing player/interval.
            if (playerInstanceRef.current) {
                try {
                    playerInstanceRef.current.destroy();
                } catch(e) {
                    console.error("Error destroying previous player instance", e);
                }
            }
            if (timeIntervalRef.current) {
                clearInterval(timeIntervalRef.current);
            }

            // Create the new player instance and store it in our ref
            playerInstanceRef.current = new YT.Player(playerRef.current, {
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                },
                events: {
                    onReady: (event) => {
                        onReady(event.target);
                        const duration = event.target.getDuration();
                        if(duration) {
                            onDurationChange(duration);
                        }
                    },
                    onStateChange: (event) => {
                        // When the player's state changes (playing, paused, etc.)
                        if (event.data === YT.PlayerState.PLAYING) {
                            // If we're already tracking time, clear the old interval
                            if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
                            
                            // Start a new interval to poll for the current time.
                            timeIntervalRef.current = window.setInterval(() => {
                                // IMPORTANT: Always get the player instance from the ref inside the interval.
                                // This prevents using a stale reference to a destroyed player.
                                const currentPlayer = playerInstanceRef.current;
                                if (currentPlayer && typeof currentPlayer.getCurrentTime === 'function') {
                                    onTimeUpdate(currentPlayer.getCurrentTime());
                                }
                            }, 500);
                        } else {
                             // If the video is not playing (paused, ended, etc.), stop the timer.
                            if (timeIntervalRef.current) {
                                clearInterval(timeIntervalRef.current);
                                timeIntervalRef.current = null;
                            }
                        }
                    }
                }
            });
        };

        // The YouTube IFrame API script loads asynchronously.
        if (window.YT && window.YT.Player) {
            createPlayer();
        } else {
            // If the API isn't loaded, set the global callback. It will be called by the YT script
            // once it has loaded.
            window.onYouTubeIframeAPIReady = createPlayer;
        }

        // The effect's cleanup function is critical for preventing memory leaks.
        return () => {
            if (timeIntervalRef.current) {
                clearInterval(timeIntervalRef.current);
            }
            // Use a try-catch as a safeguard, as the YouTube API can sometimes
            // throw an error during destruction if the player's state is unusual.
            try {
                if (playerInstanceRef.current && typeof playerInstanceRef.current.destroy === 'function') {
                    playerInstanceRef.current.destroy();
                }
            } catch (error) {
                console.error("Error destroying YouTube player:", error);
            }
            playerInstanceRef.current = null;
        };
    }, [videoId, onReady, onTimeUpdate, onDurationChange]);

    // The player will be attached to this div. The `ref` allows the YouTube API to target it.
    // The ID attribute is removed as it's not needed and can cause issues.
    return <div ref={playerRef} className="w-full h-full"></div>;
};