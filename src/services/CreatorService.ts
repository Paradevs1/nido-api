import { ObjectId } from 'mongodb';
import { UserModel, IUser } from '../models/User';
import { CampaignModel } from '../models/Campaign';
import { CampaignParticipantsModel } from '../models/CampaignParticipants';
import { UserCommentCampaignModel } from '../models/UserCommentCampaign';
import { PaymentModel } from '../models/Payment';
import { ShortURLModel, IShortURL } from '../models/EncurtadorURL';
import { CampaignParticipantResponse, formatCampaignParticipantResponse, SubmittedCampaignResponse } from '../dtos/campaignParticipants.dto';
import { UpdateProfileDto, UpdateProfileAfterLoginDto, UPDATE_PROFILE_KEYS, UPDATE_PROFILE_AFTER_LOGIN_KEYS } from '../dtos/creator.dto';
import { CreateCommentDto, UpdateCommentDto, CommentResponse, CommentListResponse, formatCommentResponse } from '../dtos/comment.dto';
import { ShortIOApiResponse, ShortIOClicksResponse } from '../dtos/shortio.dto';
import { calculateDeadline, calculateDetailedDeadline, getCurrentDateInBrazil } from '../utils/dateUtils';
import { earnersCache, commentsCache } from '../utils/cache';
import { hasWaitingPaymentCampaignForChain } from '../utils/codeUtils';

export class CreatorService {
  public async hasCampaignSubmission(userId: string, campaignId: string): Promise<boolean> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can access this resource');

    const existingParticipant = await CampaignParticipantsModel.findByUserAndCampaign(userId, campaignId);
    return !!existingParticipant;
  }

  public async getCampaignSubmission(userId: string, campaignId: string): Promise<CampaignParticipantResponse | null> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can access this resource');

    const existingParticipant = await CampaignParticipantsModel.findByUserAndCampaign(userId, campaignId);
    if (!existingParticipant) {
      return null;
    }

    return formatCampaignParticipantResponse(existingParticipant);
  }

  public async submitCampaign(userId: string, campaignId: string, submission_twitter: string, submission_tiktok: string, submission_instagram: string, submission_youtube: string, submission_feedback: string, submissions_kols?: string[], submissions_images?: string[]): Promise<{ success: boolean; chain: string; data?: CampaignParticipantResponse; wallet_evm?: string; wallet_sol?: string; wallet_sui?: string; wallet_stellar?: string }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    if (campaign.status !== 'active') throw new Error('Only active campaigns accept enrollments');

    if (campaign.community_id) {
      const { CommunityMemberModel } = await import('../models/CommunityMember');
      const member = await CommunityMemberModel.findByCommunityAndCreator(campaign.community_id, userId);
      if (!member || member.status !== 'APPROVED') {
        throw new Error('You must be an approved member of the community to submit to this campaign');
      }
    }

    if(campaign.payment_chain === 'solana' || campaign.payment_chain === 'SOL') {
      if (!user.wallet_sol) {
        return {
          success: false,
          chain: 'solana',
          wallet_sol: user.wallet_sol || ""
        };
      }
    } else if (campaign.payment_chain === 'sui' || campaign.payment_chain === 'SUI') {
      if (!user.wallet_sui) {
        return {
          success: false,
          chain: 'sui',
          wallet_sui: user.wallet_sui || ""
        };
      }
    } else if (campaign.payment_chain === 'stellar' || campaign.payment_chain === 'STELLAR') {
      if (!user.wallet_stellar) {
        return {
          success: false,
          chain: 'stellar',
          wallet_stellar: user.wallet_stellar || ""
        };
      }
    } else {
      if (!user.wallet_evm) {
        return {
          success: false,
          chain: 'evm',
          wallet_evm: user.wallet_evm || ""
        };
      }
    }

    const existingParticipant = await CampaignParticipantsModel.findByUserAndCampaign(userId, campaignId);

    if(existingParticipant) {
      // Se já existe participante, atualizar os dados (links de submission e/ou submissions_kols)
      const updateData: any = {};
      
      // Atualizar links de submission se fornecidos
      if (submission_twitter !== undefined) updateData.submission_twitter = submission_twitter;
      if (submission_tiktok !== undefined) updateData.submission_tiktok = submission_tiktok;
      if (submission_instagram !== undefined) updateData.submission_instagram = submission_instagram;
      if (submission_youtube !== undefined) updateData.submission_youtube = submission_youtube;
      if (submission_feedback !== undefined) updateData.submission_feedback = submission_feedback;
      
      if (submissions_kols !== undefined) {
        updateData.submissions_kols = submissions_kols;
      }
      if (submissions_images !== undefined) {
        updateData.submissions_images = submissions_images;
      }
      
      updateData.date_submit = getCurrentDateInBrazil();
      
      const updatedParticipant = await CampaignParticipantsModel.updateById(existingParticipant._id!.toString(), updateData);

      return {
        success: true,
        chain: '',
        data: formatCampaignParticipantResponse(updatedParticipant || existingParticipant)
      };
    } else {

      const participantData = {
        userId: userId,
        campaignId: campaignId,
        date_submit: getCurrentDateInBrazil(),
        amount_received: 0,
        submission_twitter: submission_twitter,
        submission_tiktok: submission_tiktok,
        submission_instagram: submission_instagram,
        submission_youtube: submission_youtube,
        submission_feedback: submission_feedback ?? '',
        media_twitter: '',
        views_twitter: 0,
        replies_twitter: 0,
        retweets_twitter: 0,
        quotes_twitter: 0,
        bookmarks_twitter: 0,
        likes_twitter: 0,
        content_length: 0,
        media_tiktok: '',
        views_tiktok: 0,
        replies_tiktok: 0,
        retweets_tiktok: 0,
        quotes_tiktok: 0,
        bookmarks_tiktok: 0,
        likes_tiktok: 0,
        media_instagram: '',
        views_instagram: 0,
        replies_instagram: 0,
        retweets_instagram: 0,
        quotes_instagram: 0,
        bookmarks_instagram: 0,
        likes_instagram: 0,
        media_youtube: '',
        views_youtube: 0,
        replies_youtube: 0,
        retweets_youtube: 0,
        quotes_youtube: 0,
        bookmarks_youtube: 0,
        likes_youtube: 0,
        views_instagram_story: 0,
        replies_instagram_story: 0,
        retweets_instagram_story: 0,
        likes_instagram_story: 0,
        winner: false,
        submissions_kols: submissions_kols || [],
        submissions_images: submissions_images || []
      };
  
      const newParticipant = await CampaignParticipantsModel.create(participantData);
      return {
        success: true,
        chain: '',
        data: formatCampaignParticipantResponse(newParticipant)
      };
    }
  }

  public async getSubmittedCampaigns(userId: string, page: number = 1, limit: number = 10, type?: string): Promise<{ campaigns: SubmittedCampaignResponse[], total: number, page: number, limit: number, totalPages: number }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can access submitted campaigns');

    const participantsResult = await CampaignParticipantsModel.findByUserId(userId, page, limit);

    const campaignIds = participantsResult.participants.map(p => p.campaignId);
    const campaignsMap = await CampaignModel.findByIds(campaignIds);

    const campaigns: SubmittedCampaignResponse[] = [];

    for (const participant of participantsResult.participants) {
      const campaign = campaignsMap.get(participant.campaignId) || null;
      const isStatusAllowed = campaign && (campaign.status === 'active' || campaign.status === 'completed' || campaign.status === 'waiting payment');
      const isTypeAllowed = !type || ['All', 'Other', 'all', 'other'].includes(String(type)) || (campaign && Array.isArray(campaign.content_categories) && campaign.content_categories.some(cat => cat.slug === String(type)));
      if (campaign && isStatusAllowed && isTypeAllowed) {
        const total_submissions = await CampaignParticipantsModel.countByCampaignId(campaign._id!.toString());
        const isPrivate = campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0);
        let user_amount: number | undefined;
        if (isPrivate && campaign.list_kols && campaign.list_kols.length > 0) {
          const kol = campaign.list_kols.find((k: { userId: string }) => k.userId === userId);
          user_amount = kol?.amount;
        }
        campaigns.push({
          campaignId: campaign._id!.toString(),
          title: campaign.title,
          about_project: campaign.about_project,
          status: campaign.status,
          total_prize_pool: campaign.total_prize_pool,
          deadline: calculateDeadline(campaign.start_date, campaign.end_date),
          deadline_detailed: calculateDetailedDeadline(campaign.start_date, campaign.end_date),
          content_categories: campaign.content_categories,
          total_submissions,
          isPrivate: campaign.isPrivate || (campaign.list_kols && campaign.list_kols.length > 0) || false,
          ...(campaign.is_cac !== undefined && { is_cac: campaign.is_cac }),
          ...(user_amount !== undefined && { user_amount }),
        });
      }
    }

    const statusOrder: { [key: string]: number } = {
      'active': 1,
      'waiting payment': 2,
      'completed': 3
    };
    
    campaigns.sort((a, b) => {
      const orderA = statusOrder[a.status] || 99;
      const orderB = statusOrder[b.status] || 99;
      return orderA - orderB;
    });

    const total = campaigns.length;
    const totalPages = Math.ceil(total / limit);

    return {
      campaigns,
      total,
      page: participantsResult.page,
      limit: participantsResult.limit,
      totalPages
    };
  }

  public async insertWallets(userId: string, walletEVM?: string, walletSOL?: string, walletSUI?: string, walletStellar?: string): Promise<{ message: string; wallet_evm?: string; wallet_sol?: string; wallet_sui?: string; wallet_stellar?: string }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can manage wallets');

    const normalizedWalletEVM = walletEVM === null || walletEVM === '' ? '' : walletEVM;
    const normalizedWalletSOL = walletSOL === null || walletSOL === '' ? '' : walletSOL;
    const normalizedWalletSUI = walletSUI === null || walletSUI === '' ? '' : walletSUI;
    const normalizedWalletStellar = walletStellar === null || walletStellar === '' ? '' : walletStellar;

    if (normalizedWalletEVM !== undefined && normalizedWalletEVM !== user.wallet_evm && user.wallet_evm && user.wallet_evm !== '') {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'evm');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your EVM wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    if (normalizedWalletSOL !== undefined && normalizedWalletSOL !== user.wallet_sol && user.wallet_sol && user.wallet_sol !== '') {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'sol');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your Solana wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    if (normalizedWalletSUI !== undefined && normalizedWalletSUI !== user.wallet_sui && user.wallet_sui && user.wallet_sui !== '') {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'sui');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your Sui wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    if (normalizedWalletStellar !== undefined && normalizedWalletStellar !== user.wallet_stellar && user.wallet_stellar && user.wallet_stellar !== '') {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'stellar');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your Stellar wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    const updatedUser = await UserModel.addWallets(userId, normalizedWalletEVM, normalizedWalletSOL, normalizedWalletSUI, normalizedWalletStellar);
    if (!updatedUser) throw new Error('Error adding wallets');

    return {
      message: 'Wallets added successfully',
      ...(updatedUser.wallet_evm && { wallet_evm: updatedUser.wallet_evm }),
      ...(updatedUser.wallet_sol && { wallet_sol: updatedUser.wallet_sol }),
      ...(updatedUser.wallet_sui && { wallet_sui: updatedUser.wallet_sui }),
      ...(updatedUser.wallet_stellar && { wallet_stellar: updatedUser.wallet_stellar })
    };
  }

  public async deleteWallet(userId: string, walletType: 'evm' | 'sol' | 'sui' | 'stellar'): Promise<{ message: string; wallet_evm?: string; wallet_sol?: string; wallet_sui?: string; wallet_stellar?: string }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can manage wallets');

    const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, walletType);
    if (hasBlockedCampaign) {
      throw new Error('You cannot remove this wallet while you are participating in a campaign in waiting payment status for this chain');
    }

    const updatedUser = await UserModel.removeWallet(userId, walletType);
    if (!updatedUser) throw new Error('Error removing wallet');

    return {
      message: 'Wallet removed successfully',
      ...(updatedUser.wallet_evm && { wallet_evm: updatedUser.wallet_evm }),
      ...(updatedUser.wallet_sol && { wallet_sol: updatedUser.wallet_sol }),
      ...(updatedUser.wallet_sui && { wallet_sui: updatedUser.wallet_sui }),
      ...(updatedUser.wallet_stellar && { wallet_stellar: updatedUser.wallet_stellar })
    };
  }

  public async getComments(campaignId: string, currentUserId?: string, page: number = 1, limit: number = 10): Promise<CommentListResponse> {
    const cacheKey = commentsCache.generateCommentsKey(campaignId, page, limit, currentUserId);
    
    const cachedResult = await commentsCache.get<CommentListResponse>(cacheKey);
    if (cachedResult) return cachedResult;

    const commentsResult = await UserCommentCampaignModel.findByCampaignId(campaignId, page, limit);

    const commentUserIds = commentsResult.comments.map(c => c.userId);
    const commentUsersMap = await UserModel.findByIds(commentUserIds);

    const comments: CommentResponse[] = [];

    for (const comment of commentsResult.comments) {
      const user = commentUsersMap.get(comment.userId);
      if (user) comments.push(formatCommentResponse(comment, user, currentUserId));
    }

    const result: CommentListResponse = {
      comments,
      total: commentsResult.total,
      page: commentsResult.page,
      limit: commentsResult.limit,
      totalPages: commentsResult.totalPages
    };

    await commentsCache.set(cacheKey, result);

    return result;
  }

  public async insertComment(userId: string, commentData: CreateCommentDto): Promise<CommentResponse> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const campaign = await CampaignModel.findById(commentData.campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const newComment = await UserCommentCampaignModel.create({
      userId,
      campaignId: commentData.campaignId,
      comment: commentData.comment,
      create_date: new Date()
    });

    await commentsCache.deleteByPrefix('comments:campaign:');

    return formatCommentResponse(newComment, user, userId);
  }

  public async updateComment(commentId: string, userId: string, updateData: UpdateCommentDto): Promise<CommentResponse> {
    const existingComment = await UserCommentCampaignModel.findById(commentId);
    if (!existingComment) throw new Error('Comment not found');
    
    if (existingComment.userId !== userId) throw new Error('You can only edit your own comments');

    const updatedComment = await UserCommentCampaignModel.updateById(commentId, updateData);
    if (!updatedComment) throw new Error('Error updating comment');

    await commentsCache.deleteByPrefix('comments:campaign:');

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    return formatCommentResponse(updatedComment, user, userId);
  }

  public async deleteComment(commentId: string, userId: string): Promise<{ message: string }> {
    const existingComment = await UserCommentCampaignModel.findById(commentId);
    if (!existingComment) throw new Error('Comment not found');
    
    if (existingComment.userId !== userId) throw new Error('You can only delete your own comments');

    const deleted = await UserCommentCampaignModel.deleteById(commentId);
    if (!deleted) throw new Error('Error deleting comment');

    await commentsCache.deleteByPrefix('comments:campaign:');

    return {
      message: 'Comment deleted successfully'
    };
  }

  public async getProfile(creatorId: string): Promise<any> {
    const user = await UserModel.findById(creatorId);
    if (!user) throw new Error('User not found');
    
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can access this profile');

    const submittedCampaignsCount = await CampaignParticipantsModel.countByUserId(creatorId);
    
    const collection = await CampaignParticipantsModel['getCollection']();
    const winners = await collection.find({ 
      userId: creatorId, 
      winner: true 
    }).toArray();
    
    const quantity_winner = winners.length;
    
    const quantity_winner_dolar = winners.reduce((total, winner) => {
      const amount = Number(winner.amount_received) || 0;
      return total + amount;
    }, 0);

    const profile: any = {
      id: user._id!.toString(),
      user_type: user.user_type,
      email: user.email,
      isActive: user.isActive,
      submittedCampaignsCount,
      quantity_winner,
      quantity_winner_dolar,
      ...(user.telegram_username && { telegram_username: user.telegram_username }),
      ...(user.social_media && { social_media: user.social_media }),
      ...(user.wallet_evm && { wallet_evm: user.wallet_evm }),
      ...(user.wallet_sol && { wallet_sol: user.wallet_sol }),
      ...(user.wallet_sui && { wallet_sui: user.wallet_sui }),
      ...(user.wallet_stellar && { wallet_stellar: user.wallet_stellar }),
      ...(user.description && { description: user.description }),
      ...(user.username_youtube !== undefined && { username_youtube: user.username_youtube }),
      ...(user.username_tiktok !== undefined && { username_tiktok: user.username_tiktok }),
      ...(user.username_instagram !== undefined && { username_instagram: user.username_instagram }),
      ...(user.username_telegram !== undefined && { username_telegram: user.username_telegram }),
      ...(user.username_discord !== undefined && { username_discord: user.username_discord }),
      ...(user.twitter_username !== undefined && { username_twitter: user.twitter_username }),
      ...(user.primary_language !== undefined && { primary_language: user.primary_language }),
      ...(user.fluent_language !== undefined && { fluent_language: user.fluent_language }),
      ...(user.fluent_language_others !== undefined && { fluent_language_others: user.fluent_language_others }),
      ...(user.audience_region !== undefined && { audience_region: user.audience_region }),
      ...(user.content_category_list !== undefined && { content_category_list: user.content_category_list }),
      ...(user.audience_size !== undefined && { audience_size: user.audience_size }),
      ...(user.first_login !== undefined && { first_login: user.first_login }),
      ...(user.average_views_per_post !== undefined && { average_views_per_post: user.average_views_per_post }),
      ...(user.crypto_experience !== undefined && { crypto_experience: user.crypto_experience }),
      ...(user.trading_experience !== undefined && { trading_experience: user.trading_experience }),
      ...(user.main_chains_other !== undefined && { main_chains_other: user.main_chains_other }),
      ...(user.investment_participation_style !== undefined && { investment_participation_style: user.investment_participation_style }),
      // Sempre enviar arrays/strings do onboarding com fallback (garante que edit profile receba os dados)
      content_formats: Array.isArray(user.content_formats) ? user.content_formats : [],
      example_content_links: user.example_content_links ?? '',
      favorite_protocols_projects: user.favorite_protocols_projects ?? '',
      crypto_content_specialization: Array.isArray(user.crypto_content_specialization) ? user.crypto_content_specialization : [],
      main_chains: Array.isArray(user.main_chains) ? user.main_chains : []
    };

    if (user.twitter_id) {
      if (user.twitter_username) profile.twitter_username = user.twitter_username;
      if (user.twitter_display_name) profile.twitter_display_name = user.twitter_display_name;
      if (user.twitter_profile_image) profile.twitter_profile_image = user.twitter_profile_image;
      if (user.twitter_followers_count !== undefined) profile.twitter_followers_count = user.twitter_followers_count;
    } 
    
    if (user.tiktok_id) {
      if (user.tiktok_username) profile.tiktok_username = user.tiktok_username;
      if (user.tiktok_name) profile.tiktok_name = user.tiktok_name;

      if(!user.twitter_id) {
        if (user.twitter_username) profile.tiktok_username = user.tiktok_username;
        if (user.twitter_display_name) profile.tiktok_name = user.tiktok_name;
        profile.twitter_profile_image = "data:image/jpeg;base64,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";
      }
    }

    if (user.google_id) {
      if (user.google_name) profile.google_name = user.google_name;

      if(!user.twitter_id) {
        profile.twitter_username = user.google_name;
        profile.twitter_profile_image = "data:image/jpeg;base64,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";
      }
    }

/*    if (user.instagram_id) {
      if (user.instagram_username) profile.instagram_username = user.instagram_username;
      if (user.instagram_name) profile.instagram_name = user.instagram_name;

      if(!user.twitter_id) {
        if (user.twitter_username) profile.instagram_username = user.instagram_username;
        if (user.twitter_display_name) profile.instagram_name = user.instagram_name;
        profile.twitter_profile_image = "data:image/jpeg;base64,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";
      }
    } */

    return profile;
  }

  public async getCampaignWinners(campaignId: string): Promise<Array<{ rank: number; username: string; amount_received: number; twitter_profile_image?: string; submission_twitter?: string; submission_tiktok?: string; submission_instagram?: string; submission_youtube?: string; submission_feedback?: string; payment_rank_generate_ai?: boolean }>> {
    const campaign = await CampaignModel.findById(campaignId);
    const winners = await CampaignParticipantsModel.findWinnersByCampaignId(campaignId);

    const winnerUserIds = winners.map(w => w.userId);
    const winnerUsersMap = await UserModel.findByIds(winnerUserIds);

    const winnersWithUsername = winners.map(winner => {
      const user = winnerUsersMap.get(winner.userId);
      const result: { rank: number; username: string; amount_received: number; twitter_profile_image?: string; submission_twitter?: string; submission_tiktok?: string; submission_instagram?: string; submission_youtube?: string; submission_feedback?: string; payment_rank_generate_ai?: boolean } = {
        rank: winner.rank || 0,
        username: user?.username || '',
        amount_received: winner.amount_received || 0
      };

      if (user?.twitter_profile_image) {
        result.twitter_profile_image = user.twitter_profile_image;
      }

      if (winner.submission_twitter) {
        result.submission_twitter = winner.submission_twitter;
      }

      if (winner.submission_tiktok) {
        result.submission_tiktok = winner.submission_tiktok;
      }

      if (winner.submission_instagram) {
        result.submission_instagram = winner.submission_instagram;
      }

      if (winner.submission_youtube) {
        result.submission_youtube = winner.submission_youtube;
      }

      if (winner.submission_feedback) {
        result.submission_feedback = winner.submission_feedback;
      }

      if (campaign?.payment_rank_generate_ai !== undefined) {
        result.payment_rank_generate_ai = campaign.payment_rank_generate_ai;
      }

      return result;
    }
    );
    
    return winnersWithUsername;
  }

  public async updateDescriptionProfile(userId: string, description: string): Promise<{ message: string; description: string }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const updatedUser = await UserModel.updateById(userId, { description });
    if (!updatedUser) throw new Error('Error updating description');

    return {
      message: 'Description updated successfully',
      description: updatedUser.description || ''
    };
  }

  public async updateProfileAfterLogin(userId: string, data: Partial<UpdateProfileAfterLoginDto>): Promise<{ message: string; user: IUser }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can update profile');

    const updateData: Partial<IUser> = {};
    const dataRecord = data as Record<string, unknown>;
    for (const key of UPDATE_PROFILE_AFTER_LOGIN_KEYS) {
      const value = dataRecord[key];
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }
    // Garantir persistência dos campos que o frontend envia (arrays/strings) mesmo quando undefined no primeiro loop
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'content_formats')) {
      (updateData as Record<string, unknown>)['content_formats'] = Array.isArray(dataRecord['content_formats']) ? dataRecord['content_formats'] : [];
    }
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'example_content_links')) {
      (updateData as Record<string, unknown>)['example_content_links'] = typeof dataRecord['example_content_links'] === 'string' ? dataRecord['example_content_links'] : (dataRecord['example_content_links'] ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'favorite_protocols_projects')) {
      (updateData as Record<string, unknown>)['favorite_protocols_projects'] = typeof dataRecord['favorite_protocols_projects'] === 'string' ? dataRecord['favorite_protocols_projects'] : (dataRecord['favorite_protocols_projects'] ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'crypto_content_specialization')) {
      (updateData as Record<string, unknown>)['crypto_content_specialization'] = Array.isArray(dataRecord['crypto_content_specialization']) ? dataRecord['crypto_content_specialization'] : [];
    }
    // Map username_twitter → twitter_username (field name in User model)
    if (dataRecord['username_twitter'] !== undefined) {
      updateData.twitter_username = dataRecord['username_twitter'] as string;
      delete (updateData as Record<string, unknown>)['username_twitter'];
    }
    updateData.first_login = false;

    const updatedUser = await UserModel.updateById(userId, updateData);
    if (!updatedUser) throw new Error('Error updating profile');

    return {
      message: 'Profile updated successfully',
      user: updatedUser
    };
  }

  public async updateProfile(userId: string, data: Partial<UpdateProfileDto>): Promise<{ message: string; user: IUser }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'CREATOR') throw new Error('Only CREATOR users can update profile');

    const updateData: Partial<IUser> = {};
    const dataRecord = data as Record<string, unknown>;
    for (const key of UPDATE_PROFILE_KEYS) {
      const value = dataRecord[key];
      if (value !== undefined) {
        (updateData as Record<string, unknown>)[key] = value;
      }
    }
    // Garantir persistência dos campos que o frontend envia (arrays/strings) mesmo quando undefined no primeiro loop
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'content_formats')) {
      (updateData as Record<string, unknown>)['content_formats'] = Array.isArray(dataRecord['content_formats']) ? dataRecord['content_formats'] : [];
    }
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'example_content_links')) {
      (updateData as Record<string, unknown>)['example_content_links'] = typeof dataRecord['example_content_links'] === 'string' ? dataRecord['example_content_links'] : (dataRecord['example_content_links'] ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'favorite_protocols_projects')) {
      (updateData as Record<string, unknown>)['favorite_protocols_projects'] = typeof dataRecord['favorite_protocols_projects'] === 'string' ? dataRecord['favorite_protocols_projects'] : (dataRecord['favorite_protocols_projects'] ?? '');
    }
    if (Object.prototype.hasOwnProperty.call(dataRecord, 'crypto_content_specialization')) {
      (updateData as Record<string, unknown>)['crypto_content_specialization'] = Array.isArray(dataRecord['crypto_content_specialization']) ? dataRecord['crypto_content_specialization'] : [];
    }
    // Map username_twitter → twitter_username (field name in User model)
    if (dataRecord['username_twitter'] !== undefined) {
      updateData.twitter_username = dataRecord['username_twitter'] as string;
      delete (updateData as Record<string, unknown>)['username_twitter'];
    }
    if (Object.keys(updateData).length === 0) {
      return { message: 'No fields to update', user };
    }

    updateData.first_login = false;

    if (updateData.wallet_evm !== undefined && updateData.wallet_evm !== user.wallet_evm) {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'evm');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your EVM wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    if (updateData.wallet_sol !== undefined && updateData.wallet_sol !== user.wallet_sol) {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'sol');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your Solana wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    if (updateData.wallet_sui !== undefined && updateData.wallet_sui !== user.wallet_sui) {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'sui');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your Sui wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    if (updateData.wallet_stellar !== undefined && updateData.wallet_stellar !== user.wallet_stellar) {
      const hasBlockedCampaign = await hasWaitingPaymentCampaignForChain(userId, 'stellar');
      if (hasBlockedCampaign) {
        throw new Error('You cannot change your Stellar wallet while you are participating in a campaign in waiting payment status for this chain');
      }
    }

    const updatedUser = await UserModel.updateById(userId, updateData);
    if (!updatedUser) throw new Error('Error updating profile');

    return {
      message: 'Profile updated successfully',
      user: updatedUser
    };
  }

  public async getViewTransactionsCreator(userId: string): Promise<Array<{ signature: string; payment_chain: string; name_campaign: string }>> {
    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');

    const payments = await PaymentModel.findByUserId(userId);
    const transactions = [];
    
    for (const payment of payments) {
      const campaign = await CampaignModel.findById(payment.campaignId);
      if (campaign) {
        transactions.push({
          signature: payment.signature,
          payment_chain: campaign.payment_chain,
          name_campaign: campaign.title,
          amount: payment.amount
        });
      }
    }
    
    return transactions;
  }

  public async getRecentEarners(limit: number = 10): Promise<Array<{ twitter_profile_image?: string; username: string; description?: string; amount_earned: number }>> {
    const cacheKey = `earners:${limit}`;
    
    const cachedResult = await earnersCache.get<Array<{ twitter_profile_image?: string; username: string; description?: string; amount_earned: number }>>(cacheKey);
    if (cachedResult) return cachedResult;

    const collection = await CampaignParticipantsModel['getCollection']();
    
    const aggregationResult = await collection.aggregate([
      {
        $match: {
          amount_received: { $gt: 0 },
          date_received: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$userId',
          amount_earned: { $sum: '$amount_received' },
          most_recent_date: { $max: '$date_received' }
        }
      },
      {
        $sort: { amount_earned: -1 }
      },
      {
        $limit: limit
      }
    ]).toArray();

    // Evita N+1 queries: buscar todos os users em lote.
    const userIdStrings = aggregationResult
      .map((r: any) => r?._id)
      .filter((id: unknown) => typeof id === 'string' && id.trim().length > 0) as string[];

    const validObjectIds = userIdStrings
      .filter((id) => id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id))
      .map((id) => new ObjectId(id));

    let users: Array<{ _id?: any; username: string; description?: string; twitter_profile_image?: string }> = [];
    if (validObjectIds.length) {
      // UserModel.getCollection() é private; seguimos o mesmo padrão que já existe em CampaignParticipantsModel.
      const userCollection = await (UserModel as any)['getCollection']();
      users = await userCollection
        .find({
          _id: { $in: validObjectIds },
          user_type: 'CREATOR',
        })
        .project({
          username: 1,
          description: 1,
          twitter_profile_image: 1,
        })
        .toArray();
    }

    const userById = new Map<string, typeof users[number]>();
    for (const u of users) {
      const idStr = u?._id ? u._id.toString() : '';
      if (idStr) userById.set(idStr, u);
    }

    const earners: Array<{
      twitter_profile_image?: string;
      username: string;
      description?: string;
      amount_earned: number;
    }> = [];

    // Mantém a ordem do aggregationResult (mais recente primeiro).
    for (const result of aggregationResult as any[]) {
      const userId = result?._id ? String(result._id) : '';
      const user = userById.get(userId);
      if (!user) continue;

      earners.push({
        username: user.username,
        amount_earned: Number(result?.amount_earned ?? 0) || 0,
        ...(user.twitter_profile_image ? { twitter_profile_image: user.twitter_profile_image } : {}),
        ...(user.description ? { description: user.description } : {}),
      });
    }
    
    await earnersCache.set(cacheKey, earners);
    
    return earners;
  }

  public async getTwitterInfo(creatorId: string): Promise<{ twitter_username?: string; twitter_profile_image?: string }> {
    const user = await UserModel.findById(creatorId);
    if (!user) throw new Error('User not found');
    
    return {
      ...(user.twitter_display_name && { twitter_display_name: user.twitter_display_name }),
      ...(user.twitter_profile_image && { twitter_profile_image: user.twitter_profile_image })
    };
  }

  public async createShortUrl(campaignId: string, userId: string): Promise<IShortURL> {
    const apiKey = process.env['SHORT_API_KEY'] || '';
    const domain = process.env['SHORT_DOMAIN_ID'] || '';

    if (!apiKey || !domain) {
      throw new Error('SHORT_API_KEY or SHORT_DOMAIN_ID not configured');
    }

    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    if (!campaign.original_url_shortener) throw new Error('Campaign does not have original_url_shortener configured');

    try {
      const response = await fetch(`https://api.short.io/links`, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allowDuplicates: true,
          originalURL: campaign.original_url_shortener,
          domain: domain
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error creating short URL: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as ShortIOApiResponse;

      if (!data.idString || !data.shortURL)
        throw new Error('Invalid Short.io API response: idString or shortURL not found');

      const shortUrlRecord = await ShortURLModel.create({
        idString: data.idString,
        shortURL: data.shortURL,
        campaignId,
        userId,
        clicks: 0
      });

      return shortUrlRecord;
    } catch (error: any) {
      console.error('Error creating short URL:', error);
      throw new Error(`Error creating short URL: ${error.message}`);
    }
  }

  public async getShortenerUserCampaign(campaignId: string, userId: string): Promise<{ shortURL: string }> {
    const shortUrlRecord = await ShortURLModel.findByCampaignIdAndUserId(campaignId, userId);
    
    return { shortURL: shortUrlRecord?.shortURL || '' };
  }

  public async getShortenerKols(campaignId: string, userId: string): Promise<{ shortURL: string }> {
    const shortUrlRecord = await ShortURLModel.findKolsByCampaignIdAndUserId(campaignId, userId);
    return { shortURL: shortUrlRecord?.shortURL || '' };
  }

  public async getCampaignShortUrls(campaignId: string): Promise<Array<{ username: string; campaignTitle: string; shortURL: string; clicks: number }>> {
    const campaign = await CampaignModel.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    const shortUrlCollection = db.collection<IShortURL>('encurtador_url');
    const usersCollection = db.collection('users');
    
    const urls = await shortUrlCollection.find({ campaignId }).toArray();

    const urlUserIds = urls.map(u => u.userId).filter((id): id is string => !!id);
    const uniqueUrlUserIds = [...new Set(urlUserIds)];
    const userDocs = uniqueUrlUserIds.length > 0
      ? await usersCollection.find({ _id: { $in: uniqueUrlUserIds.map(id => new ObjectId(id)) } }).toArray()
      : [];
    const userMap = new Map(userDocs.map(u => [u['_id'].toString(), u]));

    const result = urls
      .filter(url => url.userId && userMap.has(url.userId))
      .map(url => ({
        username: (userMap.get(url.userId!) as any)?.['username'] || '',
        campaignTitle: campaign.title,
        shortURL: url.shortURL,
        clicks: url.clicks || 0
      }));

    return result;
  }

  public async createShortenerKols(linkReferral: string, userId: string, campaignId: string): Promise<IShortURL> {
    const apiKey = process.env['SHORT_API_KEY'] || '';
    const domain = process.env['SHORT_DOMAIN_ID'] || '';

    if (!apiKey || !domain) {
      throw new Error('SHORT_API_KEY or SHORT_DOMAIN_ID not configured');
    }

    if (!linkReferral) {
      throw new Error('linkReferral is required');
    }

    if (!campaignId) {
      throw new Error('campaignId is required');
    }

    try {
      const response = await fetch(`https://api.short.io/links`, {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          allowDuplicates: true,
          originalURL: linkReferral,
          domain: domain
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error creating short URL: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as ShortIOApiResponse;

      if (!data.idString || !data.shortURL)
        throw new Error('Invalid Short.io API response: idString or shortURL not found');

      const shortUrlRecord = await ShortURLModel.create({
        idString: data.idString,
        shortURL: data.shortURL,
        campaignId,
        userId,
        clicks: 0
      });

      return shortUrlRecord;
    } catch (error: any) {
      console.error('Error creating short URL for KOLs:', error);
      throw new Error(`Error creating short URL: ${error.message}`);
    }
  }
}
