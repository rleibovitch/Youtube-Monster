// This file provides type definitions for the YouTube Iframe Player API script.
// It declares the `YT` global object and its associated types, which are loaded
// from an external script and are not available as a standard ES module.

// By declaring these types in the global scope, we make them available
// throughout the project without needing to import them, which matches
// how the YouTube API script works.

declare namespace YT {
  /**
   * The state of the player.
   */
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  /**
   * Options for the YouTube player.
   */
  interface PlayerOptions {
    videoId?: string;
    playerVars?: PlayerVars;
    events?: PlayerEvents;
    height?: string;
    width?: string;
  }

  /**
   * Player variables to customize the player appearance and behavior.
   */
  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    modestbranding?: 1;
    rel?: 0;
  }

  /**
   * Event handlers for the player.
   */
  interface PlayerEvents {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
  }
  
  /**
   * The main YouTube Player class.
   */
  class Player {
    constructor(elementId: string | HTMLDivElement, options: PlayerOptions);
    
    // Methods used in this application
    destroy(): void;
    getCurrentTime(): number;
    getDuration(): number;
    getVideoData(): VideoData;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    getPlayerState(): PlayerState;
  }

  /**
   * Data about the currently loaded video.
   */
  interface VideoData {
    video_id: string;
    author: string;
    title: string;
  }
  
  // Event-related interfaces
  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent extends PlayerEvent {
    data: PlayerState;
  }
}

/**
 * Augment the global Window interface to include properties set by the
 * YouTube Iframe Player API script.
 */
interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT?: typeof YT;
}
