import { generateToken, JWTPayload } from '../config/jwt';
import { RegisterData, User, AuthResult, RegisterHostPartTwoDto, LoginResult, LoginUserResponse } from '../dtos';
import { UserModel, IUser } from '../models/User';
import { EmailVerificationCodeModel } from '../models/EmailVerificationCode';
import { EmailService } from './EmailService';
import { generateVerificationCode } from '../utils/codeUtils';
import { PlanModel } from '../models/Plan';

export class AuthService {
  public async registerHost(data: RegisterData): Promise<AuthResult> {
    const existingUser = await UserModel.findByEmailOrUsername(data.email, data.username);
    
    if (existingUser) {
      if (existingUser.email === data.email) throw new Error('User already exists with this email');
      if (existingUser.username === data.username) throw new Error('Username is already in use');
    }

    const password_hash = await UserModel.hashPassword(data.password);

    await PlanModel.ensureDefaults();
    const basicPlan = await PlanModel.findByName('BASIC');
    if (!basicPlan) throw new Error('Basic plan not found');

    const newUser = await UserModel.create({
      username: data.username,
      email: data.email,
      user_type: data.user_type || 'HOST',
      password_hash,
      email_verified: false,
      isActive: false,
      status: 'inactive',
      active_account_host: false,
      plan_id: basicPlan._id!.toString(),
      duration_plan: null,
      campaigns_created: 0
    });

    const token = generateToken({
      userId: (newUser._id as any).toString(),
      email: newUser.email || '',
      role: newUser.user_type,
      planId: basicPlan._id!.toString(),
      planName: 'BASIC',
      planExpiresAt: null,
      registerCompleted: false,
      ...(newUser.status !== undefined && { status: newUser.status })
    });

    if (newUser.email) {
      try {
        const code = generateVerificationCode();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        
        await EmailVerificationCodeModel.create({
          user_id: (newUser._id as any).toString(),
          email: newUser.email.toLowerCase(),
          code: code,
          expires_at: expiresAt,
          verified: false
        });
        
        const emailService = new EmailService();
        await emailService.sendVerificationCode(newUser.email.toLowerCase(), code);
      } catch (error) {
        console.error('Error sending verification email:', error);
      }
    }

    const userResponse: User = {
      id: (newUser._id as any).toString(),
      username: newUser.username,
      user_type: newUser.user_type,
      email: newUser.email || '',
      email_verified: newUser.email_verified,
      isActive: newUser.isActive,
      ...(newUser.status !== undefined && { status: newUser.status }),
      campaigns_created: newUser.campaigns_created,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at,
      ...(newUser.discord_id && { discord_id: newUser.discord_id }),
      ...(newUser.google_id && { google_id: newUser.google_id }),
      ...(newUser.twitter_id && { twitter_id: newUser.twitter_id }),
      ...(newUser.twitter_username && { twitter_username: newUser.twitter_username }),
      ...(newUser.twitter_display_name && { twitter_display_name: newUser.twitter_display_name }),
      ...(newUser.twitter_profile_image && { twitter_profile_image: newUser.twitter_profile_image }),
      ...(newUser.twitter_verified !== undefined && { twitter_verified: newUser.twitter_verified }),
      ...(newUser.twitter_followers_count !== undefined && { twitter_followers_count: newUser.twitter_followers_count }),
      ...(newUser.total_earnings !== undefined && { total_earnings: newUser.total_earnings })
    };

    return {
      success: true,
      user: userResponse,
      token
    };
  }

  public async loginHost(email: string, password: string): Promise<LoginResult> {
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');

    const isPasswordValid = await UserModel.comparePassword(user, password);
    if (!isPasswordValid) throw new Error('Invalid credentials');

    if (user.user_type !== 'ADMIN' && !user.email_verified) {
      throw new Error('Email not verified. Please verify your email before logging in');
    }

    await PlanModel.ensureDefaults();
    const basic = await PlanModel.findByName('BASIC');
    const core = await PlanModel.findByName('CORE');
    const enterprise = await PlanModel.findByName('ENTERPRISE');
    if (!basic?._id) throw new Error('BASIC plan not found');
    const planId = user.plan_id || basic._id.toString();
    const planName =
      enterprise && planId === enterprise._id!.toString()
        ? 'ENTERPRISE'
        : core && planId === core._id!.toString()
          ? 'CORE'
          : 'BASIC';
    const planExpiresAt = user.duration_plan ? new Date(user.duration_plan).toISOString() : null;

    const token = generateToken({
      userId: (user._id as any).toString(),
      email: user.email || '',
      role: user.user_type,
      ...(user.user_type === 'HOST'
        ? {
            planId,
            planName,
            planExpiresAt,
            registerCompleted: user.registerCompleted === true,
            ...(user.status !== undefined && { status: user.status })
          }
        : {})
    });

    const userResponse: LoginUserResponse = {
      id: (user._id as any).toString(),
      username: user.username,
      user_type: user.user_type,
      email: user.email || '',
      isActive: user.isActive,
      registerCompleted: user.registerCompleted || false,
      ...(user.status !== undefined && { status: user.status })
    };

    return {
      success: true,
      user: userResponse,
      token
    };
  }

  public async registerHostPartTwo(userId: string, data: RegisterHostPartTwoDto): Promise<AuthResult> {
    const existingUser = await UserModel.findById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    if (existingUser.user_type !== 'HOST') {
      throw new Error('Only HOST users can complete this registration');
    }

    const updateData: Partial<IUser> = {
      username: data.username,
      position_company: data.position_company,
      name_company: data.name_company,
      introduction_company: data.introduction_company,
      categories_atuation: data.categories_atuation,
      registerCompleted: true
    };

    if (data.twitter_username) updateData.twitter_username = data.twitter_username;
    if (data.telegram_username) updateData.telegram_username = data.telegram_username;
    if (data.website_company) updateData.website_company = data.website_company;
    if (data.social_media) updateData.social_media = data.social_media;
    if (data.logo_company) {
      if (!this.isValidBase64(data.logo_company)) 
        throw new Error('Company logo must be a valid base64');

      updateData.logo_company = data.logo_company;
    }

    const updatedUser = await UserModel.updateHostData(userId, updateData);

    if (!updatedUser) throw new Error('Error updating user data');

    await PlanModel.ensureDefaults();
    const basic = await PlanModel.findByName('BASIC');
    const core = await PlanModel.findByName('CORE');
    const enterprise = await PlanModel.findByName('ENTERPRISE');
    if (!basic?._id) throw new Error('BASIC plan not found');
    const planId = updatedUser.plan_id || basic._id.toString();
    const planName =
      enterprise && planId === enterprise._id!.toString()
        ? 'ENTERPRISE'
        : core && planId === core._id!.toString()
          ? 'CORE'
          : 'BASIC';
    const planExpiresAt = updatedUser.duration_plan ? new Date(updatedUser.duration_plan).toISOString() : null;

    const payload: JWTPayload = {
      userId: updatedUser._id!.toString(),
      email: updatedUser.email!,
      role: updatedUser.user_type,
      planId,
      planName,
      planExpiresAt,
      registerCompleted: true,
      ...(updatedUser.status !== undefined && { status: updatedUser.status })
    };
    
    const token = generateToken(payload);

    const userResponse: User = {
      id: updatedUser._id!.toString(),
      username: updatedUser.username,
      user_type: updatedUser.user_type,
      email: updatedUser.email!,
      email_verified: updatedUser.email_verified,
      isActive: updatedUser.isActive,
      ...(updatedUser.status !== undefined && { status: updatedUser.status }),
      campaigns_created: updatedUser.campaigns_created,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      ...(updatedUser.discord_id && { discord_id: updatedUser.discord_id }),
      ...(updatedUser.google_id && { google_id: updatedUser.google_id }),
      ...(updatedUser.twitter_id && { twitter_id: updatedUser.twitter_id }),
      ...(updatedUser.twitter_username && { twitter_username: updatedUser.twitter_username }),
      ...(updatedUser.twitter_display_name && { twitter_display_name: updatedUser.twitter_display_name }),
      ...(updatedUser.twitter_profile_image && { twitter_profile_image: updatedUser.twitter_profile_image }),
      ...(updatedUser.twitter_verified !== undefined && { twitter_verified: updatedUser.twitter_verified }),
      ...(updatedUser.twitter_followers_count !== undefined && { twitter_followers_count: updatedUser.twitter_followers_count }),
      ...(updatedUser.total_earnings !== undefined && { total_earnings: updatedUser.total_earnings }),      
      ...(updatedUser.position_company && { position_company: updatedUser.position_company }),
      ...(updatedUser.telegram_username && { telegram_username: updatedUser.telegram_username }),
      ...(updatedUser.name_company && { name_company: updatedUser.name_company }),
      ...(updatedUser.website_company && { website_company: updatedUser.website_company }),
      ...(updatedUser.social_media && { social_media: updatedUser.social_media }),
      ...(updatedUser.introduction_company && { introduction_company: updatedUser.introduction_company }),
      ...(updatedUser.logo_company && { logo_company: updatedUser.logo_company }),
      ...(updatedUser.categories_atuation && { categories_atuation: updatedUser.categories_atuation }),
      ...(updatedUser.registerCompleted !== undefined && { registerCompleted: updatedUser.registerCompleted })
    };

    return {
      success: true,
      user: userResponse,
      token
    };
  }

  public async syncAccounts(
    currentUserId: string,
    twitterId: string,
    twitterUsername: string
  ): Promise<{ success: boolean; user: any; message: string; token?: string }> {
    const { ensureConnection } = await import('../config/database');

    const currentUser = await UserModel.findById(currentUserId);
    if (!currentUser) throw new Error('Current user not found');
    if (currentUser.user_type !== 'CREATOR') throw new Error('Only CREATOR users can sync accounts');

    // Already synced
    if (currentUser.twitter_id === twitterId) {
      return { success: true, user: currentUser, message: 'Already synced' };
    }

    const oldUser = await UserModel.findByTwitterId(twitterId);

    // No existing twitter account — just link
    if (!oldUser) {
      const updated = await UserModel.updateById(currentUserId, {
        twitter_id: twitterId,
        twitter_username: twitterUsername
      });
      const finalUser = updated || currentUser;
      const token = generateToken({
        userId: currentUserId,
        email: finalUser.email || '',
        role: finalUser.user_type
      });
      return { success: true, user: finalUser, message: 'Twitter linked successfully', token };
    }

    // Prevent merging with non-CREATOR or with self
    if (oldUser.user_type !== 'CREATOR') throw new Error('Target account is not a CREATOR');
    if (oldUser._id!.toString() === currentUserId) {
      return { success: true, user: currentUser, message: 'Already synced' };
    }

    const oldUserId = oldUser._id!.toString();

    // --- Transaction: merge old (twitter) into current (google) ---
    const client = await ensureConnection();
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const db = client.db('bounties');

        // 1. Migrate campaign_participants
        await db.collection('campaign_participants').updateMany(
          { userId: oldUserId },
          { $set: { userId: currentUserId } },
          { session }
        );

        // 2. Migrate payments_winners_campaigns
        await db.collection('payments_winners_campaigns').updateMany(
          { userId: oldUserId },
          { $set: { userId: currentUserId } },
          { session }
        );

        // 3. Migrate payment_winners_logs
        await db.collection('payment_winners_logs').updateMany(
          { userId: oldUserId },
          { $set: { userId: currentUserId } },
          { session }
        );

        // 4. Migrate encurtador_url
        await db.collection('encurtador_url').updateMany(
          { userId: oldUserId },
          { $set: { userId: currentUserId } },
          { session }
        );

        // 5. Migrate user_comment_campaign
        await db.collection('user_comment_campaign').updateMany(
          { userId: oldUserId },
          { $set: { userId: currentUserId } },
          { session }
        );

        // 6. Migrate campaign_sugestion_bounties_rank (nested ranking array)
        await db.collection('campaign_sugestion_bounties_rank').updateMany(
          { 'ranking.user_id': oldUserId },
          { $set: { 'ranking.$[elem].user_id': currentUserId } },
          { arrayFilters: [{ 'elem.user_id': oldUserId }], session }
        );

        // 7. Merge user fields: twitter data, wallets, earnings, description
        const mergeData: Record<string, any> = {};
        if (oldUser.twitter_id) mergeData['twitter_id'] = oldUser.twitter_id;
        if (oldUser.twitter_username) mergeData['twitter_username'] = oldUser.twitter_username;
        if (oldUser.twitter_display_name) mergeData['twitter_display_name'] = oldUser.twitter_display_name;
        if (oldUser.twitter_profile_image) mergeData['twitter_profile_image'] = oldUser.twitter_profile_image;
        if (oldUser.twitter_verified !== undefined) mergeData['twitter_verified'] = oldUser.twitter_verified;
        if (oldUser.twitter_followers_count !== undefined) mergeData['twitter_followers_count'] = oldUser.twitter_followers_count;

        // Merge wallets (keep current if exists, otherwise take from old)
        if (!currentUser.wallet_evm && oldUser.wallet_evm) mergeData['wallet_evm'] = oldUser.wallet_evm;
        if (!currentUser.wallet_sol && oldUser.wallet_sol) mergeData['wallet_sol'] = oldUser.wallet_sol;
        if (!currentUser.wallet_sui && oldUser.wallet_sui) mergeData['wallet_sui'] = oldUser.wallet_sui;
        if (!currentUser.wallet_stellar && oldUser.wallet_stellar) mergeData['wallet_stellar'] = oldUser.wallet_stellar;

        // Merge earnings
        const currentEarnings = currentUser.total_earnings || 0;
        const oldEarnings = oldUser.total_earnings || 0;
        mergeData['total_earnings'] = currentEarnings + oldEarnings;

        // Merge description
        if (!currentUser.description && oldUser.description) mergeData['description'] = oldUser.description;

        // Merge tiktok data if current doesn't have
        if (!currentUser.tiktok_id && oldUser.tiktok_id) {
          mergeData['tiktok_id'] = oldUser.tiktok_id;
          mergeData['tiktok_username'] = oldUser.tiktok_username;
          mergeData['tiktok_name'] = oldUser.tiktok_name;
        }

        // Merge profile fields
        if (!currentUser.username_youtube && oldUser.username_youtube) mergeData['username_youtube'] = oldUser.username_youtube;
        if (!currentUser.username_tiktok && oldUser.username_tiktok) mergeData['username_tiktok'] = oldUser.username_tiktok;
        if (!currentUser.username_instagram && oldUser.username_instagram) mergeData['username_instagram'] = oldUser.username_instagram;
        if (!currentUser.username_telegram && oldUser.username_telegram) mergeData['username_telegram'] = oldUser.username_telegram;
        if (!currentUser.username_discord && oldUser.username_discord) mergeData['username_discord'] = oldUser.username_discord;

        await db.collection('users').updateOne(
          { _id: currentUser._id! },
          { $set: { ...mergeData, updated_at: new Date() } },
          { session }
        );

        // 8. Delete old user
        await db.collection('users').deleteOne(
          { _id: oldUser._id! },
          { session }
        );

        // 9. Audit log
        await db.collection('sync_users_log').insertOne({
          userid_old: oldUserId,
          userid_new: currentUserId,
          old_user: {
            email: oldUser.email || null,
            twitter_id: oldUser.twitter_id || null,
            twitter_username: oldUser.twitter_username || null,
            twitter_display_name: oldUser.twitter_display_name || null,
            wallet_evm: oldUser.wallet_evm || null,
            wallet_sol: oldUser.wallet_sol || null,
            wallet_sui: oldUser.wallet_sui || null,
            wallet_stellar: oldUser.wallet_stellar || null,
            total_earnings: oldUser.total_earnings || 0,
            user_type: oldUser.user_type || null
          },
          new_user: {
            email: currentUser.email || null,
            twitter_id: currentUser.twitter_id || null,
            google_id: currentUser.google_id || null,
            user_type: currentUser.user_type || null
          },
          merged_fields: Object.keys(mergeData),
          created_at: new Date()
        }, { session });
      });
    } finally {
      await session.endSession();
    }

    // Return updated user with new token
    const updatedUser = await UserModel.findById(currentUserId);
    const finalUser = updatedUser || currentUser;

    const token = generateToken({
      userId: currentUserId,
      email: finalUser.email || '',
      role: finalUser.user_type
    });

    return {
      success: true,
      user: finalUser,
      message: 'Accounts synced successfully',
      token
    };
  }

  public async userExistsByTwitterId(twitterId: string): Promise<boolean> {
    const user = await UserModel.findByTwitterId(twitterId);
    return user !== null;
  }

  // Private methods
  private isValidBase64(str: string): boolean {
    try {
      const base64Regex = /^data:image\/(png|jpg|jpeg);base64,/;
      if (base64Regex.test(str)) {
        const base64Data = str.split(',')[1];
        if (!base64Data) return false;
        return btoa(atob(base64Data)) === base64Data;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}
