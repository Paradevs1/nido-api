export interface ShortIOApiResponse {
  idString?: string;
  shortURL?: string;
  originalURL?: string;
  domain?: string;
  [key: string]: any;
}

export interface ShortIOClicksResponse {
  clicks?: number;
  [key: string]: any;
}
