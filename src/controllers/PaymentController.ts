import { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * @swagger
   * /api/payments/send-winners/{campaign_id}:
   *   post:
   *     summary: Send tokens to campaign winners (payment_chain and payment_token are retrieved from campaign)
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaign_id
   *         required: true
   *         schema:
   *           type: string
   *         description: Campaign ID (payment_chain and payment_token will be retrieved from campaign data)
   *         example: "campaign_123"
   *       - in: query
   *         name: acceptedRank
   *         required: false
   *         schema:
   *           type: boolean
   *         description: Accepted rank suggestion (optional - if provided, uses the rank suggestion instead of calculating manually)
   *         example: true
   *     responses:
   *       200:
   *         description: Tokens sent successfully to all campaign winners
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Token(s) sent successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     campaign_id:
   *                       type: string
   *                       example: "campaign_123"
   *                     totalWinners:
   *                       type: number
   *                       example: 3
   *                     transactions:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           userId:
   *                             type: string
   *                             example: "user_123"
   *                           to:
   *                             type: string
   *                             example: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
   *                           transactionHash:
   *                             type: string
   *                             example: "0x..."
   *                           amount:
   *                             type: number
   *                             example: 50.0
   *                           paymentId:
   *                             type: string
   *                             example: "507f1f77bcf86cd799439011"
   *       400:
   *         description: Validation error, campaign not found, or no winners found
   *       500:
   *         description: Internal server error
   */
  public sendTokenWinners = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaign_id } = req.params;
      const { acceptedRank } = req.query;

      if (!campaign_id) {
        res.status(400).json({
          success: false,
          error: 'Required parameter: campaign_id'
        });
        return;
      }

      const acceptedRankBoolean = acceptedRank === 'true' ? true : false;
      const results = await this.paymentService.sendTokenWinners(campaign_id, acceptedRankBoolean);

      res.status(200).json({
        success: true,
        message: 'Token(s) sent successfully',
        data: {
          campaign_id,
          totalWinners: results.length,
          transactions: results
        }
      });

    } catch (error: any) {
      console.error('Error in payment controller:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/evm/balance:
   *   get:
   *     summary: Verificar saldo de token EVM
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: chain
   *         required: true
   *         schema:
   *           type: string
   *         description: Rede blockchain (base, arbitrum, ethereum, berachain, bsc, hyperevm, polygon)
   *       - in: query
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *           enum: [USDT, USDC, USDCE, HONEY]
   *         description: Token a ser consultado
   *       - in: query
   *         name: address
   *         required: true
   *         schema:
   *           type: string
   *         description: Endereço da carteira
   *     responses:
   *       200:
   *         description: Saldo obtido com sucesso
   *       400:
   *         description: Invalid parameters
   *       500:
   *         description: Erro interno do servidor
   */
  public getBalanceEVM = async (req: Request, res: Response): Promise<void> => {
    try {
      const { chain, symbol, address } = req.query;

      if (!chain || !symbol || !address) {
        res.status(400).json({
          success: false,
          error: 'Required parameters: chain, symbol, address'
        });
        return;
      }

      if (!['USDT', 'USDC', 'USDCE', 'HONEY'].includes(symbol as string)) {
        res.status(400).json({
          success: false,
          error: 'Token must be USDT or USDC'
        });
        return;
      }

      const balance = await this.paymentService.getBalanceEVM(
        chain as string, 
        symbol as string, 
        address as string
      );

      res.status(200).json({
        success: true,
        data: {
          chain,
          symbol,
          address,
          balance
        }
      });

    } catch (error: any) {
      console.error('Error getting EVM balance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/solana/balance:
   *   get:
   *     summary: Verificar saldo de token Solana
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *           enum: [USDT, USDC]
   *         description: Token a ser consultado
   *       - in: query
   *         name: address
   *         required: true
   *         schema:
   *           type: string
   *         description: Endereço da carteira Solana
   *     responses:
   *       200:
   *         description: Saldo obtido com sucesso
   *       400:
   *         description: Invalid parameters
   *       500:
   *         description: Erro interno do servidor
   */
  public getBalanceSOL = async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol, address } = req.query;

      if (!symbol || !address) {
        res.status(400).json({
          success: false,
          error: 'Required parameters: symbol, address'
        });
        return;
      }

      if (!['USDT', 'USDC'].includes(symbol as string)) {
        res.status(400).json({
          success: false,
          error: 'Token must be USDT or USDC'
        });
        return;
      }

      const balance = await this.paymentService.getBalanceSOL(
        symbol as string, 
        address as string
      );

      res.status(200).json({
        success: true,
        data: {
          symbol,
          address,
          balance
        }
      });

    } catch (error: any) {
      console.error('Error getting Solana balance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/sui/balance:
   *   get:
   *     summary: Verificar saldo de token Sui
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *           enum: [USDT, USDC]
   *         description: Token a ser consultado
   *       - in: query
   *         name: address
   *         required: true
   *         schema:
   *           type: string
   *         description: Endereço da carteira Sui
   *     responses:
   *       200:
   *         description: Saldo obtido com sucesso
   *       400:
   *         description: Invalid parameters
   *       500:
   *         description: Erro interno do servidor
   */
  public getBalanceSUI = async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol, address } = req.query;

      if (!symbol || !address) {
        res.status(400).json({
          success: false,
          error: 'Required parameters: symbol, address'
        });
        return;
      }

      if (!['USDT', 'USDC'].includes(symbol as string)) {
        res.status(400).json({
          success: false,
          error: 'Token must be USDT or USDC'
        });
        return;
      }

      const balance = await this.paymentService.getBalanceSUI(
        symbol as string, 
        address as string
      );

      res.status(200).json({
        success: true,
        data: {
          symbol,
          address,
          balance
        }
      });

    } catch (error: any) {
      console.error('Error getting Sui balance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/stellar/balance:
   *   get:
   *     summary: Get Stellar token balance
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: symbol
   *         required: true
   *         schema:
   *           type: string
   *           enum: [USDC]
   *       - in: query
   *         name: address
   *         required: true
   *         schema:
   *           type: string
   *           example: "GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC"
   *     responses:
   *       200:
   *         description: Balance retrieved
   */
  public getBalanceStellar = async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol, address } = req.query;

      if (!symbol || !address) {
        res.status(400).json({
          success: false,
          error: 'Required parameters: symbol, address'
        });
        return;
      }

      if (!['USDC'].includes(symbol as string)) {
        res.status(400).json({
          success: false,
          error: 'Token must be USDC'
        });
        return;
      }

      const balance = await this.paymentService.getBalanceStellar(
        symbol as string,
        address as string
      );

      res.status(200).json({
        success: true,
        data: {
          symbol,
          address,
          balance
        }
      });

    } catch (error: any) {
      console.error('Error getting Stellar balance:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/payment-host-create:
   *   post:
   *     summary: Create payment host entry
   *     description: |
   *       Creates a new payment host entry with pending status.
   *       Returns payment details including destination address and token information.
   *       Requires authentication JWT.
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - walletAddress
   *               - campaignId
   *               - chain
   *               - symbol
   *             properties:
   *               walletAddress:
   *                 type: string
   *                 description: Host wallet address
   *                 example: "0x1234567890abcdef..."
   *               campaignId:
   *                 type: string
   *                 description: Campaign ID
   *                 example: "507f1f77bcf86cd799439011"
   *               chain:
   *                 type: string
   *                 enum: [base, arbitrum, ethereum, berachain, bsc, hyperevm, polygon, solana, sui, stellar]
   *                 description: Blockchain network
   *                 example: "ethereum"
   *               symbol:
   *                 type: string
   *                 enum: [USDT, USDC, USDCE, HONEY]
   *                 description: Token symbol
   *                 example: "USDT"
   *     responses:
   *       200:
   *         description: Payment host created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Payment host created successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     paymentId:
   *                       type: string
   *                       description: Payment host ID
   *                       example: "507f1f77bcf86cd799439012"
   *                     destinationAddress:
   *                       type: string
   *                       description: Destination wallet address
   *                       example: "0x0000000000000000000000000000000000000000"
   *                     token:
   *                       type: string
   *                       description: Token contract address
   *                       example: "0xdac17f958d2ee523a2206206994597c13d831ec7"
   *                     amount:
   *                       type: number
   *                       description: Amount to be paid
   *                       example: 51
   *       400:
   *         description: Invalid parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Required parameters: hostId, campaignId, walletAddress"
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Invalid access token"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
  public paymentHostCreate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { walletAddress, amount, chain, symbol, campaignId} = req.body;
      const hostId = (req as any).user?.userId;

      if (!hostId || !campaignId || !walletAddress) {
        res.status(400).json({
          success: false,
          error: 'Required parameters: hostId, campaignId, walletAddress'
        });
        return;
      }

      const result = await this.paymentService.paymentHostCreate(walletAddress, campaignId, hostId, chain, symbol);

        res.status(200).json({
        data: {
          paymentId: result.paymentId,
          destinationAddress: result.destinationAddress,
          amount: result.amount,
          chain: chain,
          token: result.token,
          message: result.message
        }
      });
    } catch (error: any) {
      console.error('Error creating payment host:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/payment-host-confirm:
   *   post:
   *     summary: Confirm payment host transaction
   *     description: |
   *       Validates a blockchain transaction and confirms the payment host entry.
   *       If the transaction is valid, updates the payment status to confirmed and activates the campaign.
   *       Requires authentication JWT.
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - paymentId
   *               - taxId
   *               - campaignId
   *               - chain
   *               - symbol
   *             properties:
   *               paymentId:
   *                 type: string
   *                 description: Payment host ID from create endpoint
   *                 example: "507f1f77bcf86cd799439012"
   *               taxId:
   *                 type: string
   *                 description: Transaction hash/ID for validation
   *                 example: "0x1234567890abcdef..."
   *               campaignId:
   *                 type: string
   *                 description: Campaign ID
   *                 example: "507f1f77bcf86cd799439011"
   *               chain:
   *                 type: string
   *                 enum: [base, arbitrum, ethereum, berachain, bsc, hyperevm, polygon, solana, sui, stellar]
   *                 description: Blockchain network
   *                 example: "ethereum"
   *               symbol:
   *                 type: string
   *                 enum: [USDT, USDC, USDCE, HONEY]
   *                 description: Token symbol
   *                 example: "USDT"
   *     responses:
   *       200:
   *         description: Payment confirmation processed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Payment host created successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     paymentId:
   *                       type: string
   *                       description: Payment host ID
   *                       example: "507f1f77bcf86cd799439012"
   *                     success:
   *                       type: boolean
   *                       description: Whether the transaction was valid
   *                       example: true
   *       400:
   *         description: Invalid parameters or transaction
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   examples:
   *                     missing_params:
   *                       value: "Required parameters: hostId, campaignId, taxId, paymentId, chain, symbol"
   *                     invalid_transaction:
   *                       value: "Invalid transaction: amount does not match expected value (51)"
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Invalid access token"
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
  public paymentHostConfirm = async (req: Request, res: Response): Promise<void> => {
    try {
      const { paymentId, taxId, campaignId, chain, symbol } = req.body;
      const hostId = (req as any).user?.userId;

      if (!hostId || !campaignId || !taxId || !paymentId) {
        res.status(400).json({
          success: false,
          error: 'Required parameters: hostId, campaignId, taxId, paymentId, chain, symbol'
        });
        return;
      }

      const result = await this.paymentService.paymentHostConfirm(paymentId, taxId, campaignId, chain, symbol, hostId);

      res.status(200).json({
        data: {
          paymentId: result.paymentId,
          success: result.isValidTransaction,
          message: result.message
        }
      });
    } catch (error: any) {
      console.error('Error confirming payment confirmation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };

  /**
   * @swagger
   * /api/payments/plan-create:
   *   post:
   *     summary: Gerar informações para pagamento do plano CORE via cripto
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - chain
   *               - symbol
   *             properties:
   *               chain:
   *                 type: string
   *                 enum: [base, arbitrum, ethereum, berachain, bsc, hyperevm, polygon, solana, sui, stellar]
   *               symbol:
   *                 type: string
   *                 enum: [USDT, USDC, USDCE, HONEY, USDE]
   *     responses:
   *       200:
   *         description: Informações retornadas
   */
  public paymentPlanCreate = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;
      const { chain, symbol } = req.body || {};

      if (!hostId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      if (!chain || !symbol) {
        res.status(400).json({ success: false, error: 'Required parameters: chain, symbol' });
        return;
      }

      const result = await this.paymentService.paymentPlanCreate(hostId, chain, symbol);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Internal server error' });
    }
  };

  /**
   * @swagger
   * /api/payments/plan-confirm:
   *   post:
   *     summary: Confirmar pagamento do plano CORE via cripto (valida on-chain e ativa o plano)
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - taxId
   *               - chain
   *               - symbol
   *             properties:
   *               taxId:
   *                 type: string
   *               chain:
   *                 type: string
   *                 enum: [base, arbitrum, ethereum, berachain, bsc, hyperevm, polygon, solana, sui, stellar]
   *               symbol:
   *                 type: string
   *                 enum: [USDT, USDC, USDCE, HONEY, USDE]
   *     responses:
   *       200:
   *         description: Plano ativado (ou erro de validação)
   */
  public paymentPlanConfirm = async (req: Request, res: Response): Promise<void> => {
    try {
      const hostId = (req as any).user?.userId;
      const { taxId, chain, symbol } = req.body || {};

      if (!hostId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      if (!taxId || !chain || !symbol) {
        res.status(400).json({ success: false, error: 'Required parameters: taxId, chain, symbol' });
        return;
      }

      const result = await this.paymentService.paymentPlanConfirm(hostId, taxId, chain, symbol);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Internal server error' });
    }
  };

  /**
   * @swagger
   * /api/payments/send-payment-kols-selective/{campaign_id}:
   *   post:
   *     summary: Pagamento seletivo de KOLs com devolução para o host
   *     description: |
   *       Envia tokens para os KOLs selecionados e devolve o valor dos não selecionados para o host.
   *       KOLs selecionados recebem o pagamento diretamente.
   *       KOLs não selecionados têm seus valores devolvidos para a wallet do host.
   *       Requer autenticação JWT.
   *     tags: [Payments]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: campaign_id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID da campanha
   *         example: "507f1f77bcf86cd799439011"
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - selectedKols
   *             properties:
   *               selectedKols:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - userId
   *                   properties:
   *                     userId:
   *                       type: string
   *                       description: ID do usuário KOL
   *                       example: "user_123"
   *                     quantity_convertion:
   *                       type: number
   *                       description: |
   *                         Quantidade de conversões (opcional para campanhas normais, obrigatório quando campaign.is_cac é true).
   *                         Quando campaign.is_cac é true, o valor pago será calculado como: quantity_convertion * campaign.amount_convertion
   *                       example: 10
   *                 description: Lista de KOLs selecionados para receber pagamento
   *                 example: [{"userId": "user_123", "quantity_convertion": 10}, {"userId": "user_456"}]
   *     responses:
   *       200:
   *         description: Payments and refunds processed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Payments and refunds processed successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     payments:
   *                       type: array
   *                       description: Lista de pagamentos enviados para KOLs selecionados
   *                       items:
   *                         type: object
   *                         properties:
   *                           paymentId:
   *                             type: string
   *                           signature:
   *                             type: string
   *                           to:
   *                             type: string
   *                           transactionHash:
   *                             type: string
   *                     refunds:
   *                       type: array
   *                       description: Lista de devoluções para o host (KOLs não selecionados)
   *                       items:
   *                         type: object
   *                         properties:
   *                           paymentId:
   *                             type: string
   *                           signature:
   *                             type: string
   *                           to:
   *                             type: string
   *                           transactionHash:
   *                             type: string
   *                           amount:
   *                             type: number
   *       400:
   *         description: Validation error, campaign not found or invalid parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   examples:
   *                     missing_campaign_id:
   *                       value: "Campaign ID is required"
   *                     missing_selected_kols:
   *                       value: "selectedKols is required and must be a non-empty array"
   *                     missing_quantity_convertion:
   *                       value: "quantity_convertion is required for KOL {userId} when campaign.is_cac is true"
   *                     campaign_not_found:
   *                       value: "Campaign not found"
   *                     no_kols_configured:
   *                       value: "Campaign does not have KOLs configured"
   *       500:
   *         description: Erro interno do servidor
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: false
   *                 error:
   *                   type: string
   *                   example: "Internal server error"
   */
  public paymentKolsSelective = async (req: Request, res: Response): Promise<void> => {
    try {
      const { campaign_id } = req.params;
      const { selectedKols } = req.body;

      if (!campaign_id) {
        res.status(400).json({
          success: false,
          error: 'Campaign ID is required'
        });
        return;
      }

      if (!selectedKols || !Array.isArray(selectedKols) || selectedKols.length === 0) {
        res.status(400).json({
          success: false,
          error: 'selectedKols is required and must be a non-empty array'
        });
        return;
      }

      const results = await this.paymentService.paymentKolsSelective(campaign_id, selectedKols);

      res.status(200).json({
        success: true,
        message: 'Payments and refunds processed successfully',
        data: results
      });
    } catch (error: any) {
      console.error('Error in selective KOL payment:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  };
}