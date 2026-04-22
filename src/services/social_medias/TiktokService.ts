import { ApifyService } from './ApifyService';

export interface TiktokVideoMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export class TiktokService {
  private readonly apify: ApifyService;

  constructor() {
    this.apify = new ApifyService();
  }

  public async getVideoMetrics(videoUrl: string): Promise<TiktokVideoMetrics | null> {
    try {
      const results = await this.apify.runActor('clockworks/tiktok-video-scraper', {
        postURLs: [videoUrl],
      });

      if (!results || results.length === 0) return null;

      const video = results[0];
      return {
        views: video.playCount || 0,
        likes: video.diggCount || 0,
        comments: video.commentCount || 0,
        shares: video.shareCount || 0,
        saves: video.collectCount || 0,
      };
    } catch (error: any) {
      console.error(`TiktokService.getVideoMetrics error for ${videoUrl}:`, error.message);
      return null;
    }
  }

  public isTiktokUrl(url: string): boolean {
    return /tiktok\.com\/.+\/video\//i.test(url) || /vm\.tiktok\.com\//i.test(url);
  }
}
