export interface TwitterApiResponseDTO {
    tweets: TweetDTO[];
    status: string;
    msg: string;
    code: number;
}

export interface TweetDTO {
    type: string;
    id: string;
    url: string;
    twitterUrl?: string;
    text: string;
    source: string;
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    viewCount: number;
    createdAt: string;
    lang: string;
    bookmarkCount: number;
    isReply: boolean;
    inReplyToId?: string;
    conversationId: string;
    displayTextRange: number[];
    inReplyToUserId?: string;
    inReplyToUsername?: string;
    isPinned?: boolean;
    isRetweet?: boolean;
    isQuote?: boolean;
    isConversationControlled?: boolean;
    author: AuthorDTO;
    entities: EntitiesDTO;
    extendedEntities?: ExtendedEntitiesDTO;
    card?: Record<string, any>;
    place?: Record<string, any>;
    quoted_tweet?: Record<string, any> | null;
    retweeted_tweet?: Record<string, any> | null;
    isLimitedReply: boolean;
}

export interface AuthorDTO {
    type: string;
    userName: string;
    url: string;
    twitterUrl?: string;
    id: string;
    name: string;
    isVerified?: boolean;
    isBlueVerified: boolean;
    verifiedType: string | null;
    profilePicture: string;
    coverPicture: string;
    description: string;
    location: string;
    followers: number;
    following: number;
    status?: string;
    canDm: boolean;
    canMediaTag?: boolean;
    createdAt: string;
    favouritesCount: number;
    fastFollowersCount?: number;
    hasCustomTimelines: boolean;
    isTranslator: boolean;
    mediaCount: number;
    statusesCount: number;
    withheldInCountries: string[];
    affiliatesHighlightedLabel: Record<string, any>;
    possiblySensitive: boolean;
    pinnedTweetIds: string[];
    isAutomated: boolean;
    automatedBy: string | null;
    unavailable?: boolean;
    message?: string;
    unavailableReason?: string;
    entities?: AuthorEntitiesDTO;
    profile_bio: ProfileBioDTO;
    withheld_in_countries?: string[];
}

export interface ProfileBioDTO {
    description: string;
    entities: ProfileEntitiesDTO;
}

export interface ProfileEntitiesDTO {
    description: UrlEntitiesDTO;
    url: UrlEntitiesDTO;
}

export interface UrlEntitiesDTO {
    urls: UrlDTO[];
}

export interface UrlDTO {
    display_url: string;
    expanded_url: string;
    indices: number[];
    url: string;
}

export interface EntitiesDTO {
    hashtags: HashtagDTO[];
    urls: UrlDTO[];
    user_mentions: UserMentionDTO[];
}

export interface HashtagDTO {
    indices: number[];
    text: string;
}

export interface UserMentionDTO {
    id_str: string;
    name: string;
    screen_name: string;
    indices?: number[];
}

export interface AuthorEntitiesDTO {
    description: UrlEntitiesDTO;
}

export interface ExtendedEntitiesDTO {
    media?: MediaDTO[];
}

export interface MediaDTO {
    additional_media_info?: {
        monetizable: boolean;
    };
    allow_download_status?: {
        allow_download: boolean;
    };
    display_url?: string;
    expanded_url?: string;
    ext_media_availability?: {
        status: string;
    };
    id_str?: string;
    indices?: number[];
    media_key?: string;
    media_results?: Record<string, any>;
    media_url_https?: string;
    original_info?: {
        focus_rects: any[];
        height: number;
        width: number;
    };
    sizes?: Record<string, {
        h: number;
        w: number;
    }>;
    type?: string;
    url?: string;
    video_info?: {
        aspect_ratio: number[];
        duration_millis: number;
        variants: VideoVariantDTO[];
    };
}

export interface VideoVariantDTO {
    content_type: string;
    url: string;
    bitrate?: number;
}
  