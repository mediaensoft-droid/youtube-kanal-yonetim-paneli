export interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YouTubeChannelListItem {
  id: string;
  snippet?: {
    title: string;
    description?: string;
    publishedAt?: string;
    country?: string;
    customUrl?: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
  };
  statistics?: {
    subscriberCount?: string;
    videoCount?: string;
    viewCount?: string;
    hiddenSubscriberCount?: boolean;
  };
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
}

export interface YouTubeChannelListResponse {
  items?: YouTubeChannelListItem[];
  error?: YouTubeApiErrorBody;
}

export interface YouTubeSearchListItem {
  id?: { channelId?: string };
}

export interface YouTubeSearchListResponse {
  items?: YouTubeSearchListItem[];
  error?: YouTubeApiErrorBody;
}

export interface YouTubePlaylistItem {
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
}

export interface YouTubePlaylistItemsResponse {
  items?: YouTubePlaylistItem[];
  error?: YouTubeApiErrorBody;
}

export interface YouTubeVideoListItem {
  id: string;
  snippet?: {
    title: string;
    publishedAt?: string;
    thumbnails?: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

export interface YouTubeVideoListResponse {
  items?: YouTubeVideoListItem[];
  error?: YouTubeApiErrorBody;
}

export interface YouTubeApiErrorBody {
  code: number;
  message: string;
  errors?: { reason: string; message: string }[];
}
