import { Request, Response } from 'express';
import { HostService } from '../services/HostService';
import { CreateCampaignDto, UpdateCampaignDto } from '../dtos/campaign.dto';
import { CreateCampaignWinnersDto } from '../dtos/campaignParticipants.dto';
import { UpdateProfileDto } from '../dtos/auth.dto';

export class HostController {
  private hostService: HostService;

  constructor() {
    this.hostService = new HostService();
  }

  /**
   * @swagger
   * /api/host/campaigns/public:
   *   get:
   *     summary: Listar todas as campanhas públicas
   *     description: Requer autenticação. Aceita usuários HOST, CREATOR ou ADMIN.
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Número de itens por página
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [active, inactive, completed, cancelled]
   *         description: Filtrar por status
   *     responses:
   *       200:
   *         description: Lista de campanhas públicas obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaigns:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       title:
   *                         type: string
   *                       about_project:
   *                         type: string
   *                       status:
   *                         type: string
   *                       total_prize_pool:
   *                         type: number
   *                       deadline:
   *                         type: number
   *                       deadline_detailed:
   *                         type: object
   *                         properties:
   *                           days:
   *                             type: number
   *                           hours:
   *                             type: number
   *                           minutes:
   *                             type: number
   *                           total_minutes:
   *                             type: number
   *                           is_expired:
   *                             type: boolean
   *                       start_date:
   *                         type: string
   *                         format: date-time
   *                       end_date:
   *                         type: string
   *                         format: date-time
   *                       content_categories:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             slug:
   *                               type: string
   *                       total_submissions:
   *                         type: number
   *                         description: Total de submissões na campanha
   *                 total:
   *                   type: number
   *                 page:
   *                   type: number
   *                 totalPages:
   *                   type: number
   */
  public getAllCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(String(req.query['page'] || '1'), 10) || 1;
      const limit = parseInt(String(req.query['limit'] || '10'), 10) || 10;
      
      const filters: any = {};
      if (req.query['type']) {
        filters.type = String(req.query['type']);
      }

      const user = (req as any).user;
      const userId = user?.userId;
      const userRole = user?.role;

      const result = await this.hostService.getAllCampaigns(page, limit, filters, userId, userRole);

      res.status(200).json({
        message: 'Public campaigns retrieved successfully',
        ...result
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching campaign',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns:
   *   get:
   *     summary: Listar campanhas do host
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Número de itens por página
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *         description: Filtrar por tipo (slug da categoria)
   *     responses:
   *       200:
   *         description: Lista de campanhas obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaigns:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       title:
   *                         type: string
   *                       about_project:
   *                         type: string
   *                       status:
   *                         type: string
   *                       total_prize_pool:
   *                         type: number
   *                       deadline:
   *                         type: number
   *                       deadline_detailed:
   *                         type: object
   *                         properties:
   *                           days:
   *                             type: number
   *                           hours:
   *                             type: number
   *                           minutes:
   *                             type: number
   *                           total_minutes:
   *                             type: number
   *                           is_expired:
   *                             type: boolean
   *                       start_date:
   *                         type: string
   *                         format: date-time
   *                       end_date:
   *                         type: string
   *                         format: date-time
   *                       content_categories:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             slug:
   *                               type: string
   *                       total_submissions:
   *                         type: number
   *                         description: Total de submissões na campanha
   *                       hasUserSubmitted:
   *                         type: boolean
   *                         description: Indica se o usuário já fez submit nesta campanha
   *                 total:
   *                   type: number
   *                 page:
   *                   type: number
   *                 totalPages:
   *                   type: number
   *       401:
   *         description: Token de autenticação inválido
   */
  public getCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const filters: any = {};
      
      if (req.query['type']) {
        filters.type = req.query['type'];
      }

      const result = await this.hostService.getCampaignsByHost(hostId, page, limit, filters);

      res.status(200).json({
        message: 'Campaigns retrieved successfully',
        ...result
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching campaigns',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}:
   *   get:
   *     summary: Obter campanha por ID
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Campanha obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaign:
   *                   type: object
   *                   properties:
   *                     links_officials:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Lista de links oficiais
   *       404:
   *         description: Campanha não encontrada
   *       401:
   *         description: Token de autenticação inválido
   */
  public getCampaignById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const userId = user?.userId;
      const userRole = user?.role;
      
      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }
      
      const campaign = await this.hostService.getCampaignById(id, userId, userRole);

      if (!campaign) {
        res.status(404).json({
          message: 'Campaign not found'
        });
        return;
      }

      res.status(200).json({
        message: 'Campaign retrieved successfully',
        campaign
      });
    } catch (error: any) {
      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching campaign',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns:
   *   post:
   *     summary: Criar nova campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - about_project
   *               - what_we_need
   *               - content_type
   *               - content_pillars
   *               - benefits
   *               - requirements
   *               - submission_format
   *               - content_format
   *               - content_categories
   *               - target_blockchain
   *               - official_links
   *               - support_contact
   *               - country
   *               - start_date
   *               - end_date
   *               - payment_chain
   *               - payment_token
   *               - max_participants
   *               - winner_count
   *               - reward_tiers
   *               - total_prize_pool
   *             properties:
   *               title:
   *                 type: string
   *                 description: Título da campanha
   *               about_project:
   *                 type: string
   *                 description: Sobre o projeto
   *               what_we_need:
   *                 type: string
   *                 description: O que precisamos
   *               content_type:
   *                 type: string
   *                 description: Tipo de conteúdo
   *               content_pillars:
   *                 type: string
   *                 description: Pilares de conteúdo
   *               benefits:
   *                 type: string
   *                 description: Benefícios
   *               requirements:
   *                 type: string
   *                 description: Requisitos para participação
   *               submission_format:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [twitter, tiktok, instagram, youtube, feedback]
   *                       description: Plataforma de submissão
   *                 description: Formatos de submissão aceitos
   *               content_format:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [video, thread, post, meme, article, feedback, other]
   *                       description: Formato do conteúdo
   *                 description: Formatos de conteúdo aceitos
   *               content_categories:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     slug:
   *                       type: string
   *                 description: Categorias de conteúdo (máximo 1)
   *               target_blockchain:
   *                 type: string
   *                 description: Blockchain alvo
   *               official_links:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     url:
   *                       type: string
   *                     type:
   *                       type: string
   *                       enum: [website, twitter, discord, telegram, docs, github, youtube, other]
   *               support_contact:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [email, discord, telegram, twitter, github, youtube, other]
   *                     value:
   *                       type: string
   *                     is_primary:
   *                       type: boolean
   *               country:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     name:
   *                       type: string
   *               payment_chain:
   *                 type: string
   *                 description: Blockchain para pagamento
   *               payment_token:
   *                 type: string
   *                 description: Token para pagamento
   *               reward_tiers:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     position_initial:
   *                       type: number
   *                     position_final:
   *                       type: number
   *                     title:
   *                       type: string
   *                     payment_amount:
   *                       type: number
   *               total_prize_pool:
   *                 type: number
   *                 description: Pool total de prêmios
   *               links_officials:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Lista de links oficiais
   *               list_kols:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - userId
   *                   properties:
   *                     userId:
   *                       type: string
   *                       description: ID do usuário KOL (CREATOR)
   *                     amount:
   *                       type: number
   *                       description: |
   *                         Valor que o KOL vai ganhar (obrigatório quando is_cac é false, opcional quando is_cac é true).
   *                         Quando is_cac é true, o valor será calculado dinamicamente baseado em quantity_convertion * amount_convertion
   *                 description: Lista de KOLs com seus respectivos valores de recompensa
   *               qtd_min_links:
   *                 type: number
   *                 description: Quantidade mínima de links
   *               qtd_max_links:
   *                 type: number
   *                 description: Quantidade máxima de links
   *               is_cac:
   *                 type: boolean
   *                 description: Indica se a campanha usa modelo CAC (Cost per Acquisition). Quando true, o pagamento é calculado baseado em conversões
   *               format_cac:
   *                 type: string
   *                 enum: [clicks, view]
   *                 description: Formato do CAC (clicks ou view)
   *               quantity_conversion:
   *                 type: number
   *                 description: Quantidade para converter por valor
   *               amount_convertion:
   *                 type: number
   *                 description: Valor pago por conversão (obrigatório quando is_cac é true)
   *               limit_amount_convertion:
   *                 type: number
   *                 description: Limite máximo de valor por conversão (opcional)
   *               max_participants:
   *                 type: number
   *                 description: Número máximo de participantes
   *               winner_count:
   *                 type: number
   *                 description: Número de vencedores
   *               start_date:
   *                 type: string
   *                 format: date-time
   *                 description: Data de início
   *               end_date:
   *                 type: string
   *                 format: date-time
   *                 description: Data de fim
   *     responses:
   *       201:
   *         description: Campanha criada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaign:
   *                   type: object
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   */
  public createCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const campaignData: CreateCampaignDto = req.body;
      const campaign = await this.hostService.createCampaign(hostId, campaignData);

      res.status(201).json({
        message: 'Campaign created successfully',
        campaign
      });
    } catch (error: any) {
      if (error.message.includes('not active')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      res.status(400).json({
        message: 'Error creating campaign',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}:
   *   put:
   *     summary: Editar campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *                 description: Título da campanha
   *               about_project:
   *                 type: string
   *                 description: Sobre o projeto
   *               what_we_need:
   *                 type: string
   *                 description: O que precisamos
   *               content_type:
   *                 type: string
   *                 description: Tipo de conteúdo
   *               content_pillars:
   *                 type: string
   *                 description: Pilares de conteúdo
   *               benefits:
   *                 type: string
   *                 description: Benefícios
   *               requirements:
   *                 type: string
   *                 description: Requisitos para participação
   *               submission_format:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [twitter, tiktok, instagram, youtube, feedback]
   *                       description: Plataforma de submissão
   *                 description: Formatos de submissão aceitos
   *               content_format:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [video, thread, post, meme, article, feedback, other]
   *                       description: Formato do conteúdo
   *                 description: Formatos de conteúdo aceitos
   *               content_categories:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     slug:
   *                       type: string
   *                 description: Categorias de conteúdo
   *               target_blockchain:
   *                 type: string
   *                 description: Blockchain alvo
   *               official_links:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     url:
   *                       type: string
   *                     type:
   *                       type: string
   *                       enum: [website, twitter, discord, telegram, docs, github, youtube, other]
   *               support_contact:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [email, discord, telegram, twitter, github, youtube, other]
   *                     value:
   *                       type: string
   *                     is_primary:
   *                       type: boolean
   *               country:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     name:
   *                       type: string
   *               payment_chain:
   *                 type: string
   *                 description: Blockchain para pagamento
   *               payment_token:
   *                 type: string
   *                 description: Token para pagamento
   *               reward_tiers:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     position_initial:
   *                       type: number
   *                     position_final:
   *                       type: number
   *                     title:
   *                       type: string
   *                     payment_amount:
   *                       type: number
   *               total_prize_pool:
   *                 type: number
   *                 description: Pool total de prêmios
   *               links_officials:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Lista de links oficiais
   *               list_kols:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - userId
   *                   properties:
   *                     userId:
   *                       type: string
   *                       description: ID do usuário KOL (CREATOR)
   *                     amount:
   *                       type: number
   *                       description: |
   *                         Valor que o KOL vai ganhar (obrigatório quando is_cac é false, opcional quando is_cac é true).
   *                         Quando is_cac é true, o valor será calculado dinamicamente baseado em quantity_convertion * amount_convertion
   *                 description: Lista de KOLs com seus respectivos valores de recompensa
   *               qtd_min_links:
   *                 type: number
   *                 description: Quantidade mínima de links
   *               qtd_max_links:
   *                 type: number
   *                 description: Quantidade máxima de links
   *               is_cac:
   *                 type: boolean
   *                 description: Indica se a campanha usa modelo CAC (Cost per Acquisition). Quando true, o pagamento é calculado baseado em conversões
   *               format_cac:
   *                 type: string
   *                 enum: [clicks, view]
   *                 description: Formato do CAC (clicks ou view)
   *               quantity_conversion:
   *                 type: number
   *                 description: Quantidade para converter por valor
   *               amount_convertion:
   *                 type: number
   *                 description: Valor pago por conversão (obrigatório quando is_cac é true)
   *               limit_amount_convertion:
   *                 type: number
   *                 description: Limite máximo de valor por conversão (opcional)
   *               max_participants:
   *                 type: number
   *                 description: Número máximo de participantes
   *               winner_count:
   *                 type: number
   *                 description: Número de vencedores
   *               start_date:
   *                 type: string
   *                 format: date-time
   *                 description: Data de início
   *               end_date:
   *                 type: string
   *                 format: date-time
   *                 description: Data de fim
   *     responses:
   *       200:
   *         description: Campanha atualizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaign:
   *                   type: object
   *       404:
   *         description: Campanha não encontrada
   *       403:
   *         description: Sem permissão para editar
   *       401:
   *         description: Token de autenticação inválido
   */
  public editCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;
      const updateData: UpdateCampaignDto = req.body;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const campaign = await this.hostService.updateCampaign(id, hostId, updateData);

      if (!campaign) {
        res.status(404).json({
          message: 'Campaign not found'
        });
        return;
      }

      res.status(200).json({
        message: 'Campaign updated successfully',
        campaign
      });
    } catch (error: any) {
      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error updating campaign',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}:
   *   delete:
   *     summary: Deletar campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Campanha deletada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       404:
   *         description: Campanha não encontrada
   *       403:
   *         description: Sem permissão para deletar
   *       401:
   *         description: Token de autenticação inválido
   */
  public deleteCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const deleted = await this.hostService.deleteCampaign(id, hostId);

      if (!deleted) {
        res.status(404).json({
          message: 'Campaign not found'
        });
        return;
      }

      res.status(200).json({
        message: 'Campaign deleted successfully'
      });
    } catch (error: any) {
      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error deleting campaign',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/toggle-status:
   *   patch:
   *     summary: Alternar status da campanha entre active e inactive
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Status da campanha alterado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaign:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     title:
   *                       type: string
   *                     status:
   *                       type: string
   *                       enum: [active, inactive]
   *       404:
   *         description: Campanha não encontrada
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Sem permissão para alterar esta campanha
   */
  public toggleCampaignStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.hostService.toggleCampaignStatus(id, hostId);

      if (!result) {
        res.status(404).json({
          message: 'Campaign not found'
        });
        return;
      }

      res.status(200).json({
        message: 'Campaign status changed successfully',
        campaign: {
          id: result.id,
          title: result.title,
          status: result.status
        }
      });
    } catch (error: any) {
      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error changing campaign status',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/leaderboard-submits:
   *   get:
   *     summary: Obter leaderboard de submissões de uma campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Limite de itens por página
   *     responses:
   *       200:
   *         description: Leaderboard de submissões obtido com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 leaderboard:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       ordem:
   *                         type: number
   *                         description: Posição no ranking (incremento)
   *                       user_id:
   *                         type: string
   *                         description: ID do usuário que fez a submissão
   *                       username:
   *                         type: string
   *                         description: Nome de usuário
   *                       submission:
   *                         type: string
   *                         description: Conteúdo da submissão
   *                       amount_received:
   *                         type: number
   *                         description: Valor recebido pelo participante
   *                       winner:
   *                         type: boolean
   *                         description: Se o participante é vencedor da campanha
   *                       signature:
   *                         type: string
   *                         nullable: true
   *                         description: Assinatura do pagamento em payments_winners (apenas quando campanha é privada)
   *                       date_submit:
   *                         type: string
   *                         format: date-time
   *                         description: Data da submissão
   *                 total:
   *                   type: number
   *                   description: Total de participantes
   *                 page:
   *                   type: number
   *                   description: Página atual
   *                 limit:
   *                   type: number
   *                   description: Limite de itens por página
   *                 totalPages:
   *                   type: number
   *                   description: Total de páginas
   *                 chain:
   *                   type: string
   *                   description: Chain de pagamento da campanha
   *       400:
   *         description: ID da campanha é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Sem permissão para visualizar este leaderboard
   *       404:
   *         description: Campanha não encontrada
   */
  public getLeaderboardSubmits = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const leaderboard  = await this.hostService.getLeaderboardSubmits(id, hostId, page, limit);

      res.status(200).json({
        message: 'Leaderboard retrieved successfully',
        ...leaderboard 
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching leaderboard',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/get-users-campaign-winners:
   *   get:
   *     summary: Obter usuários vencedores de uma campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Usuários vencedores obtidos com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 winners:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       username:
   *                         type: string
   *                         description: Nome de usuário
   *                       amount_received:
   *                         type: number
   *                         description: Valor recebido pelo vencedor
   *                       submission:
   *                         type: string
   *                         description: Conteúdo da submissão
   *       400:
   *         description: ID da campanha é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Sem permissão para visualizar os vencedores desta campanha
   *       404:
   *         description: Campanha não encontrada
   */
  public getUsersCampaignWinners = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.hostService.getUsersCampaignWinners(id, hostId);

      res.status(200).json({
        message: 'Campaign winners retrieved successfully',
        ...result
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching campaign winners',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/get-campaign-tiers:
   *   get:
   *     summary: Obter tiers de recompensa e pool total de prêmios de uma campanha (Público)
   *     tags: [Host]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Tiers de recompensa obtidos com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 reward_tiers:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       position_initial:
   *                         type: number
   *                       position_final:
   *                         type: number
   *                       title:
   *                         type: string
   *                       payment_amount:
   *                         type: number
   *                 total_prize_pool:
   *                   type: number
   *                   description: Pool total de prêmios
   *       400:
   *         description: ID da campanha é obrigatório
   *       404:
   *         description: Campanha não encontrada
   */
  public getCampaignTiers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const result = await this.hostService.getCampaignTiers(id);

      res.status(200).json({
        message: 'Campaign tiers retrieved successfully',
        ...result
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching campaign tiers',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/create-campaign-winners:
   *   post:
   *     summary: Criar vencedores de uma campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               winners:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     user_id:
   *                       type: string
   *                       description: ID do usuário vencedor
   *                     rank:
   *                       type: number
   *                       description: Posição/rank do vencedor
   *                 description: Lista de vencedores com seus ranks
   *     responses:
   *       200:
   *         description: Vencedores criados com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 winners:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       user_id:
   *                         type: string
   *                       username:
   *                         type: string
   *                       rank:
   *                         type: number
   *                       amount_received:
   *                         type: number
   *                       date_received:
   *                         type: string
   *                         format: date-time
   *       400:
   *         description: Dados inválidos ou participante não encontrado
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Sem permissão para criar vencedores desta campanha
   *       404:
   *         description: Campanha não encontrada
   */
  public createCampaignWinners = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;
      const winnersData: CreateCampaignWinnersDto[] = req.body.winners;

      if (!id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!winnersData || !Array.isArray(winnersData) || winnersData.length === 0) {
        res.status(400).json({
          message: 'Winners data is required and must be a non-empty array'
        });
        return;
      }

      // Validar dados dos vencedores
      for (const winner of winnersData) {
        if (!winner.user_id || !winner.rank) {
          res.status(400).json({
            message: 'Each winner must have user_id and rank'
          });
          return;
        }
      }

      const result = await this.hostService.createCampaignWinners(id, hostId, winnersData);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('not found in this campaign') || 
          error.message.includes('No reward tier found') ||
          error.message.includes('must be a non-empty array') ||
          error.message.includes('must have user_id and rank')) {
        res.status(400).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error creating campaign winners',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/profile:
   *   get:
   *     summary: Obter perfil completo do host
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Perfil do host obtido com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 username:
   *                   type: string
   *                 user_type:
   *                   type: string
   *                   enum: [HOST]
   *                 email:
   *                   type: string
   *                 email_verified:
   *                   type: boolean
   *                 isActive:
   *                   type: boolean
   *                 campaigns_created:
   *                   type: number
   *                 totalCampanhasCriadas:
   *                   type: number
   *                   description: Total de campanhas criadas
   *                 totalDistribuido:
   *                   type: number
   *                   description: Total distribuído em campanhas finalizadas
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *                 discord_id:
   *                   type: string
   *                 google_id:
   *                   type: string
   *                 twitter_id:
   *                   type: string
   *                 twitter_username:
   *                   type: string
   *                 twitter_display_name:
   *                   type: string
   *                 twitter_profile_image:
   *                   type: string
   *                 twitter_verified:
   *                   type: boolean
   *                 twitter_followers_count:
   *                   type: number
   *                 total_earnings:
   *                   type: number
   *                 position_company:
   *                   type: string
   *                 telegram_username:
   *                   type: string
   *                 name_company:
   *                   type: string
   *                 website_company:
   *                   type: string
   *                 social_media:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       type:
   *                         type: string
   *                       url:
   *                         type: string
   *                 introduction_company:
   *                   type: string
   *                 logo_company:
   *                   type: string
   *                 categories_atuation:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       slug:
   *                         type: string
   *                 registerCompleted:
   *                   type: boolean
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo HOST
   *       404:
   *         description: Usuário não encontrado
   */
  public getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const profile = await this.hostService.getProfile(hostId);

      res.status(200).json(profile);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('HOST')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching profile',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/update-profile:
   *   put:
   *     summary: Atualizar perfil do host
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               twitter_username:
   *                 type: string
   *               twitter_profile_image:
   *                 type: string
   *               position_company:
   *                 type: string
   *               telegram_username:
   *                 type: string
   *               name_company:
   *                 type: string
   *               website_company:
   *                 type: string
   *               social_media:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                     url:
   *                       type: string
   *               introduction_company:
   *                 type: string
   *               logo_company:
   *                 type: string
   *                 description: Base64 da imagem
   *               categories_atuation:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     slug:
   *                       type: string
   *     responses:
   *       200:
   *         description: Perfil atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 username:
   *                   type: string
   *                 user_type:
   *                   type: string
   *                   enum: [HOST]
   *                 email:
   *                   type: string
   *                 email_verified:
   *                   type: boolean
   *                 isActive:
   *                   type: boolean
   *                 campaigns_created:
   *                   type: number
   *                 totalDistribuido:
   *                   type: number
   *                   description: Total distribuído em campanhas finalizadas
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *                 discord_id:
   *                   type: string
   *                 twitter_username:
   *                   type: string
   *                 twitter_profile_image:
   *                   type: string
   *                 position_company:
   *                   type: string
   *                 telegram_username:
   *                   type: string
   *                 name_company:
   *                   type: string
   *                 website_company:
   *                   type: string
   *                 social_media:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       type:
   *                         type: string
   *                       url:
   *                         type: string
   *                 introduction_company:
   *                   type: string
   *                 logo_company:
   *                   type: string
   *                 categories_atuation:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       slug:
   *                         type: string
   *                 registerCompleted:
   *                   type: boolean
   *       400:
   *         description: Dados inválidos ou logo em formato inválido
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo HOST
   *       404:
   *         description: Usuário não encontrado
   */
  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;
      const updateData: UpdateProfileDto = req.body;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const updatedProfile = await this.hostService.updateProfile(hostId, updateData);

      res.status(200).json(updatedProfile);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('HOST')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('base64') || error.message.includes('Error updating')) {
        res.status(400).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error updating profile',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/get-count-campaigns-by-host:
   *   get:
   *     summary: Obter contagem de campanhas do host
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Contagem de campanhas obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 campaigns_progress:
   *                   type: number
   *                   description: Número de campanhas em progresso (active)
   *                 campaigns_completed:
   *                   type: number
   *                   description: Número de campanhas completadas
   *                 total_user_submiteds:
   *                   type: number
   *                   description: Total de usuários que submeteram em todas as campanhas do host
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo HOST
   *       404:
   *         description: Usuário não encontrado
   */
  public getCountCampaignsByHost = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const countData = await this.hostService.getCountCampaignsByHost(hostId);

      res.status(200).json({
        message: 'Campaign count retrieved successfully',
        ...countData
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('HOST')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching campaign count',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/generate-rank-twitter:
   *   get:
   *     summary: Gerar ranking do Twitter para uma campanha
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Ranking gerado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 ranking:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       rank:
   *                         type: number
   *                       username:
   *                         type: string
   *                       amount_received:
   *                         type: number
   *                       submission_twitter:
   *                         type: string
   *                       user_id:
   *                         type: string
   *                       campaign_id:
   *                         type: string
   *       404:
   *         description: Campanha não encontrada
   *       403:
   *         description: Sem permissão para acessar esta campanha
   *       401:
   *         description: Token de autenticação inválido
   */
  public generateMindshare = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;
      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const campaignId = req.params['id'];
      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const ranking = await this.hostService.generateMindshare(campaignId, hostId);

      res.status(200).json({
        message: 'Ranking generated successfully',
        ranking
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error generating ranking',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/get-info-post-twitter-creator/{id}:
   *   get:
   *     summary: Obter informações agregadas de posts do Twitter de um criador
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *       - in: query
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID do usuário criador
   *     responses:
   *       200:
   *         description: Informações de posts do Twitter obtidas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 views_twitter:
   *                   type: number
   *                   description: Total de visualizações
   *                 replies_twitter:
   *                   type: number
   *                   description: Total de respostas
   *                 retweets_twitter:
   *                   type: number
   *                   description: Total de retweets
   *                 quotes_twitter:
   *                   type: number
   *                   description: Total de citações
   *                 bookmarks_twitter:
   *                   type: number
   *                   description: Total de bookmarks
   *                 likes_twitter:
   *                   type: number
   *                   description: Total de curtidas
   *                 submission_twitter:
   *                   type: string
   *                   description: Link do post do Twitter
   *                 submission_feedback:
   *                   type: string
   *                   description: Link do feedback
   *       400:
   *         description: user_id é obrigatório
   *       500:
   *         description: Erro ao buscar informações
   */
  public getInfoPostTwitterCreator = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { user_id } = req.query;

      if (!user_id) {
        res.status(400).json({
          message: 'user_id is required'
        });
        return;
      }

      const result = await this.hostService.getInfoPostTwitterCreator(
        user_id as string,
        id
      );

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching Twitter post info',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/active-account:
   *   get:
   *     summary: Recuperar flag active_account_host
   *     description: Retorna o status da flag active_account_host do host autenticado
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Flag active_account_host recuperada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 active_account_host:
   *                   type: boolean
   *                   description: Status da conta ativa do host
   *                   example: true
   *       401:
   *         description: Token de autenticação inválido
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User not authenticated"
   *       403:
   *         description: Usuário não é do tipo HOST
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Only HOST users can access this information"
   *       404:
   *         description: Usuário não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User not found"
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Error fetching active account host status"
   *                 error:
   *                   type: string
   */
  public HostActiveAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.hostService.getActiveAccountHost(hostId);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('HOST')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching active account host status',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/resend-verification-code:
   *   post:
   *     summary: Reenviar código de verificação de e-mail
   *     description: Gera e envia um novo código de verificação de 6 dígitos (letras + números) para o e-mail do host
   *     tags: [Host]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 description: E-mail do host
   *                 example: "host@example.com"
   *     responses:
   *       200:
   *         description: Código de verificação enviado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Verification code sent successfully"
   *       400:
   *         description: E-mail já verificado ou e-mail não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       403:
   *         description: Usuário não é do tipo HOST
   *       404:
   *         description: Usuário não encontrado
   *       500:
   *         description: Erro ao enviar código de verificação
   */
  public resendVerificationCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          message: 'Email is required'
        });
        return;
      }

      const result = await this.hostService.resendVerificationCode(email);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('HOST') || error.message.includes('Only HOST')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('already verified') || error.message.includes('email not found')) {
        res.status(400).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error sending verification code',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/validate-email-code:
   *   post:
   *     summary: Validar código de verificação de e-mail
   *     description: Valida o código de verificação de 6 dígitos e atualiza a flag email_verified para true se válido
   *     tags: [Host]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - code
   *             properties:
   *               email:
   *                 type: string
   *                 description: E-mail do host
   *                 example: "host@example.com"
   *               code:
   *                 type: string
   *                 description: Código de verificação de 6 dígitos (letras + números)
   *                 example: "A1B2C3"
   *     responses:
   *       200:
   *         description: E-mail verificado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Email verified successfully"
   *                 email_verified:
   *                   type: boolean
   *                   example: true
   *       400:
   *         description: Código inválido ou expirado, ou e-mail já verificado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       403:
   *         description: Usuário não é do tipo HOST
   *       404:
   *         description: Usuário não encontrado
   *       500:
   *         description: Erro ao validar código
   */
  public validateEmailCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, code } = req.body;

      if (!email) {
        res.status(400).json({
          message: 'Email is required'
        });
        return;
      }

      if (!code) {
        res.status(400).json({
          message: 'Verification code is required'
        });
        return;
      }

      const result = await this.hostService.validateEmailCode(email, code);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('HOST') || error.message.includes('Only HOST')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('already verified')) {
        res.status(400).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error validating email code',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/fixed-comment-host:
   *   put:
   *     summary: Atualizar status is_fixed de um comentário
   *     description: Permite ao host marcar ou desmarcar um comentário como fixado
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - commentId
   *               - is_fixed
   *             properties:
   *               commentId:
   *                 type: string
   *                 description: ID do comentário
   *                 example: "507f1f77bcf86cd799439011"
   *               is_fixed:
   *                 type: boolean
   *                 description: Status de fixação do comentário
   *                 example: true
   *     responses:
   *       200:
   *         description: Status do comentário atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Comment fixed status updated successfully"
   *       400:
   *         description: Dados inválidos (commentId ou is_fixed não fornecidos)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       401:
   *         description: Token de autenticação inválido
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User not authenticated"
   *       403:
   *         description: Sem permissão para atualizar este comentário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       404:
   *         description: Comentário ou campanha não encontrada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 error:
   *                   type: string
   */
  public fixedCommentHost = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;
      const { commentId, is_fixed } = req.body;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!commentId || typeof is_fixed !== 'boolean') {
        res.status(400).json({
          message: 'commentId and is_fixed (boolean) are required'
        });
        return;
      }

      const result = await this.hostService.fixedCommentHost(commentId, hostId, is_fixed);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('permission')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error updating comment fixed status',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/get-kols:
   *   get:
   *     summary: Obter todos os KOLs (usuários do tipo CREATOR) com paginação
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: username
   *         required: false
   *         schema:
   *           type: string
   *         description: Filtro para buscar KOLs por username (busca parcial, case-insensitive)
   *       - in: query
   *         name: page
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número da página
   *       - in: query
   *         name: limit
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Número de itens por página
   *     responses:
   *       200:
   *         description: Lista de KOLs obtida com sucesso (ordenada alfabeticamente)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 kols:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       username:
   *                         type: string
   *                       twitter_profile_image:
   *                         type: string
   *                         nullable: true
   *                         description: URL da imagem de perfil do Twitter
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *       401:
   *         description: Token de autenticação inválido
   */
  public getKols = async (req: Request, res: Response): Promise<void> => {
    try {
      const usernameFilter = req.query['username'] as string | undefined;
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;

      const result = await this.hostService.getKols(usernameFilter, page, limit);

      res.status(200).json({
        message: 'KOLs retrieved successfully',
        kols: result.kols,
        pagination: result.pagination,
        total: result.pagination.total
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching KOLs',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/is-parabuilders:
   *   get:
   *     summary: Verificar se o host é da Parabuilders
   *     description: Retorna true se o host autenticado é da Parabuilders
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Verificação realizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 isParabuilders:
   *                   type: boolean
   *                   description: true se o host é da Parabuilders, false caso contrário
   *       401:
   *         description: Token de autenticação inválido
   */
  public isParabuilders = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const isParabuilders = await this.hostService.isParabuildersHost(hostId);

      res.status(200).json({
        isParabuilders
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Error checking Parabuilders status',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/host/campaigns/{id}/metrics:
   *   get:
   *     summary: Recuperar métricas detalhadas da campanha com dados por creator (Host)
   *     tags: [Host]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
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
   *                 total_bookmarks:
   *                   type: number
   *                   description: Total de bookmarks na campanha
   *                 post_kols:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       username:
   *                         type: string
   *                       total_submissions:
   *                         type: number
   *                       total_likes:
   *                         type: number
   *                       total_views:
   *                         type: number
   *                       total_replies:
   *                         type: number
   *                       total_retweets:
   *                         type: number
   *                       total_bookmarks:
   *                         type: number
   *                       submissions:
   *                         type: array
   *                         items:
   *                           type: string
   *                   description: Lista de creators com métricas individuais
   *       400:
   *         description: Campaign ID é obrigatório
   *       403:
   *         description: Sem permissão para ver esta campanha
   *       404:
   *         description: Campanha não encontrada
   *       401:
   *         description: Token de autenticação inválido
   */
  public getCampaignMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      if (!id) {
        res.status(400).json({ message: 'Campaign ID is required' });
        return;
      }

      const metrics = await this.hostService.getCampaignMetrics(id, hostId);
      res.status(200).json(metrics);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message.includes('permission')) {
        res.status(403).json({ message: error.message });
        return;
      }
      res.status(500).json({
        message: 'Error retrieving campaign metrics',
        error: error.message
      });
    }
  };

  public getCampaignMetricsSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!id) {
        res.status(400).json({ message: "Campaign ID is required" });
        return;
      }

      const metrics = await this.hostService.getCampaignMetricsSummary(id, hostId);
      res.status(200).json(metrics);
    } catch (error: any) {
      if (error.message.includes("not found")) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message.includes("permission")) {
        res.status(403).json({ message: error.message });
        return;
      }

      res.status(500).json({
        message: "Error retrieving campaign metrics summary",
        error: error.message,
      });
    }
  };

  public getCampaignMetricsPlatforms = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const hostId = (req as any).user?.userId;

      if (!hostId) {
        res.status(401).json({ message: "User not authenticated" });
        return;
      }

      if (!id) {
        res.status(400).json({ message: "Campaign ID is required" });
        return;
      }

      const metrics = await this.hostService.getCampaignMetricsPlatforms(id, hostId);
      res.status(200).json(metrics);
    } catch (error: any) {
      if (error.message.includes("not found")) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message.includes("permission")) {
        res.status(403).json({ message: error.message });
        return;
      }

      res.status(500).json({
        message: "Error retrieving campaign metrics by platforms",
        error: error.message,
      });
    }
  };
}
