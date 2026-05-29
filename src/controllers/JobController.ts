import { Request, Response } from 'express';
import { JobService } from '../services/JobService';

export class JobController {
  private jobService: JobService;

  constructor() {
    this.jobService = new JobService();
  }

  /**
   * @swagger
   * /api/jobs/run-expired-campaigns:
   *   post:
   *     summary: Executar job de verificação de campanhas expiradas manualmente
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 updatedCount:
   *                   type: number
   *                   description: Número de campanhas atualizadas
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   *   get:
   *     summary: Executar job de verificação de campanhas expiradas (GET)
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 updatedCount:
   *                   type: number
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   */
  public runExpiredCampaignsJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runExpiredCampaignsJob();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        updatedCount: 0,
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`
      });
    }
  };

  /**
   * @swagger
   * /api/jobs/run-get-info-post-x:
   *   post:
   *     summary: Executar job de busca de informações de posts do Twitter manualmente
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 processedCount:
   *                   type: number
   *                   description: Número de participantes processados
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   *   get:
   *     summary: Executar job de busca de informações de posts do Twitter (GET)
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *       500:
   *         description: Erro ao executar job
   */
  public runGetInfoPostX = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runGetInfoPostX();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        processedCount: 0,
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`
      });
    }
  };

  /**
   * @swagger
   * /api/jobs/run-get-clicks:
   *   post:
   *     summary: Executar job de atualização de cliques das URLs encurtadas manualmente
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 updatedCount:
   *                   type: number
   *                   description: Número de URLs atualizadas
   *                 totalUrls:
   *                   type: number
   *                   description: Total de URLs na base
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   *   get:
   *     summary: Executar job de atualização de cliques (GET)
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *       500:
   *         description: Erro ao executar job
   */
  public runGetClicksJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runGetClicksJob();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        updatedCount: 0,
        totalUrls: 0,
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`
      });
    }
  };

  /**
   * @swagger
   * /api/jobs/run-update-twitter-followers:
   *   post:
   *     summary: Executar job de atualização de seguidores do Twitter manualmente
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 updatedCount:
   *                   type: number
   *                   description: Número de creators atualizados
   *                 processedCount:
   *                   type: number
   *                   description: Número de creators processados
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   *   get:
   *     summary: Executar job de atualização de seguidores do Twitter (GET)
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *       500:
   *         description: Erro ao executar job
   */
  public runUpdateTwitterFollowersJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runUpdateTwitterFollowersJob();

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        updatedCount: 0,
        processedCount: 0,
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`
      });
    }
  };

  /**
   * @swagger
   * /api/jobs/run-auto-pay-waiting-payment:
   *   post:
   *     summary: Pagamento automático de campanhas em "waiting payment" (updated_at >= 7 dias, públicas)
   *     description: |
   *       Processa campanhas por submission_format - Twitter (rank automático), Feedback (rank por pontos),
   *       Instagram/Tiktok/YouTube (rank por date_submit). Com vencedores (winner=true) paga manual; sem vencedores usa rank automático.
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 processedCount:
   *                   type: number
   *                   description: Número de campanhas processadas
   *                 paidCampaigns:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: IDs das campanhas pagas
   *                 errors:
   *                   type: array
   *                   items:
   *                     type: string
   *                   description: Mensagens de erro por campanha
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   *   get:
   *     summary: Executar job de pagamento automático (GET)
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *       500:
   *         description: Erro ao executar job
   */
  /**
   * @swagger
   * /api/jobs/run-get-metrics-submissions:
   *   post:
   *     summary: Executar job de coleta de métricas de Instagram, TikTok e YouTube via Apify
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
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
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                 message:
   *                   type: string
   *       500:
   *         description: Erro ao executar job
   *   get:
   *     summary: Executar job de coleta de métricas (GET)
   *     tags: [Jobs]
   *     responses:
   *       200:
   *         description: Job executado com sucesso
   *       500:
   *         description: Erro ao executar job
   */
  public runGetMetricsSubmissions = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runGetMetricsSubmissions();
      res.status(result.success ? 200 : 500).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        instagram: { processed: 0, updated: 0 },
        tiktok: { processed: 0, updated: 0 },
        youtube: { processed: 0, updated: 0 },
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`,
      });
    }
  };

  public runCleanupInactiveHosts = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runCleanupInactiveHosts();
      res.status(result.success ? 200 : 500).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        deletedCount: 0,
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`
      });
    }
  };

  public runAutoPayWaitingPaymentCampaignsJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runAutoPayWaitingPaymentCampaignsJob();
      res.status(result.success ? 200 : 500).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        processedCount: 0,
        paidCampaigns: [],
        errors: [error.message || String(error)],
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`
      });
    }
  };

  public runExpiredStellarEscrows = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runExpiredStellarEscrowsJob();
      res.status(result.success ? 200 : 500).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        processed: 0,
        failed: 0,
        results: [],
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`,
      });
    }
  };

  public runPendingInboundMints = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.jobService.runPendingInboundMintsJob();
      res.status(result.success ? 200 : 500).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        processed: 0,
        failed: 0,
        results: [],
        timestamp: new Date(),
        message: `Job execution error: ${error.message}`,
      });
    }
  };
}

