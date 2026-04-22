import { generateToken } from './jwt';
import { UserModel, IUser } from '../models/User';
import { WaitlistModel } from '../models/Waitlist';

export interface PrivyUser {
    id: string;
    createdAt: string;
    linkedAccounts: Array<{
        subject: string;
        username: string;
        name: string;
        type: string;
        profilePictureUrl: string;
        verifiedAt: string;
        firstVerifiedAt: string;
        latestVerifiedAt: string;
    }>;
    twitter: {
        subject: string;
        username: string;
        name: string;
        profilePictureUrl: string;
    };
    instagram?: {
        subject: string;
        username: string;
        name: string;
        profilePictureUrl: string;
    };
    tiktok?: {
        subject: string;
        username: string;
        name: string;
        profilePictureUrl: string;
    };
    google?: {
        subject: string;
        name: string;
        email: string;
    };
    delegatedWallets: any[];
    mfaMethods: any[];
    hasAcceptedTerms: boolean;
    isGuest: boolean;
}

export interface PrivyAuthData {
    user: PrivyUser;
    isNewUser: boolean;
    wasAlreadyAuthenticated: boolean;
    loginMethod: string;
    accessToken: string;
    refreshToken?: string;
}

interface PrivyAuthResult {
    message: string;
    status: number;
    data?: {
        token: string;
        user: IUser;
        isNewUser: boolean;
    };
}

export interface SocialMediaData {
    subject: string;
    username: string;
    name: string;
    profilePictureUrl: string;
    email?: string;
}

export interface LinkedAccountsData {
    name: string;
    subject: string;
    username: string;
    type: string;
    profilePictureUrl?: string;
    firstVerifiedAt?: string;
    latestVerifiedAt?: string;
}

export default async function authenticateWithPrivy(privyData: PrivyAuthData): Promise<PrivyAuthResult> {
    try {
        const { user: privyUser, isNewUser, loginMethod } = privyData;

        if (loginMethod !== 'twitter' && loginMethod !== 'google' && loginMethod !== 'tiktok' && loginMethod !== 'instagram') {
            return {
                message: "Only Twitter, Instagram and TikTok authentication are supported for creators",
                status: 400
            };
        }

        let loginData: SocialMediaData | undefined;

        if (loginMethod === 'twitter') {
            loginData = privyUser.twitter;
        } else if (loginMethod === 'tiktok') {
            loginData = privyUser.tiktok;
        } else if (loginMethod === 'instagram') {
            loginData = privyUser.instagram;
        } else if (loginMethod === 'google') {
            if (!privyUser.google || !privyUser.google.subject || !privyUser.google.name || !privyUser.google.email) {
                return {
                    message: "Google account data is incomplete",
                    status: 400
                };
            }

            loginData = {
                subject: privyUser.google.subject,
                username: privyUser.google.name,
                name: privyUser.google.name,
                profilePictureUrl: '',
                email: privyUser.google.email
            };
        }

        if (!loginData) {
            return {
                message: "Social media account not found in Privy user data",
                status: 400
            };
        }

        let user: IUser | null = null;
        let wasNewUser = false;
        
        if (loginMethod === 'twitter') {
            const result = await LoginTwitter(loginData);
            user = result.user;
            wasNewUser = result.isNewUser;
        } else if (loginMethod === 'tiktok') {
            const result = await LoginTiktok(loginData);
            user = result.user;
            wasNewUser = result.isNewUser;
        } else if (loginMethod === 'instagram') {
          /*const result = await LoginInstagram(loginData);
            user = result.user;
            wasNewUser = result.isNewUser; */
        } else if (loginMethod === 'google') {
            const result = await LoginGoogle(loginData);
            user = result.user;
            wasNewUser = result.isNewUser;
        }

        if (!user) {
            return {
                message: "Error creating user",
                status: 500
            };
        }

        if (user.first_login === null) {
            const updated = await UserModel.updateById((user._id as any).toString(), { first_login: true });
            if (updated) user = updated;
        }
        
        const token = generateToken({
            userId: (user._id as any).toString(),
            email: user.email || '',
            role: user.user_type
        });

        return {
            message: isNewUser || wasNewUser ? "Creator account created successfully" : "Creator logged in successfully",
            status: isNewUser || wasNewUser ? 201 : 200,
            data: {
                token,
                user,
                isNewUser: isNewUser || wasNewUser
            }
        };

    } catch (error) {
        return {
            message: "Error authenticating user",
            status: 500
        };
    }
}

export async function authenticateWithPrivyWithoutToken(privyData: LinkedAccountsData[]): Promise<{ success: boolean; updatedTwitter: boolean; updatedTiktok: boolean; updatedInstagram: boolean; updatedGoogle: boolean }> {
    try {
        let existingUser: IUser | null = null;
        let updatedTwitter = false;
        let updatedTiktok = false;
        let updatedInstagram = false;
        let updatedGoogle = false;
        
        for (const account of privyData) {
            if (account.type === 'twitter_oauth') {
                const user = await UserModel.findByTwitterId(account.subject);
                if (user) {
                    existingUser = user;
                    break;
                }
            } else if (account.type === 'tiktok_oauth') {
                const user = await UserModel.findByTiktokId(account.subject);
                if (user) {
                    existingUser = user;
                    break;
                }
            } else if (account.type === 'instagram_oauth') {
                /* const user = await UserModel.findByInstagramId(account.subject);
                if (user) {
                    existingUser = user;
                    break;
                } */
            } else if (account.type === 'google_oauth') {
                const user = await UserModel.findByGoogleId(account.subject);
                if (user) {
                    existingUser = user;
                    break;
                }
            }
        }

        const updateData: any = { isActive: true };

        for (const account of privyData) {
            const loginData: SocialMediaData = {
                subject: account.subject,
                username: account.username,
                name: account.name,
                profilePictureUrl: account.profilePictureUrl || ''
            };

            if (account.type === 'twitter_oauth') {
                updatedTwitter = true;
                updateData.twitter_id = loginData.subject;
                updateData.twitter_username = loginData.username;
                updateData.twitter_display_name = loginData.name;
                updateData.twitter_profile_image = loginData.profilePictureUrl;
            } else if (account.type === 'tiktok_oauth') {
                updatedTiktok = true;
                updateData.tiktok_id = loginData.subject;
                updateData.tiktok_username = loginData.username;
                updateData.tiktok_name = loginData.name;
            } else if (account.type === 'instagram_oauth') {
                /* updatedInstagram = true; */
            } else if (account.type === 'google_oauth') {
                updatedGoogle = true;
                updateData.google_id = loginData.subject;
                updateData.google_name = loginData.name;
                updateData.google_email = loginData.email;
            }
        }

        if (!existingUser) {
            return {
                success: false,
                updatedTwitter: false,
                updatedTiktok: false,
                updatedInstagram: false,
                updatedGoogle: false
            };
        }

        await UserModel.updateById(existingUser._id!.toString(), updateData);

        return {
            success: true,
            updatedTwitter,
            updatedTiktok,
            updatedInstagram,
            updatedGoogle
        };
    } catch (error) {
        return {
            success: false,
            updatedTwitter: false,
            updatedTiktok: false,
            updatedInstagram: false,
            updatedGoogle: false
        };
    }
}

async function LoginTwitter(loginData: SocialMediaData): Promise<{ user: IUser | null; isNewUser: boolean }> {
    let existingUser = await UserModel.findByTwitterId(loginData.subject);

    let user: IUser;

    if (existingUser) {
        user = await UserModel.updateById(existingUser._id!.toString(), {
            isActive: true,
            twitter_username: loginData.username,
            twitter_display_name: loginData.name,
            twitter_profile_image: loginData.profilePictureUrl
        }) || existingUser;
        return { user, isNewUser: false };
    } else {
        user = await UserModel.create({
            username: loginData.username,
            user_type: 'CREATOR',
            email: "",
            isActive: true,
            email_verified: true,
            campaigns_created: 0,
            twitter_id: loginData.subject,
            twitter_username: loginData.username,
            twitter_display_name: loginData.name,
            twitter_profile_image: loginData.profilePictureUrl,
            twitter_verified: false,
            twitter_followers_count: 0,
            total_earnings: 0,
            first_login: true
        });
        return { user, isNewUser: true };
    }
}

async function LoginTiktok(loginData: SocialMediaData): Promise<{ user: IUser | null; isNewUser: boolean }> {
    let existingUser = await UserModel.findByTiktokId(loginData.subject);

    let user: IUser;

    if (existingUser) {
        user = await UserModel.updateById(existingUser._id!.toString(), {
            isActive: true,
            tiktok_username: loginData.username,
            tiktok_name: loginData.name,
            tiktok_id: loginData.subject
        }) || existingUser;
        return { user, isNewUser: false };
    } else {
        user = await UserModel.create({
            username: loginData.username,
            user_type: 'CREATOR',
            email: "",
            isActive: true,
            email_verified: false,
            campaigns_created: 0,
            tiktok_username: loginData.username,
            tiktok_name: loginData.name,
            tiktok_id: loginData.subject,
            total_earnings: 0,
            first_login: true
        });
        return { user, isNewUser: true };
    }
}

async function LoginGoogle(loginData: SocialMediaData): Promise<{ user: IUser | null; isNewUser: boolean }> {
    let existingUser = await UserModel.findByGoogleId(loginData.subject);

    if (!loginData.email) throw new Error('Email is required for Google authentication');

    const email = loginData.email;

    let user: IUser;

    if (existingUser) {
        const updateData: Partial<IUser> = {
            isActive: true,
            google_name: loginData.name,
            google_email: email,
            google_id: loginData.subject,
        };
        
        user = await UserModel.updateById(existingUser._id!.toString(), updateData) || existingUser;
        return { user, isNewUser: false };
    } else {
        user = await UserModel.create({
            username: loginData.username,
            user_type: 'CREATOR',
            email: email,
            isActive: true,
            email_verified: true,
            campaigns_created: 0,
            google_name: loginData.name,
            google_email: email,
            google_id: loginData.subject,
            total_earnings: 0,
            first_login: true
        });
        return { user, isNewUser: true };
    }
}

/* async function LoginInstagram(loginData: SocialMediaData): Promise<{ user: IUser | null; isNewUser: boolean }> {
    let existingUser = await UserModel.findByTiktokId(loginData.subject);

    let user: IUser;

    if (existingUser) {
        user = await UserModel.updateById(existingUser._id!.toString(), {
            isActive: true,
            tiktok_username: loginData.username,
            tiktok_name: loginData.name,
            tiktok_id: loginData.subject
        }) || existingUser;
        return { user, isNewUser: false };
    } else {
        user = await UserModel.create({
            username: loginData.username,
            user_type: 'CREATOR',
            email: "",
            isActive: true,
            email_verified: false,
            campaigns_created: 0,
            tiktok_username: loginData.username,
            tiktok_name: loginData.name,
            tiktok_id: loginData.subject,
            total_earnings: 0
        });
        return { user, isNewUser: true };
    }
} */

export function validatePrivyWebhook(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
}
