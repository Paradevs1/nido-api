import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { RegisterData } from '../dtos';
import authenticateWithPrivy, { authenticateWithPrivyWithoutToken } from '../config/twitter';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * @swagger
   * /api/auth/register-host:
   *   post:
   *     summary: Registrar um novo host
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - email
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 description: Nome de usuário único
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Email do usuário
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 description: Senha do usuário
   *     responses:
   *       201:
   *         description: Usuário criado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *                 token:
   *                   type: string
   *       400:
   *         description: Dados inválidos ou usuário já existe
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
  public registerHost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password } = req.body;

      // Validação básica
      if (!username || !email || !password) {
        res.status(400).json({
          message: 'Username, email and password are required',
          error: 'MISSING_FIELDS'
        });
        return;
      }

      const registerData: RegisterData = {
        username,
        email,
        password,
        user_type: 'HOST'
      };

      const result = await this.authService.registerHost(registerData);

      res.status(201).json({
        message: 'User created successfully',
        user: result.user,
        token: result.token
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message || 'Error creating user',
        error: 'REGISTRATION_ERROR'
      });
    }
  };

  /**
   * @swagger
   * /api/auth/login-host:
   *   post:
   *     summary: Fazer login como host
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Email do usuário
   *               password:
   *                 type: string
   *                 description: Senha do usuário
   *     responses:
   *       200:
   *         description: Login realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *                 token:
   *                   type: string
   *       401:
   *         description: Credenciais inválidas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 error:
   *                   type: string
   *       403:
   *         description: Email not verified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Email not verified. Please verify your email before logging in"
   *                 error:
   *                   type: string
   *                   example: "EMAIL_NOT_VERIFIED"
   */
  public loginHost = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Validação básica
      if (!email || !password) {
        res.status(400).json({
          message: 'Email and password are required',
          error: 'MISSING_CREDENTIALS'
        });
        return;
      }

      const result = await this.authService.loginHost(email, password);

      res.status(200).json({
        message: 'Login successful',
        user: result.user,
        token: result.token
      });
    } catch (error: any) {
      if (error.message.includes('not verified') || error.message.includes('verify your email')) {
        res.status(403).json({
          message: error.message || 'Email not verified',
          error: 'EMAIL_NOT_VERIFIED'
        });
        return;
      }

      res.status(401).json({
        message: error.message || 'Invalid credentials',
        error: 'LOGIN_ERROR'
      });
    }
  };

  /**
   * @swagger
   * /api/auth/login-creator:
   *   post:
   *     summary: Fazer login como creator via Twitter/Privy
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user
   *               - loginMethod
   *             properties:
   *               user:
   *                 type: object
   *                 properties:
   *                   twitter:
   *                     type: object
   *                     properties:
   *                       subject:
   *                         type: string
   *                       username:
   *                         type: string
   *               loginMethod:
   *                 type: string
   *                 enum: [twitter]
   *                 description: Método de autenticação (apenas Twitter suportado)
   *     responses:
   *       200:
   *         description: Login realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *                 token:
   *                   type: string
   *                 isNewUser:
   *                   type: boolean
   *       400:
   *         description: Dados de autenticação inválidos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       401:
   *         description: Falha na autenticação
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
  public loginCreator = async (req: Request, res: Response): Promise<void> => {
    try {
      const privyData = req.body;

      if (!privyData.user || !privyData.loginMethod) {
        res.status(400).json({
            success: false,
            message: 'Invalid Privy authentication data'
        });
        return;
      }

      if (privyData.loginMethod !== 'twitter' && privyData.loginMethod !== 'google' && privyData.loginMethod !== 'tiktok' && privyData.loginMethod !== 'instagram') {
        res.status(400).json({
            success: false,
            message: 'Only Twitter, Google, Instagram and TikTok authentication are supported for creators'
        });
        return;
      }

      const result = await authenticateWithPrivy(privyData);
      if ((result.status === 200 || result.status === 201) && result.data) {
        if(result.message === "User not found in waitlist") {
          res.status(result.status).json({
            success: false,
            message: result.message
          });
        } else {
          res.status(result.status).json({
            success: true,
            message: result.message,
            user: result.data.user,
            token: result.data.token,
            isNewUser: result.data.isNewUser,
            first_login: result.data.user.first_login ?? null
          });
        }
      } else {
        res.status(result.status).json({
          message: result.message
        });
      }
    } catch (error: any) {
      res.status(401).json({
        message: error.message || 'Invalid credentials',
        error: 'LOGIN_ERROR'
      });
    }
  };

  /**
   * @swagger
   * /api/auth/link-accounts-creator:
   *   post:
   *     summary: Autenticar creator via Twitter/TikTok/Instagram sem gerar token
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - user
   *               - loginMethod
   *             properties:
   *               user:
   *                 type: object
   *                 properties:
   *                   twitter:
   *                     type: object
   *                     properties:
   *                       subject:
   *                         type: string
   *                       username:
   *                         type: string
   *                   tiktok:
   *                     type: object
   *                     properties:
   *                       subject:
   *                         type: string
   *                       username:
   *                         type: string
   *               loginMethod:
   *                 type: string
   *                 enum: [twitter, tiktok, instagram]
   *                 description: Método de autenticação
   *     responses:
   *       200:
   *         description: Autenticação realizada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *                 isNewUser:
   *                   type: boolean
   *       400:
   *         description: Dados de autenticação inválidos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       401:
   *         description: Falha na autenticação
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
  public linkAccountsCreator = async (req: Request, res: Response): Promise<void> => {
    try {
      const privyData = Array.isArray(req.body) ? req.body : (req.body.privyData || req.body);

      if (!privyData || !Array.isArray(privyData) || privyData.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid data: expected an array of linked accounts'
        });
        return;
      }

      const result = await authenticateWithPrivyWithoutToken(privyData);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Accounts linked successfully',
          updatedTwitter: result.updatedTwitter,
          updatedTiktok: result.updatedTiktok,
          updatedInstagram: result.updatedInstagram,
          updatedGoogle: result.updatedGoogle
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to link accounts'
        });
      }
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Failed to link accounts'
      });
    }
  };

  /**
   * @swagger
   * /api/auth/register-host-part-two/{user_id}:
   *   post:
   *     summary: Completar registro do host (parte 2)
   *     tags: [Authentication]
   *     parameters:
   *       - in: path
   *         name: user_id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID do usuário host
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - position_company
   *               - name_company
   *               - introduction_company
   *               - categories_atuation
   *             properties:
   *               username:
   *                 type: string
   *                 description: Nome de usuário
   *               position_company:
   *                 type: string
   *                 description: Cargo na empresa
   *               twitter_username:
   *                 type: string
   *                 description: Username do Twitter
   *               telegram_username:
   *                 type: string
   *                 description: Username do Telegram
   *               name_company:
   *                 type: string
   *                 description: Nome da empresa
   *               website_company:
   *                 type: string
   *                 description: Website da empresa
   *               social_media:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     type:
   *                       type: string
   *                       enum: [discord, github, youtube, other]
   *                     url:
   *                       type: string
   *                 description: Redes sociais da empresa
   *               introduction_company:
   *                 type: string
   *                 description: Introdução da empresa
   *               logo_company:
   *                 type: string
   *                 description: Base64 do logo da empresa
   *               categories_atuation:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     slug:
   *                       type: string
   *                 description: Categorias de atuação
   *     responses:
   *       200:
   *         description: Registro completado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 user:
   *                   type: object
   *                 token:
   *                   type: string
   *       400:
   *         description: Dados inválidos
   *       404:
   *         description: Usuário não encontrado
   *       403:
   *         description: Usuário não é do tipo HOST
   */
  public registerHostPartTwo = async (req: Request, res: Response): Promise<void> => {
    try {
      const { host_id } = req.params;
      const hostData = req.body;

      if (!host_id) {
        res.status(400).json({
          message: 'User ID is required'
        });
        return;
      }

      const result = await this.authService.registerHostPartTwo(host_id, hostData);

      res.status(200).json({
        success: result.success,
        message: 'Host registration completed successfully',
        user: result.user,
        token: result.token
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

      res.status(400).json({
        message: error.message || 'Error completing registration',
        error: 'REGISTER_ERROR'
      });
    }
  };

  /**
   * @swagger
   * /api/auth/user-exist:
   *   post:
   *     summary: Verificar se um usuário existe pelo twitter_id
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - twitter_id
   *             properties:
   *               twitter_id:
   *                 type: string
   *                 description: ID do Twitter do usuário
   *     responses:
   *       200:
   *         description: Resposta com true ou false indicando se o usuário existe
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 exists:
   *                   type: boolean
   *                   description: true se o usuário existe, false caso contrário
   *       400:
   *         description: twitter_id não fornecido
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
  public syncAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
      const currentUserId = (req as any).user?.userId;

      if (!currentUserId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { twitter_id, twitter_username } = req.body;

      if (!twitter_id) {
        res.status(400).json({
          success: false,
          message: 'twitter_id is required'
        });
        return;
      }

      const result = await this.authService.syncAccounts(currentUserId, twitter_id, twitter_username || '');

      res.status(200).json(result);
    } catch (error: any) {
      console.error('[SYNC-ACCOUNTS] Error:', error.message);
      res.status(500).json({
        success: false,
        message: error.message || 'Error syncing accounts'
      });
    }
  };

  public userExist = async (req: Request, res: Response): Promise<void> => {
    try {
      const { twitter_id } = req.body;

      if (!twitter_id) {
        res.status(400).json({
          message: 'twitter_id is required',
          error: 'MISSING_TWITTER_ID'
        });
        return;
      }

      const exists = await this.authService.userExistsByTwitterId(twitter_id);

      res.status(200).json({
        exists
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || 'Error checking user existence',
        error: 'CHECK_USER_ERROR'
      });
    }
  };
}
