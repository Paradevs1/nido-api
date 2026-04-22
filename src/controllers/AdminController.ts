import { Request, Response } from 'express';
import { AdminService } from '../services/AdminService';
import { PaymentService } from '../services/PaymentService';
import { UpdateCampaignDto } from '../dtos/campaign.dto';

export class AdminController {
  private adminService: AdminService;
  private paymentService: PaymentService;

  constructor() {
    this.adminService = new AdminService();
    this.paymentService = new PaymentService();
  }

  /**
   * @swagger
   * /api/admin/campaign-stats/{campaignId}:
   *   get:
   *     summary: Recuperar estatísticas da campanha (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Estatísticas da campanha recuperadas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 views_twitter:
   *                   type: number
   *                   description: Total de views na campanha
   *                 likes_twitter:
   *                   type: number
   *                   description: Total de likes na campanha
   *                 retweets_twitter:
   *                   type: number
   *                   description: Total de retweets na campanha
   *                 replies_twitter:
   *                   type: number
   *                   description: Total de replies na campanha
   *                 total_submissions:
   *                   type: number
   *                   description: Total de submissões na campanha
   *                 winners:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       username:
   *                         type: string
   *                         description: Username do vencedor
   *                       amount_received:
   *                         type: number
   *                         description: Valor recebido pelo vencedor
   *                   description: Lista de vencedores com username e amount recebido
   *       400:
   *         description: Campaign ID é obrigatório
   *       404:
   *         description: Campanha não encontrada
   *       401:
   *         description: Token de autenticação inválido
   */
  public getCampaignStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const stats = await this.adminService.getCampaignStats(campaignId);

      res.status(200).json(stats);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error retrieving campaign stats',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/admin/campaign-metrics/{campaignId}:
   *   get:
   *     summary: Recuperar métricas detalhadas da campanha com dados por creator (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Métricas da campanha recuperadas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 title:
   *                   type: string
   *                   description: Nome da campanha
   *                 total_posts:
   *                   type: number
   *                   description: Total de posts (submissions) na campanha
   *                 total_submissions:
   *                   type: number
   *                   description: Total de creators que submeteram
   *                 total_likes:
   *                   type: number
   *                   description: Total de likes na campanha
   *                 total_views:
   *                   type: number
   *                   description: Total de views na campanha
   *                 total_replies:
   *                   type: number
   *                   description: Total de replies na campanha
   *                 total_retweets:
   *                   type: number
   *                   description: Total de retweets na campanha
   *                 total_quotes:
   *                   type: number
   *                   description: Total de quotes na campanha
   *                 post_kols:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       username:
   *                         type: string
   *                         description: Username do creator
   *                       total_submissions:
   *                         type: number
   *                         description: Quantidade de submissions do creator
   *                       total_likes:
   *                         type: number
   *                         description: Total de likes do creator
   *                       total_views:
   *                         type: number
   *                         description: Total de views do creator
   *                       total_replies:
   *                         type: number
   *                         description: Total de replies do creator
   *                       total_retweets:
   *                         type: number
   *                         description: Total de retweets do creator
   *                       submissions:
   *                         type: array
   *                         items:
   *                           type: string
   *                         description: Lista de links de submissions do creator
   *                   description: Lista de creators com métricas individuais
   *       400:
   *         description: Campaign ID é obrigatório
   *       404:
   *         description: Campanha não encontrada
   *       401:
   *         description: Token de autenticação inválido
   */
  public getCampaignMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        res.status(400).json({ message: 'Campaign ID is required' });
        return;
      }

      const metrics = await this.adminService.getCampaignMetrics(campaignId);
      res.status(200).json(metrics);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({
        message: 'Error retrieving campaign metrics',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/admin/creators/participation-stats:
   *   get:
   *     summary: Creators com quantidade de campanhas em que participaram (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Filtro por username ou twitter_username
   *     responses:
   *       200:
   *         description: Lista com campaigns_participated por creator
   */
  public getCreatorsParticipationStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page']), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit']), 10) || 50));
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
      const result = await this.adminService.getCreatorsParticipationStats(page, limit, search);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing creators participation stats', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/creators/recurring:
   *   get:
   *     summary: Creators que participaram das últimas N campanhas (todas) (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: lastN
   *         schema:
   *           type: integer
   *           default: 5
   *         description: Quantidade de campanhas mais recentes (por created_at) a considerar (máx. 50)
   *     responses:
   *       200:
   *         description: Lista recorrente + last_campaigns usados na janela
   */
  public getRecurringCreators = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page']), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit']), 10) || 50));
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
      const lastN = parseInt(String(req.query['lastN']), 10) || 5;
      const campaignTypeParam = String(req.query['campaignType'] || 'all');
      const campaignType = (['public', 'private', 'all'].includes(campaignTypeParam) ? campaignTypeParam : 'all') as 'public' | 'private' | 'all';
      const result = await this.adminService.getRecurringCreatorsLastNCampaigns(page, limit, search, lastN, campaignType);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing recurring creators', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/creators:
   *   get:
   *     summary: Listar creators (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Filtro por username ou twitter_username (mesmo parâmetro busca nos dois)
   *     responses:
   *       200:
   *         description: Lista de creators (twitter_username, twitter_followers_count, total_earnings, wallet_evm, wallet_sui, wallet_sol)
   *       401:
   *         description: Token inválido
   */
  public getCreatorsList = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page']), 10) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(String(req.query['limit']), 10) || 50));
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : (typeof req.query['twitter_username'] === 'string' ? req.query['twitter_username'] : (typeof req.query['username'] === 'string' ? req.query['username'] : undefined));
      const sortByRaw = typeof req.query['sortBy'] === 'string' ? req.query['sortBy'].toLowerCase() : '';
      const sortOrderRaw = typeof req.query['sortOrder'] === 'string' ? req.query['sortOrder'].toLowerCase() : '';
      const sortBy = sortByRaw === 'followers' || sortByRaw === 'earnings' ? (sortByRaw as 'followers' | 'earnings') : undefined;
      const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? (sortOrderRaw as 'asc' | 'desc') : undefined;
      const result = await this.adminService.getCreatorsList(page, limit, search, sortBy, sortOrder);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing creators', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/creators/insights:
   *   get:
   *     summary: Listar creators (Admin) com dados de insights (resumo)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *     responses:
   *       200:
   *         description: Lista de creators (usernames discord/instagram/telegram/tiktok/youtube + average_views_per_post)
   */
  public getCreatorsInsightsList = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page']), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit']), 10) || 50));
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
      const averageViews = typeof req.query['average_views_per_post'] === 'string' ? req.query['average_views_per_post'] : undefined;
      const primaryLanguage = typeof req.query['primary_language'] === 'string' ? req.query['primary_language'] : undefined;
      const fluentLanguage = typeof req.query['fluent_language'] === 'string' ? req.query['fluent_language'] : undefined;
      const audienceRegion = typeof req.query['audience_region'] === 'string' ? req.query['audience_region'] : undefined;
      const contentCategory = typeof req.query['content_category_list'] === 'string' ? req.query['content_category_list'] : undefined;
      const contentFormats = typeof req.query['content_formats'] === 'string' ? req.query['content_formats'] : undefined;
      const cryptoExperience = typeof req.query['crypto_experience'] === 'string' ? req.query['crypto_experience'] : undefined;
      const tradingExperience = typeof req.query['trading_experience'] === 'string' ? req.query['trading_experience'] : undefined;
      const mainChains = typeof req.query['main_chains'] === 'string' ? req.query['main_chains'] : undefined;
      const filters: {
        search?: string;
        average_views_per_post?: string;
        primary_language?: string;
        fluent_language?: string;
        audience_region?: string;
        content_category_list?: string;
        content_formats?: string;
        crypto_experience?: string;
        trading_experience?: string;
        main_chains?: string;
      } = {};
      if (search !== undefined) filters.search = search;
      if (averageViews !== undefined) filters.average_views_per_post = averageViews;
      if (primaryLanguage !== undefined) filters.primary_language = primaryLanguage;
      if (fluentLanguage !== undefined) filters.fluent_language = fluentLanguage;
      if (audienceRegion !== undefined) filters.audience_region = audienceRegion;
      if (contentCategory !== undefined) filters.content_category_list = contentCategory;
      if (contentFormats !== undefined) filters.content_formats = contentFormats;
      if (cryptoExperience !== undefined) filters.crypto_experience = cryptoExperience;
      if (tradingExperience !== undefined) filters.trading_experience = tradingExperience;
      if (mainChains !== undefined) filters.main_chains = mainChains;

      const result = await this.adminService.getCreatorsInsightsList(page, limit, filters);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing creators insights', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/creators/insights/options:
   *   get:
   *     summary: Opções de filtros para creators insights (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Opções distintas para filtros da tela de insights
   */
  public getCreatorsInsightsOptions = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.adminService.getCreatorsInsightsFilterOptions();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing creators insights options', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/users/{userId}:
   *   get:
   *     summary: Detalhe de um usuário (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Dados do usuário (sem password) + payments_count, payments_confirmed_count
   *       404:
   *         description: User not found
   */
  public getUserDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
      }
      const result = await this.adminService.getUserDetail(userId);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error getting user detail', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/users/{userId}/active:
   *   patch:
   *     summary: Ativar ou desativar usuário (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [isActive]
   *             properties:
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: User activated or deactivated
   *       404:
   *         description: User not found
   */
  public setUserActive = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const isActive = req.body?.isActive;
      if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
      }
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ message: 'Body must contain isActive (boolean)' });
        return;
      }
      const result = await this.adminService.setUserActive(userId, isActive);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error updating user active status', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/host/{userId}/status:
   *   patch:
   *     summary: Definir status da conta (active/inactive) para um HOST (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *     responses:
   *       200:
   *         description: Status atualizado
   *       400:
   *         description: Corpo inválido ou usuário não é HOST
   *       404:
   *         description: Usuário não encontrado
   */
  public setHostAccountStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const status = req.body?.status;
      if (!userId) {
        res.status(400).json({ message: 'User ID is required' });
        return;
      }
      
      const result = await this.adminService.setHostAccountStatus(userId, status);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'User not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message === 'Only HOST users have account status') {
        res.status(400).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error updating host account status', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/payments:
   *   get:
   *     summary: Listar pagamentos para auditoria (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *         description: Filtrar por usuário
   *       - in: query
   *         name: campaignId
   *         schema:
   *           type: string
   *         description: Filtrar por campanha
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, confirmed, failed, error]
   *         description: Filtrar por status (conforme coleção; host/plan podem usar error)
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Busca em nome de usuário, empresa e campanha (após enriquecer lista)
   *       - in: query
   *         name: source
   *         schema:
   *           type: string
   *           enum: [Winners, Active Campaign, Refunds, Plans]
   *         description: Filtrar por origem unificada
   *     responses:
   *       200:
   *         description: |
   *           Lista unificada (Winners, Active Campaign, Refunds, Plans) com paginação e campo `source`.
   *           Com **campaignId**: retorna apenas pagamentos ligados à campanha; **Plans** não entram (sem campaignId no documento).
   *           Com filtro por campanha/usuário, a API busca janela maior para paginação correta após merge.
   */
  public getPaymentsList = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page']), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit']), 10) || 50));
      const userId = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;
      const campaignId = typeof req.query['campaignId'] === 'string' ? req.query['campaignId'] : undefined;
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
      const source = typeof req.query['source'] === 'string' ? req.query['source'] : undefined;
      const filters: { userId?: string; campaignId?: string; status?: string; search?: string; source?: string } = {};
      if (userId !== undefined) filters.userId = userId;
      if (campaignId !== undefined) filters.campaignId = campaignId;
      if (status !== undefined) filters.status = status;
      if (search !== undefined) filters.search = search;
      if (source !== undefined) filters.source = source;
      const result = await this.adminService.getPaymentsList(page, limit, filters);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing payments', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/hosts:
   *   get:
   *     summary: Listar hosts (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Filtro por name_company ou email
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *           enum: [true, false]
   *         description: Filtro por conta ativa (true ou false)
   *     responses:
   *       200:
   *         description: Lista de hosts (name_company, email, campaigns_created, plan_name, duration_plan, isActive)
   *       401:
   *         description: Token inválido
   */
  /**
   * @swagger
   * /api/admin/hosts/options:
   *   get:
   *     summary: List hosts for dropdown (host_id, name_company) (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Array of { host_id, name_company } (only active hosts)
   *       401:
   *         description: Token inválido
   */
  public getHostsCombo = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.adminService.getHostsCombo();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing hosts combo', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/campaigns/options:
   *   get:
   *     summary: List campaigns for dropdown (id, name, isPrivate) (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Array de { id, name, isPrivate }
   *       401:
   *         description: Token inválido
   */
  public getCampaignsCombo = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.adminService.getCampaignsCombo();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing campaigns combo', error: error.message });
    }
  };

  public getHostsList = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(String(req.query['page']), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit']), 10) || 50));
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : (typeof req.query['twitter_username'] === 'string' ? req.query['twitter_username'] : undefined);
      const ac = req.query['accountStatus'];
      const accountStatus =
        ac === 'active' || ac === 'inactive' ? (ac as 'active' | 'inactive') : undefined;
      const result = await this.adminService.getHostsList(page, limit, search, accountStatus);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error listing hosts', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/campaigns/counts:
   *   get:
   *     summary: Quantidade de campanhas privadas e públicas (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Retorna { private, public, total }
   *       401:
   *         description: Token inválido
   */

  public getCampaignCountsPrivatePublic = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.adminService.getCampaignCountsPrivatePublic();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ message: 'Error getting campaign counts', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/campaigns/{campaignId}/short-urls:
   *   get:
   *     summary: ShortURL dos creators por campanha (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Retorna campaignTitle (nome da campanha) e items (twitter_username, shortURL, clicks)
   *       401:
   *         description: Token inválido
   */
  public getCampaignShortUrls = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      if (!campaignId) {
        res.status(400).json({ message: 'Campaign ID is required' });
        return;
      }
      const result = await this.adminService.getCampaignShortUrlsForAdmin(campaignId);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Campaign not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error listing campaign short URLs', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/hosts/{hostId}/plan:
   *   patch:
   *     summary: Atualizar plano do host (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: hostId
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plan_id]
   *             properties:
   *               plan_id:
   *                 type: string
   *     responses:
   *       200:
   *         description: Plano atualizado
   *       401:
   *         description: Token inválido
   */
  public updateHostPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const { hostId } = req.params;
      const plan_id = typeof req.body?.plan_id === 'string' ? req.body.plan_id : undefined;
      if (!hostId || !plan_id) {
        res.status(400).json({ message: 'host_id and plan_id are required' });
        return;
      }
      const result = await this.adminService.updateHostPlan(hostId, plan_id);
      res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Host not found' || error.message === 'Plan not found' || error.message === 'User is not a host') {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error updating host plan', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/users-submissions/export:
   *   get:
   *     summary: Exportar usuários que submeteram campanhas para Excel (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: campaignId
   *         required: false
   *         schema:
   *           type: string
   *         description: ID da campanha (opcional)
   *     responses:
   *       200:
   *         description: Arquivo Excel gerado com sucesso
   *         content:
   *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
   *             schema:
   *               type: string
   *               format: binary
   *       500:
   *         description: Erro ao gerar arquivo Excel
   */
  public exportUsersWithSubmissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.query;

      const buffer = await this.adminService.exportUsersWithSubmissions(
        campaignId as string | undefined
      );

      const filename = campaignId 
        ? `users_submissions_${campaignId}.xlsx`
        : 'users_submissions_all.xlsx';

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );

      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({
        message: 'Error exporting users with submissions',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/admin/export/campaigns/{campaignId}/short-urls:
   *   get:
   *     summary: Exportar Short URLs da campanha para Excel (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Arquivo Excel (twitter_username, shortURL, clicks)
   *       404:
   *         description: Campaign not found
   */
  public exportShortUrlsExcel = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      if (!campaignId) {
        res.status(400).json({ message: 'Campaign ID is required' });
        return;
      }
      const buffer = await this.adminService.exportShortUrlsExcel(campaignId);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="short_urls_${campaignId}.xlsx"`);
      res.send(buffer);
    } catch (error: any) {
      if (error.message === 'Campaign not found') {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error exporting short URLs', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/export/creators:
   *   get:
   *     summary: Exportar lista de creators para Excel (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: twitter_username
   *         schema:
   *           type: string
   *         description: Filtrar por username (opcional)
   *     responses:
   *       200:
   *         description: Arquivo Excel (twitter_username, followers, earnings, wallets)
   */
  public exportCreatorsExcel = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = typeof req.query['twitter_username'] === 'string' ? req.query['twitter_username'] : undefined;
      const buffer = await this.adminService.exportCreatorsExcel(search);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="creators.xlsx"');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: 'Error exporting creators', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/export/hosts:
   *   get:
   *     summary: Exportar lista de hosts para Excel (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *     responses:
   *       200:
   *         description: Arquivo Excel (name_company, email, campaigns_created, plan, etc.)
   */
  public exportHostsExcel = async (req: Request, res: Response): Promise<void> => {
    try {
      const search = typeof req.query['search'] === 'string' ? req.query['search'] : undefined;
      const ac = req.query['accountStatus'];
      const accountStatus =
        ac === 'active' || ac === 'inactive' ? (ac as 'active' | 'inactive') : undefined;
      const buffer = await this.adminService.exportHostsExcel(search, accountStatus);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="hosts.xlsx"');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: 'Error exporting hosts', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/export/payments:
   *   get:
   *     summary: Exportar lista de pagamentos para Excel (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: userId
   *         schema:
   *           type: string
   *       - in: query
   *         name: campaignId
   *         schema:
   *           type: string
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Arquivo Excel (id, source, created_at, amount, status, etc.)
   */
  public exportPaymentsExcel = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = typeof req.query['userId'] === 'string' ? req.query['userId'] : undefined;
      const campaignId = typeof req.query['campaignId'] === 'string' ? req.query['campaignId'] : undefined;
      const status = typeof req.query['status'] === 'string' ? req.query['status'] : undefined;
      const filters: { userId?: string; campaignId?: string; status?: string } = {};
      if (userId !== undefined) filters.userId = userId;
      if (campaignId !== undefined) filters.campaignId = campaignId;
      if (status !== undefined) filters.status = status;
      const buffer = await this.adminService.exportPaymentsExcel(filters);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="payments.xlsx"');
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: 'Error exporting payments', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/instagram-story-metrics:
   *   put:
   *     summary: Adicionar ou editar métricas de Instagram Story de um usuário em uma campanha (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - campaign_id
   *               - user_id
   *               - likes
   *               - views
   *               - retweets
   *               - replies
   *             properties:
   *               campaign_id:
   *                 type: string
   *               user_id:
   *                 type: string
   *               likes:
   *                 type: number
   *               views:
   *                 type: number
   *               retweets:
   *                 type: number
   *               replies:
   *                 type: number
   *     responses:
   *       200:
   *         description: Métricas atualizadas com sucesso
   *       400:
   *         description: Campos obrigatórios ausentes
   *       404:
   *         description: Campanha ou participante não encontrado
   *       401:
   *         description: Token de autenticação inválido
   */
  public upsertInstagramStoryMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaign_id, user_id, likes, views, retweets, replies } = req.body;

      if (!campaign_id || !user_id || likes === undefined || views === undefined || retweets === undefined || replies === undefined) {
        res.status(400).json({ message: 'campaign_id, user_id, likes, views, retweets and replies are required' });
        return;
      }

      const result = await this.adminService.upsertInstagramStoryMetrics(campaign_id, user_id, { likes, views, retweets, replies });
      res.status(200).json({ message: 'Instagram Story metrics updated', data: result });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error updating Instagram Story metrics', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/instagram-story-metrics:
   *   delete:
   *     summary: Excluir (zerar) métricas de Instagram Story de um usuário em uma campanha (Admin)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - campaign_id
   *               - user_id
   *             properties:
   *               campaign_id:
   *                 type: string
   *               user_id:
   *                 type: string
   *     responses:
   *       200:
   *         description: Métricas removidas com sucesso
   *       400:
   *         description: Campos obrigatórios ausentes
   *       404:
   *         description: Campanha ou participante não encontrado
   *       401:
   *         description: Token de autenticação inválido
   */
  public deleteInstagramStoryMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaign_id, user_id } = req.body;

      if (!campaign_id || !user_id) {
        res.status(400).json({ message: 'campaign_id and user_id are required' });
        return;
      }

      const result = await this.adminService.deleteInstagramStoryMetrics(campaign_id, user_id);
      res.status(200).json({ message: 'Instagram Story metrics deleted', data: result });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error deleting Instagram Story metrics', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/run-all-metrics/{campaignId}:
   *   post:
   *     summary: Executar coleta de metricas de todas as plataformas para uma campanha (Admin)
   *     description: |
   *       Roda Twitter + Instagram + TikTok + YouTube em sequencia para todos os participantes da campanha.
   *       Nao depende do status da campanha e nao atualiza as flags is_job_*_executed.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Metricas coletadas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 twitter:
   *                   type: object
   *                   properties:
   *                     processed:
   *                       type: number
   *                     updated:
   *                       type: number
   *                 instagram:
   *                   type: object
   *                   properties:
   *                     processed:
   *                       type: number
   *                     updated:
   *                       type: number
   *                 tiktok:
   *                   type: object
   *                   properties:
   *                     processed:
   *                       type: number
   *                     updated:
   *                       type: number
   *                 youtube:
   *                   type: object
   *                   properties:
   *                     processed:
   *                       type: number
   *                     updated:
   *                       type: number
   *       400:
   *         description: Campaign ID obrigatorio
   *       404:
   *         description: Campanha nao encontrada
   *       401:
   *         description: Token de autenticacao invalido
   */
  public runAllMetricsForCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        res.status(400).json({ message: 'Campaign ID is required' });
        return;
      }

      const results = await this.adminService.runAllMetricsForCampaign(campaignId);
      res.status(200).json({
        message: `Metrics collected. Twitter: ${results.twitter.updated}/${results.twitter.processed}, Instagram: ${results.instagram.updated}/${results.instagram.processed}, TikTok: ${results.tiktok.updated}/${results.tiktok.processed}, YouTube: ${results.youtube.updated}/${results.youtube.processed}`,
        ...results,
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: 'Error running metrics collection', error: error.message });
    }
  };

  /**
   * @swagger
   * /api/admin/retry-failed-payments/{campaignId}:
   *   post:
   *     summary: Reprocessar pagamentos que falharam para winners de uma campanha
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Retry executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     campaign_id:
   *                       type: string
   *                     totalRetried:
   *                       type: number
   *                       description: Quantidade de pagamentos processados neste retry
   *                     totalUnpaidBefore:
   *                       type: number
   *                       description: Quantidade de winners sem pagamento antes do retry
   *                     allPaid:
   *                       type: boolean
   *                       description: Se todos os winners foram pagos com sucesso
   *                     transactions:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           paymentId:
   *                             type: string
   *                           signature:
   *                             type: string
   *                           to:
   *                             type: string
   *                             description: Wallet address do destinatário
   *                           transactionHash:
   *                             type: string
   *       400:
   *         description: Parâmetro campaignId ausente
   *       500:
   *         description: Erro interno ou todos os winners já foram pagos
   */
  public retryFailedPayments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        res.status(400).json({ success: false, error: 'Required parameter: campaignId' });
        return;
      }

      const result = await this.paymentService.retryFailedPayments(campaignId);

      res.status(200).json({
        success: true,
        message: result.allPaid
          ? `All winners paid successfully. ${result.totalRetried} payments processed.`
          : `Retry completed. ${result.totalRetried}/${result.totalUnpaidBefore} payments processed. Some winners still unpaid.`,
        data: result
      });
    } catch (error: any) {
      console.error('Error retrying failed payments:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  };
}
