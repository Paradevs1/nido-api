import { Request, Response } from 'express';
import { WaitlistService, WaitlistSubmissionData } from '../services/WaitlistService';

export class WaitlistController {
  private waitlistService: WaitlistService;

  constructor() {
    this.waitlistService = new WaitlistService();
  }

  /**
   * @swagger
   * /api/waitlist/submit:
   *   post:
   *     summary: Submit a new waitlist entry
   *     tags: [Waitlist]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - xHandle
   *               - role
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address
   *               xHandle:
   *                 type: string
   *                 description: User's X (Twitter) handle (with or without @)
   *               role:
   *                 type: string
   *                 enum: [creator, protocol]
   *                 description: User's role type
   *     responses:
   *       201:
   *         description: Waitlist entry created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 id:
   *                   type: string
   *       400:
   *         description: Invalid input data
   *       409:
   *         description: Email already exists in waitlist
   *       500:
   *         description: Internal server error
   */
  public submitWaitlist = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, xHandle, role }: WaitlistSubmissionData = req.body;

      if (!email || !xHandle || !role) {
        res.status(400).json({
          success: false,
          message: 'Email, X handle, and role are required'
        });
        return;
      }

      const waitlistEntry = await this.waitlistService.createWaitlistEntry({
        email,
        xHandle,
        role
      });

      res.status(201).json({
        success: true,
        message: 'Successfully added to waitlist',
        id: waitlistEntry._id?.toString()
      });
    } catch (error) {
      console.error('Waitlist submission error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('already exists') || error.message.includes('already on the waitlist')) {
          res.status(409).json({
            success: false,
            message: 'This email is already on the waitlist'
          });
          return;
        }

        if (error.message.includes('Invalid') || error.message.includes('required')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to submit waitlist entry. Please try again.'
      });
    }
  };

  /**
   * @swagger
   * /api/waitlist:
   *   get:
   *     summary: Get waitlist entries (Admin only)
   *     tags: [Waitlist]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *           enum: [creator, protocol]
   *         description: Filter by role
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Items per page
   *     responses:
   *       200:
   *         description: Waitlist entries retrieved successfully
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  public getWaitlistEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const { role } = req.query;
      const page = parseInt(req.query['page'] as string) || 1;
      const limit = parseInt(req.query['limit'] as string) || 50;

      const filters: { role?: 'creator' | 'protocol' } = {};
      if (role && ['creator', 'protocol'].includes(role as string)) {
        filters.role = role as 'creator' | 'protocol';
      }

      const result = await this.waitlistService.getWaitlistEntries(filters, page, limit);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get waitlist entries error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve waitlist entries'
      });
    }
  };

  /**
   * @swagger
   * /api/waitlist/{id}:
   *   get:
   *     summary: Get waitlist entry by ID (Admin only)
   *     tags: [Waitlist]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Waitlist entry ID
   *     responses:
   *       200:
   *         description: Waitlist entry retrieved successfully
   *       404:
   *         description: Waitlist entry not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  public getWaitlistById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Waitlist ID is required'
        });
        return;
      }

      const waitlistEntry = await this.waitlistService.getWaitlistById(id);

      if (!waitlistEntry) {
        res.status(404).json({
          success: false,
          message: 'Waitlist entry not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: waitlistEntry
      });
    } catch (error) {
      console.error('Get waitlist by ID error:', error);
      
      if (error instanceof Error && error.message.includes('Invalid')) {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve waitlist entry'
      });
    }
  };

  /**
   * @swagger
   * /api/waitlist/stats:
   *   get:
   *     summary: Get waitlist statistics (Admin only)
   *     tags: [Waitlist]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Waitlist statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                     creators:
   *                       type: number
   *                     protocols:
   *                       type: number
   *                     recent:
   *                       type: number
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  public getWaitlistStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.waitlistService.getWaitlistStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get waitlist stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve waitlist statistics'
      });
    }
  };

  /**
   * @swagger
   * /api/waitlist/{id}:
   *   delete:
   *     summary: Delete waitlist entry by ID (Admin only)
   *     tags: [Waitlist]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Waitlist entry ID
   *     responses:
   *       200:
   *         description: Waitlist entry deleted successfully
   *       404:
   *         description: Waitlist entry not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin access required
   */
  public deleteWaitlist = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'Waitlist ID is required'
        });
        return;
      }

      const deleted = await this.waitlistService.deleteWaitlistEntry(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Waitlist entry not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Waitlist entry deleted successfully'
      });
    } catch (error) {
      console.error('Delete waitlist error:', error);
      
      if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('not found'))) {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete waitlist entry'
      });
    }
  };

  /**
   * @swagger
   * /api/waitlist/check-email:
   *   post:
   *     summary: Check if email exists in waitlist
   *     tags: [Waitlist]
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
   *                 format: email
   *     responses:
   *       200:
   *         description: Email check completed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 exists:
   *                   type: boolean
   */
  public checkEmailExists = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required'
        });
        return;
      }

      const exists = await this.waitlistService.checkEmailExists(email);

      res.status(200).json({
        success: true,
        exists
      });
    } catch (error) {
      console.error('Check email exists error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check email'
      });
    }
  };
}