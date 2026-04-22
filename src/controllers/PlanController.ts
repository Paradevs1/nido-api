import { Request, Response } from 'express';
import { PlanService } from '../services/PlanService';

export class PlanController {
  private planService: PlanService;

  constructor() {
    this.planService = new PlanService();
  }

  /**
   * @swagger
   * /api/plans:
   *   get:
   *     summary: Listar todos os planos disponíveis
   *     tags: [Plans]
   *     description: "Retorna a lista de planos cadastrados (ex.: BASIC, CORE e ENTERPRISE) com suas durações."
   *     responses:
   *       200:
   *         description: Lista de planos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Planos recuperados com sucesso"
   *                 plans:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                         example: "507f1f77bcf86cd799439011"
   *                       name:
   *                         type: string
   *                         enum: [BASIC, CORE, ENTERPRISE]
   *                         example: "CORE"
   *                       duration_months:
   *                         type: number
   *                         nullable: true
   *                         example: 3
   *       500:
   *         description: Erro ao recuperar planos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Erro ao recuperar planos"
   *                 error:
   *                   type: string
   */
  public listPlans = async (req: Request, res: Response): Promise<void> => {
    try {
      const plans = await this.planService.listPlans();
      res.status(200).json({
        message: 'Plans retrieved successfully',
        plans
      });
    } catch (error: any) {
      res.status(500).json({
        message: 'Error retrieving plans',
        error: error.message
      });
    }
  };

  /**
   * @swagger
   * /api/plans/me:
   *   get:
   *     summary: Recuperar o plano atual do host autenticado
   *     tags: [Plans]
   *     security:
   *       - bearerAuth: []
   *     description: "Retorna o plano do host baseado no `plan_id` do usuário e na collection `plans` (e `duration_plan` para validade do CORE)."
   *     responses:
   *       200:
   *         description: Plano do host
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Plano do host recuperado com sucesso"
   *                 plan:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       example: "507f1f77bcf86cd799439011"
   *                     name:
   *                       type: string
   *                       enum: [BASIC, CORE, ENTERPRISE]
   *                       example: "BASIC"
   *                     duration_months:
   *                       type: number
   *                       nullable: true
   *                       example: null
   *                 is_active:
   *                   type: boolean
   *                   description: Para CORE, indica se ainda está dentro da validade. Para BASIC, sempre true.
   *                   example: true
   *                 expires_at:
   *                   type: string
   *                   nullable: true
   *                   format: date-time
   *                   example: "2026-05-17T12:00:00.000Z"
   *       401:
   *         description: Não autenticado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User not authenticated"
   *       403:
   *         description: Usuário não é HOST
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       404:
   *         description: Usuário não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *       400:
   *         description: Erro ao recuperar plano
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   */
  public getMyPlan = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ message: 'User not authenticated' });
        return;
      }

      const planInfo = await this.planService.getHostPlan(userId);
      res.status(200).json({
        message: 'Host plan retrieved successfully',
        ...planInfo
      });
    } catch (error: any) {
      const status =
        error.message.includes('not found') ? 404 :
        error.message.includes('Only HOST') ? 403 :
        400;

      res.status(status).json({
        message: error.message
      });
    }
  };
}

