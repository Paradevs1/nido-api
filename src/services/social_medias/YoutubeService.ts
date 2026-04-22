import { ApifyService } from './ApifyService';

export interface YoutubeVideoMetrics {
  views: number;
  likes: number;
  comments: number;
}

export class YoutubeService {
  private readonly apify: ApifyService;

  constructor() {
    this.apify = new ApifyService();
  }

  public async getVideoMetrics(videoUrl: string): Promise<YoutubeVideoMetrics | null> {
    try {
      const results = await this.apify.runActor('streamers/youtube-scraper', {
        startUrls: [{ url: videoUrl }],
        maxResults: 1,
      });

      if (!results || results.length === 0) return null;

      const video = results[0];
      return {
        views: video.viewCount || 0,
        likes: video.likeCount || 0,
        comments: video.commentCount || 0,
      };
    } catch (error: any) {
      console.error(`YoutubeService.getVideoMetrics error for ${videoUrl}:`, error.message);
      return null;
    }
  }

  public isYoutubeUrl(url: string): boolean {
    return /youtube\.com\/watch/i.test(url) || /youtu\.be\//i.test(url) || /youtube\.com\/shorts\//i.test(url);
  }
}
