import { Request, Response } from 'express';
import { CreatorService } from '../services/CreatorService';
import { CreateCommentDto, UpdateCommentDto } from '../dtos/comment.dto';

export class CreatorController {
  private creatorService: CreatorService;

  constructor() {
    this.creatorService = new CreatorService();
  }

  /**
   * @swagger
   * /api/creator/validate-submission-campaign/{campaignId}:
   *   get:
   *     summary: Verifica se o usuário já submeteu para a campanha
   *     tags: [Creator]
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
   *         description: true se já possui submissão, false caso contrário
   *         content:
   *           application/json:
   *             schema:
   *               type: boolean
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   */
  public validateSubmissionCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const hasSubmission = await this.creatorService.hasCampaignSubmission(userId, campaignId);
      res.status(200).json(hasSubmission);
    } catch (error: any) {
      if (error.message.includes('CREATOR')) {
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
        message: 'Error validating submission',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/get-submission/:campaignId:
   *   get:
   *     summary: Buscar submissão do creator em uma campanha específica
   *     tags: [Creator]
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
   *         description: Submissão encontrada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 userId:
   *                   type: string
   *                 campaignId:
   *                   type: string
   *                 date_submit:
   *                   type: string
   *                   format: date-time
   *                 amount_received:
   *                   type: number
   *                 submission_twitter:
   *                   type: string
   *                 submission_tiktok:
   *                   type: string
   *                 submission_instagram:
   *                   type: string
   *                 submission_youtube:
   *                   type: string
   *                 submissions_kols:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Array de links para campanhas privadas
   *                 winner:
   *                   type: boolean
   *       404:
   *         description: Submissão não encontrada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Submission not found"
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   */
  public getCampaignSubmission = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const submission = await this.creatorService.getCampaignSubmission(userId, campaignId);
      
      if (!submission) {
        res.status(404).json({
          message: 'Submission not found'
        });
        return;
      }

      res.status(200).json(submission);
    } catch (error: any) {
      if (error.message.includes('CREATOR')) {
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
        message: 'Error fetching submission',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/submit-campaign/{campaign_id}:
   *   post:
   *     summary: Inscrever-se em uma campanha
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaign_id
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
   *             required:
   *               - submission_twitter
   *             properties:
   *               submission_twitter:
   *                 type: string
   *                 description: Submissão no Twitter
   *               submission_tiktok:
   *                 type: string
   *                 description: Submissão no TikTok
   *                 default: ""
   *               submission_instagram:
   *                 type: string
   *                 description: Submissão no Instagram
   *                 default: ""
   *               submission_youtube:
   *                 type: string
   *                 description: Submissão no YouTube
   *                 default: ""
   *               submission_feedback:
   *                 type: string
   *                 description: Submissão de feedback
   *                 default: ""
   *               submissions_kols:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Lista de IDs de KOLs (opcional)
   *                 default: []
   *     responses:
   *       201:
   *         description: Inscrição realizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Campaign submission successful"
   *                 participant:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     userId:
   *                       type: string
   *                     campaignId:
   *                       type: string
   *                     date_submit:
   *                       type: string
   *                       format: date-time
   *                     amount_received:
   *                       type: number
   *                     date_received:
   *                       type: string
   *                       format: date-time
   *                       nullable: true
   *                     submission_twitter:
   *                       type: string
   *                       description: Submissão no Twitter
   *                     submission_tiktok:
   *                       type: string
   *                       description: Submissão no TikTok
   *                     submission_instagram:
   *                       type: string
   *                       description: Submissão no Instagram
   *                     submission_youtube:
   *                       type: string
   *                       description: Submissão no YouTube
   *                     submission_feedback:
   *                       type: string
   *                       description: Submissão de feedback
   *                     submissions_kols:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Lista de links para campanhas privadas (KOL)
   *                     submissions_images:
   *                       type: array
   *                       items:
   *                         type: string
   *                       description: Lista de imagens em Base64 (ex. "data:image/png;base64,iVBOR...")
   *       200:
   *         description: Erro - Carteira não configurada para a blockchain da campanha
   *         content:
   *           application/json:
   *             schema:
   *               oneOf:
   *                 - type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "error_solana"
   *                     wallet_sol:
   *                       type: string
   *                       description: Endereço da carteira SOL (vazio se não configurada)
   *                       example: ""
   *                 - type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "error_sui"
   *                     wallet_sui:
   *                       type: string
   *                       description: Endereço da carteira SUI (vazio se não configurada)
   *                       example: ""
   *                 - type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: "error_evm"
   *                     wallet_evm:
   *                       type: string
   *                       description: Endereço da carteira EVM (vazio se não configurada)
   *                       example: ""
   *       400:
   *         description: Dados inválidos (campaign_id ausente)
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Apenas usuários CREATOR podem se inscrever em campanhas
   *       404:
   *         description: Usuário ou campanha não encontrados
   *       409:
   *         description: Usuário já está inscrito nesta campanha
   *       500:
   *         description: Erro interno do servidor
   */
  public submitCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaign_id } = req.params;
      const { submission_twitter, submission_tiktok, submission_instagram, submission_youtube, submission_feedback, submissions_kols, submissions_images } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaign_id) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const result = await this.creatorService.submitCampaign(userId, campaign_id, submission_twitter, submission_tiktok, submission_instagram, submission_youtube || '', submission_feedback || '', submissions_kols, submissions_images);

      if (!result.success) {
        if(result.chain === 'solana') {
          res.status(200).json({
            message: 'error_solana',
            wallet_sol: result.wallet_sol
          });
        } else if (result.chain === 'sui') {
          res.status(200).json({
            message: 'error_sui',
            wallet_sui: result.wallet_sui
          });
        } else if (result.chain === 'stellar') {
          res.status(200).json({
            message: 'error_stellar',
            wallet_stellar: result.wallet_stellar
          });
        } else  {
          res.status(200).json({
            message: 'error_evm',
            wallet_evm: result.wallet_evm
          });
        }
        
        return;
      }

      res.status(201).json({
        message: 'Campaign submission successful',
        participant: result.data
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('already enrolled')) {
        res.status(409).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error submitting to campaign',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/campaigns-submitted:
   *   get:
   *     summary: Buscar campanhas submetidas pelo usuário
   *     tags: [Creator]
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
   *         description: Limite de itens por página
   *     responses:
   *       200:
   *         description: Lista de campanhas submetidas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 campaigns:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       campaignId:
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
   *                       content_categories:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             slug:
   *                               type: string
   *                             description:
   *                               type: string
   *                       total_submissions:
   *                         type: number
   *                         description: Total de submissões na campanha
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   */
  public getSubmittedCampaigns = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;
      const type = (req.query['type'] as string) || undefined;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.creatorService.getSubmittedCampaigns(userId, page, limit, type);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching submitted campaigns',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/insert-wallets:
   *   post:
   *     summary: Adicionar wallets ao usuário
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               wallet_evm:
   *                 type: string
   *                 description: Endereço da wallet EVM (Ethereum, Polygon, BSC, etc.)
   *                 example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
   *               wallet_sol:
   *                 type: string
   *                 description: Endereço da wallet Solana
   *                 example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
   *               wallet_sui:
   *                 type: string
   *                 description: Endereço da wallet Sui
   *                 example: "0x1234567890abcdef1234567890abcdef12345678"
   *     responses:
   *       200:
   *         description: Wallets adicionadas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Wallets added successfully"
   *                 wallet_evm:
   *                   type: string
   *                   example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
   *                 wallet_sol:
   *                   type: string
   *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
   *                 wallet_sui:
   *                   type: string
   *                   example: "0x1234567890abcdef1234567890abcdef12345678"
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   */
  public insertWallets = async (req: Request, res: Response): Promise<void> => {
    try {
      const { wallet_evm, wallet_sol, wallet_sui, wallet_stellar } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const result = await this.creatorService.insertWallets(userId, wallet_evm, wallet_sol, wallet_sui, wallet_stellar);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('cannot change')) {
        res.status(400).json({
          message: error.message,
          error: 'WALLET_CHANGE_BLOCKED'
        });
        return;
      }

      console.error('[insert-wallets] Error:', error.message, error.stack);
      res.status(500).json({
        message: 'Error adding wallets',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/delete-wallet/{walletType}:
   *   delete:
   *     summary: Remover wallet do usuário
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: walletType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [evm, sol, sui]
   *         description: Tipo da wallet a ser removida (evm, sol ou sui)
   *         example: "evm"
   *     responses:
   *       200:
   *         description: Wallet removida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Wallet removed successfully"
   *                 wallet_evm:
   *                   type: string
   *                   example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
   *                 wallet_sol:
   *                   type: string
   *                   example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
   *                 wallet_sui:
   *                   type: string
   *                   example: "0x1234567890abcdef1234567890abcdef12345678"
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   */
  public deleteWallet = async (req: Request, res: Response): Promise<void> => {
    try {
      const { walletType } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!walletType || !['evm', 'sol', 'sui', 'stellar'].includes(walletType)) {
        res.status(400).json({
          message: 'Valid wallet type (evm, sol, sui or stellar) is required'
        });
        return;
      }

      const result = await this.creatorService.deleteWallet(userId, walletType as 'evm' | 'sol' | 'sui' | 'stellar');

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error removing wallet',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/comments/{campaignId}:
   *   get:
   *     summary: Buscar comentários de uma campanha
   *     description: Endpoint público que não requer autenticação. Se um token válido for fornecido, o campo userIsEditOrDelete será true para comentários do usuário autenticado.
   *     tags: [Creator]
   *     security: []
   *     parameters:
   *       - in: path
   *         name: campaignId
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
   *       - in: header
   *         name: Authorization
   *         schema:
   *           type: string
   *         required: false
   *         description: Token de autenticação (opcional). Se fornecido, permite identificar se o usuário pode editar/deletar seus próprios comentários.
   *     responses:
   *       200:
   *         description: Lista de comentários obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 comments:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       userId:
   *                         type: string
   *                       campaignId:
   *                         type: string
   *                       comment:
   *                         type: string
   *                       create_date:
   *                         type: string
   *                         format: date-time
   *                       twitter_profile_image:
   *                         type: string
   *                       username:
   *                         type: string
   *                       userIsEditOrDelete:
   *                         type: boolean
   *                         description: true se o usuário autenticado é o autor do comentário, false caso contrário (ou se não houver token)
   *                       created_at:
   *                         type: string
   *                         format: date-time
   *                       updated_at:
   *                         type: string
   *                         format: date-time
   *                 total:
   *                   type: number
   *                 page:
   *                   type: number
   *                 limit:
   *                   type: number
   *                 totalPages:
   *                   type: number
   *       400:
   *         description: Campaign ID é obrigatório
   */
  public getComments = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const userId = (req as any).user?.userId;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 10;

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const result = await this.creatorService.getComments(campaignId, userId, page, limit);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching comments',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/comments:
   *   post:
   *     summary: Inserir comentário em uma campanha
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - campaignId
   *               - comment
   *             properties:
   *               campaignId:
   *                 type: string
   *                 description: ID da campanha
   *               comment:
   *                 type: string
   *                 description: Conteúdo do comentário
   *     responses:
   *       201:
   *         description: Comentário inserido com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 userId:
   *                   type: string
   *                 campaignId:
   *                   type: string
   *                 comment:
   *                   type: string
   *                 create_date:
   *                   type: string
   *                   format: date-time
   *                 twitter_profile_image:
   *                   type: string
   *                 username:
   *                   type: string
   *                 userIsEditOrDelete:
   *                   type: boolean
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   *       404:
   *         description: Campanha não encontrada
   */
  public insertComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId, comment } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaignId || !comment) {
        res.status(400).json({
          message: 'Campaign ID and comment are required'
        });
        return;
      }

      const commentData: CreateCommentDto = { campaignId, comment };
      const result = await this.creatorService.insertComment(userId, commentData);

      res.status(201).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error inserting comment',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/comments/{id}:
   *   put:
   *     summary: Atualizar comentário
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID do comentário
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - comment
   *             properties:
   *               comment:
   *                 type: string
   *                 description: Novo conteúdo do comentário
   *     responses:
   *       200:
   *         description: Comentário atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 userId:
   *                   type: string
   *                 campaignId:
   *                   type: string
   *                 comment:
   *                   type: string
   *                 create_date:
   *                   type: string
   *                   format: date-time
   *                 twitter_profile_image:
   *                   type: string
   *                 username:
   *                   type: string
   *                 userIsEditOrDelete:
   *                   type: boolean
   *                 created_at:
   *                   type: string
   *                   format: date-time
   *                 updated_at:
   *                   type: string
   *                   format: date-time
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Sem permissão para editar este comentário
   *       404:
   *         description: Comentário não encontrado
   */
  public updateComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!id || !comment) {
        res.status(400).json({
          message: 'Comment ID and comment content are required'
        });
        return;
      }

      const updateData: UpdateCommentDto = { comment };
      const result = await this.creatorService.updateComment(id, userId, updateData);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('only edit your own')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error updating comment',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/comments/{id}:
   *   delete:
   *     summary: Deletar comentário
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID do comentário
   *     responses:
   *       200:
   *         description: Comentário deletado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Sem permissão para deletar este comentário
   *       404:
   *         description: Comentário não encontrado
   */
  public deleteComment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          message: 'Comment ID is required'
        });
        return;
      }

      const result = await this.creatorService.deleteComment(id, userId);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('only delete your own')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error deleting comment',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/profile:
   *   get:
   *     summary: Obter perfil completo do creator
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Perfil do creator obtido com sucesso
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
   *                   enum: [CREATOR]
   *                 email:
   *                   type: string
   *                 isActive:
   *                   type: boolean
   *                 submittedCampaignsCount:
   *                   type: number
   *                   description: Quantidade de campanhas submetidas pelo creator
   *                 quantity_winner:
   *                   type: number
   *                   description: Quantidade de campanhas que o creator venceu
   *                 quantity_winner_dolar:
   *                   type: number
   *                   description: Valor total recebido em vitórias (em dólares)
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
   *                 telegram_username:
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
   *                 wallets:
   *                   type: array
   *                   items:
   *                     type: string
   *                 registerCompleted:
   *                   type: boolean
   *                 description:
   *                   type: string
   *                   description: Descrição do perfil do creator
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   *       404:
   *         description: Usuário não encontrado
   */
  public getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = (req as any).user?.userId;

      if (!creatorId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const profile = await this.creatorService.getProfile(creatorId);

      res.status(200).json(profile);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
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
   * /api/creator/campaign-winners/{campaignId}:
   *   get:
   *     summary: Buscar vencedores de uma campanha ordenados por rank
   *     tags: [Creator]
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
   *         description: Lista de vencedores ordenados por rank
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   rank:
   *                     type: number
   *                     description: Posição do vencedor
   *                   username:
   *                     type: string
   *                     description: Nome de usuário do vencedor
   *                   amount_received:
   *                     type: number
   *                     description: Valor recebido pelo vencedor
   *       400:
   *         description: Campaign ID é obrigatório
   *       404:
   *         description: Campanha não encontrada
   */
  public getCampaignWinners = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const winners = await this.creatorService.getCampaignWinners(campaignId);

      res.status(200).json(winners);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
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
   * /api/creator/update-description-profile:
   *   put:
   *     summary: Atualizar descrição do perfil do creator
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - description
   *             properties:
   *               description:
   *                 type: string
   *                 description: Nova descrição do perfil
   *     responses:
   *       200:
   *         description: Descrição atualizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Description updated successfully"
   *                 description:
   *                   type: string
   *       400:
   *         description: Dados inválidos
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   *       404:
   *         description: Usuário não encontrado
   */
  public updateDescriptionProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { description } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (description === undefined || description === null) {
        res.status(400).json({
          message: 'Description is required'
        });
        return;
      }

      const result = await this.creatorService.updateDescriptionProfile(userId, description);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error updating description',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/update-profile-after-login:
   *   put:
   *     summary: Atualizar perfil do creator após login (dados pós-primeiro acesso)
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username_youtube:
   *                 type: string
   *               username_tiktok:
   *                 type: string
   *               username_instagram:
   *                 type: string
   *               username_telegram:
   *                 type: string
   *               username_discord:
   *                 type: string
   *               primary_language:
   *                 type: string
   *                 description: ISO code or legacy (e.g. en, english)
   *               fluent_language:
   *                 type: string
   *                 description: Comma-separated ISO codes (e.g. en,pt,es)
   *               fluent_language_others:
   *                 type: string
   *               audience_region:
   *                 type: array
   *                 items:
   *                   type: string
   *               average_views_per_post:
   *                 type: string
   *               content_category_list:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [technology, travel, finance, crypto_blockchain, web3, gaming, lifestyle, education, defi, trading, business, nfts]
   *               content_formats:
   *                 type: array
   *                 items:
   *                   type: string
   *               example_content_links:
   *                 type: string
   *               audience_size:
   *                 type: string
   *                 enum: ['1k', '1k – 5k', '5k – 20k', '20k – 100k', '100k+']
   *               wallet_evm:
   *                 type: string
   *               wallet_sol:
   *                 type: string
   *               wallet_sui:
   *                 type: string
   *               crypto_experience:
   *                 type: string
   *               trading_experience:
   *                 type: string
   *               main_chains:
   *                 type: array
   *                 items:
   *                   type: string
   *               main_chains_other:
   *                 type: string
   *               crypto_content_specialization:
   *                 type: array
   *                 items:
   *                   type: string
   *               favorite_protocols_projects:
   *                 type: string
   *               investment_participation_style:
   *                 type: string
   *     responses:
   *       200:
   *         description: Perfil atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *       400:
   *         description: Nenhum campo para atualizar
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   *       404:
   *         description: Usuário não encontrado
   */
  public updateProfileAfterLogin = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const data = req.body;
      const result = await this.creatorService.updateProfileAfterLogin(userId, data);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message.includes('CREATOR')) {
        res.status(403).json({ message: error.message });
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
   * /api/creator/update-profile:
   *   put:
   *     summary: Atualizar perfil do creator (não altera first_login)
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               description:
   *                 type: string
   *               username_youtube:
   *                 type: string
   *               username_tiktok:
   *                 type: string
   *               username_instagram:
   *                 type: string
   *               username_telegram:
   *                 type: string
   *               username_discord:
   *                 type: string
   *               primary_language:
   *                 type: string
   *               fluent_language:
   *                 type: string
   *               fluent_language_others:
   *                 type: string
   *               audience_region:
   *                 type: array
   *                 items:
   *                   type: string
   *               average_views_per_post:
   *                 type: string
   *               content_category_list:
   *                 type: array
   *                 items:
   *                   type: string
   *                   enum: [technology, travel, finance, crypto_blockchain, web3, gaming, lifestyle, education, defi, trading, business, nfts]
   *               content_formats:
   *                 type: array
   *                 items:
   *                   type: string
   *               example_content_links:
   *                 type: string
   *               audience_size:
   *                 type: string
   *                 enum: ['1k', '1k – 5k', '5k – 20k', '20k – 100k', '100k+']
   *               wallet_evm:
   *                 type: string
   *               wallet_sol:
   *                 type: string
   *               wallet_sui:
   *                 type: string
   *               crypto_experience:
   *                 type: string
   *               trading_experience:
   *                 type: string
   *               main_chains:
   *                 type: array
   *                 items:
   *                   type: string
   *               main_chains_other:
   *                 type: string
   *               crypto_content_specialization:
   *                 type: array
   *                 items:
   *                   type: string
   *               favorite_protocols_projects:
   *                 type: string
   *               investment_participation_style:
   *                 type: string
   *     responses:
   *       200:
   *         description: Perfil atualizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *       400:
   *         description: Nenhum campo para atualizar
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   *       404:
   *         description: Usuário não encontrado
   */
  public updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const data = req.body;
      const result = await this.creatorService.updateProfile(userId, data);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message.includes('CREATOR')) {
        res.status(403).json({ message: error.message });
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
   * /api/creator/view-transactions-creator:
   *   get:
   *     summary: Visualizar transações do criador
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Transações obtidas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 transactions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       signature:
   *                         type: string
   *                         description: Assinatura da transação
   *                       payment_chain:
   *                         type: string
   *                         description: Chain de pagamento
   *                       name_campaign:
   *                         type: string
   *                         description: Nome da campanha
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   */
  public viewTransactionsCreator = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const transactions = await this.creatorService.getViewTransactionsCreator(userId);

      res.status(200).json({
        message: 'Transactions retrieved successfully',
        transactions
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching transactions',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/get-recent-earners:
   *   get:
   *     summary: Buscar ganhadores recentes
   *     description: Endpoint público que retorna os criadores que mais ganharam recentemente
   *     tags: [Creator]
   *     security: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Limite de resultados a retornar
   *     responses:
   *       200:
   *         description: Lista de ganhadores recentes
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   twitter_profile_image:
   *                     type: string
   *                     description: Imagem de perfil do Twitter
   *                   username:
   *                     type: string
   *                     description: Nome de usuário
   *                   description:
   *                     type: string
   *                     description: Descrição do perfil
   *                   amount_earned:
   *                     type: number
   *                     description: Soma total dos ganhos em campanhas
   *       500:
   *         description: Erro interno do servidor
   */
  public getRecentEarners = async (req: Request, res: Response): Promise<void> => {
    try {
      const earners = await this.creatorService.getRecentEarners(10);

      res.status(200).json(earners);
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching recent earners',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/welcome:
   *   get:
   *     summary: Obter username e imagem do Twitter do creator
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Informações do Twitter obtidas com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 twitter_username:
   *                   type: string
   *                   description: Username do Twitter
   *                 twitter_profile_image:
   *                   type: string
   *                   description: URL da imagem de perfil do Twitter
   *       401:
   *         description: Token de autenticação inválido
   *       403:
   *         description: Usuário não é do tipo CREATOR
   *       404:
   *         description: Usuário não encontrado
   */
  public getTwitterInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = (req as any).user?.userId;

      if (!creatorId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      const twitterInfo = await this.creatorService.getTwitterInfo(creatorId);

      res.status(200).json(twitterInfo);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      if (error.message.includes('CREATOR')) {
        res.status(403).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching Twitter info',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/create-short-url/{campaignId}:
   *   post:
   *     summary: Cria uma URL encurtada
   *     tags: [Creator]
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
   *         description: URL encurtada criada com sucesso
   *       400:
   *         description: Campaign ID é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       500:
   *         description: Erro ao criar URL encurtada
   */
  public createShortUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaignId) {
        res.status(400).json({
          success: false,
          message: 'Campaign ID is required'
        });
        return;
      }

      const shortUrl = await this.creatorService.createShortUrl(campaignId, userId);

      res.status(200).json({
        success: true,
        data: shortUrl
      });
    } catch (error: any) {
      console.error('Error creating short URL:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error creating short URL'
      });
    }
  };

  /**
   * @swagger
   * /api/creator/get-shortener-user-campaign/{campaignId}:
   *   get:
   *     summary: Obter shortURL de uma campanha
   *     tags: [Creator]
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
   *         description: ShortURL obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 shortURL:
   *                   type: string
   *                   description: URL encurtada da campanha
   *       400:
   *         description: Campaign ID é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       404:
   *         description: Short URL não encontrada para esta campanha e usuário
   *       500:
   *         description: Erro ao obter shortURL
   */
  public getShortenerUserCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const result = await this.creatorService.getShortenerUserCampaign(campaignId, userId);

      res.status(200).json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          message: error.message
        });
        return;
      }

      res.status(500).json({
        message: 'Error fetching short URL',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/campaign-short-urls/{campaignId}:
   *   get:
   *     summary: Obter dados de URLs encurtadas de uma campanha
   *     tags: [Creator]
   *     parameters:
   *       - in: path
   *         name: campaignId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *     responses:
   *       200:
   *         description: Dados obtidos com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       username:
   *                         type: string
   *                       campaignTitle:
   *                         type: string
   *                       shortURL:
   *                         type: string
   *                       clicks:
   *                         type: number
   *       400:
   *         description: Campaign ID é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       404:
   *         description: Campanha não encontrada
   *       500:
   *         description: Erro ao obter dados
   */
  public getCampaignShortUrls = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;

      if (!campaignId) {
        res.status(400).json({
          success: false,
          message: 'Campaign ID is required'
        });
        return;
      }

      const data = await this.creatorService.getCampaignShortUrls(campaignId);

      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
        return;
      }

      console.error('Error getting campaign short URLs:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error getting campaign short URLs'
      });
    }
  };

  /**
   * @swagger
   * /api/creator/get-shortener-kols/{campaignId}:
   *   get:
   *     summary: Obter shortURL do KOL (gerada por create-shortener-kols)
   *     tags: [Creator]
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
   *         description: ShortURL do KOL obtida com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 shortURL:
   *                   type: string
   *                   description: URL encurtada do KOL
   *       400:
   *         description: Campaign ID é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       500:
   *         description: Erro ao obter shortURL do KOL
   */
  public getShortenerKols = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          message: 'User not authenticated'
        });
        return;
      }

      if (!campaignId) {
        res.status(400).json({
          message: 'Campaign ID is required'
        });
        return;
      }

      const result = await this.creatorService.getShortenerKols(campaignId, userId);

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({
        message: 'Error fetching short URL for KOL',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/creator/create-shortener-kols/{campaignId}:
   *   post:
   *     summary: Cria uma URL encurtada para KOLs usando linkReferral
   *     tags: [Creator]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaignId
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
   *             required:
   *               - linkReferral
   *             properties:
   *               linkReferral:
   *                 type: string
   *                 description: Link de referral a ser encurtado
   *     responses:
   *       200:
   *         description: URL encurtada criada com sucesso
   *       400:
   *         description: linkReferral é obrigatório
   *       401:
   *         description: Token de autenticação inválido
   *       500:
   *         description: Erro ao criar URL encurtada
   */
  public createShortenerKols = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaignId } = req.params;
      const { linkReferral } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!linkReferral) {
        res.status(400).json({
          success: false,
          message: 'linkReferral is required'
        });
        return;
      }

      if (!campaignId) {
        res.status(400).json({
          success: false,
          message: 'Campaign ID is required'
        });
        return;
      }

      const shortUrl = await this.creatorService.createShortenerKols(linkReferral, userId, campaignId);

      res.status(200).json({
        success: true,
        data: shortUrl
      });
    } catch (error: any) {
      console.error('Error creating short URL for KOLs:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error creating short URL'
      });
    }
  };

}
