import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { EXTERNAL_API_TIMEOUT_MS } from '../../utils/consts';

export interface ApifyRunResult {
  id: string;
  status: string;
  defaultDatasetId: string;
}

export class ApifyService {
  private readonly apiToken: string;
  private readonly baseUrl = 'https://api.apify.com/v2';

  constructor() {
    this.apiToken = process.env['APIFY_API_TOKEN'] || '';
  }

  public hasToken(): boolean {
    return this.apiToken.trim() !== '';
  }

  public async runActor(actorId: string, input: Record<string, unknown>): Promise<any[]> {
    if (!this.hasToken()) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    const runResponse = await fetchWithTimeout(
      `${this.baseUrl}/acts/${actorId.replace('/', '~')}/run-sync-get-dataset-items?token=${this.apiToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        timeoutMs: EXTERNAL_API_TIMEOUT_MS * 4, // Apify actors take longer (up to 60s)
      }
    );

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Apify actor ${actorId} failed (${runResponse.status}): ${errorText}`);
    }

    return await runResponse.json() as any[];
  }
}
