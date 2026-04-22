import { ApifyService } from './ApifyService';

export interface InstagramPostMetrics {
  views: number;
  likes: number;
  comments: number;
  media_type: string;
}

export class InstagramService {
  private readonly apify: ApifyService;

  constructor() {
    this.apify = new ApifyService();
  }

  public async getPostMetrics(postUrl: string): Promise<InstagramPostMetrics | null> {
    try {
      const results = await this.apify.runActor('apify/instagram-scraper', {
        directUrls: [postUrl],
        resultsType: 'posts',
        resultsLimit: 1,
      });

      if (!results || results.length === 0) return null;

      const post = results[0];
      return {
        views: post.videoViewCount || post.videoPlayCount || 0,
        likes: post.likesCount >= 0 ? post.likesCount : 0,
        comments: post.commentsCount || 0,
        media_type: post.type || '',
      };
    } catch (error: any) {
      console.error(`InstagramService.getPostMetrics error for ${postUrl}:`, error.message);
      return null;
    }
  }

  public isInstagramUrl(url: string): boolean {
    return /instagram\.com\/(p|reel|tv)\//i.test(url);
  }
}
