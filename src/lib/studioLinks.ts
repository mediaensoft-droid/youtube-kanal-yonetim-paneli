// Deep links into YouTube Studio. No OAuth needed — these just navigate the browser;
// the user must already be signed into that channel's Google account.

export function studioCustomizeUrl(youtubeId: string): string {
  return `https://studio.youtube.com/channel/${youtubeId}/editing`;
}

export function studioVideosUrl(youtubeId: string): string {
  return `https://studio.youtube.com/channel/${youtubeId}/videos/upload`;
}

export function studioVideoEditUrl(videoId: string): string {
  return `https://studio.youtube.com/video/${videoId}/edit`;
}
