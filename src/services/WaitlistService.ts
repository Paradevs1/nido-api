import { WaitlistModel, IWaitlist } from '../models/Waitlist';

export interface WaitlistSubmissionData {
  email: string;
  xHandle: string;
  role: 'creator' | 'protocol';
}

export interface WaitlistStats {
  total: number;
  creators: number;
  protocols: number;
  recent: number;
}

export class WaitlistService {
  public async createWaitlistEntry(data: WaitlistSubmissionData): Promise<IWaitlist> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate and normalize X handle
    let xHandle = data.xHandle.trim();
    if (xHandle.startsWith('@')) {
      xHandle = xHandle.substring(1);
    }
    if (!xHandle || xHandle.length === 0) {
      throw new Error('X handle is required');
    }

    // Validate role
    if (!['creator', 'protocol'].includes(data.role)) {
      throw new Error('Role must be either "creator" or "protocol"');
    }

    try {
      const waitlistEntry = await WaitlistModel.create({
        email: data.email.toLowerCase(),
        xHandle: xHandle,
        role: data.role
      });

      return waitlistEntry;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new Error('This email is already on the waitlist');
      }
      throw error;
    }
  }

  public async getWaitlistEntries(
    filters: { role?: 'creator' | 'protocol' } = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{
    data: IWaitlist[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 50;

    const result = await WaitlistModel.findAll(filters, page, limit);

    return {
      data: result.data,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNext: result.page < result.totalPages,
        hasPrev: result.page > 1
      }
    };
  }

  public async getWaitlistById(id: string): Promise<IWaitlist | null> {
    if (!id || id.length !== 24) {
      throw new Error('Invalid waitlist ID format');
    }

    return await WaitlistModel.findById(id);
  }

  public async getWaitlistByEmail(email: string): Promise<IWaitlist | null> {
    if (!email) {
      throw new Error('Email is required');
    }

    return await WaitlistModel.findByEmail(email.toLowerCase());
  }

  public async deleteWaitlistEntry(id: string): Promise<boolean> {
    if (!id || id.length !== 24) {
      throw new Error('Invalid waitlist ID format');
    }

    const exists = await WaitlistModel.findById(id);
    if (!exists) {
      throw new Error('Waitlist entry not found');
    }

    return await WaitlistModel.deleteById(id);
  }

  public async updateWaitlistEntry(
    id: string,
    updateData: Partial<Pick<IWaitlist, 'email' | 'xHandle' | 'role'>>
  ): Promise<IWaitlist> {
    if (!id || id.length !== 24) {
      throw new Error('Invalid waitlist ID format');
    }

    const exists = await WaitlistModel.findById(id);
    if (!exists) {
      throw new Error('Waitlist entry not found');
    }

    // Validate email if provided
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        throw new Error('Invalid email format');
      }
      updateData.email = updateData.email.toLowerCase();
    }

    // Validate and normalize X handle if provided
    if (updateData.xHandle) {
      let xHandle = updateData.xHandle.trim();
      if (xHandle.startsWith('@')) {
        xHandle = xHandle.substring(1);
      }
      if (!xHandle || xHandle.length === 0) {
        throw new Error('X handle cannot be empty');
      }
      updateData.xHandle = xHandle;
    }

    // Validate role if provided
    if (updateData.role && !['creator', 'protocol'].includes(updateData.role)) {
      throw new Error('Role must be either "creator" or "protocol"');
    }

    const updated = await WaitlistModel.updateById(id, updateData);
    if (!updated) {
      throw new Error('Failed to update waitlist entry');
    }

    return updated;
  }

  public async getWaitlistStats(): Promise<WaitlistStats> {
    return await WaitlistModel.getStats();
  }

  public async checkEmailExists(email: string): Promise<boolean> {
    if (!email) return false;
    
    const entry = await WaitlistModel.findByEmail(email.toLowerCase());
    return !!entry;
  }
}