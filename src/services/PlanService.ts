import { UserModel } from '../models/User';
import { PlanModel, PlanName } from '../models/Plan';

export interface HostPlanInfo {
  plan: {
    id: string;
    name: PlanName;
    duration_months: number | null;
  };
  is_active: boolean;
  expires_at: string | null;
}

export class PlanService {
  public async listPlans(): Promise<Array<{ id: string; name: PlanName; duration_months: number | null }>> {
    await PlanModel.ensureDefaults();
    const plans = await PlanModel.listAll();
    return plans.map(p => ({
      id: p._id!.toString(),
      name: p.name,
      duration_months: p.duration_months
    }));
  }

  public async getHostPlan(userId: string): Promise<HostPlanInfo> {
    await PlanModel.ensureDefaults();

    const user = await UserModel.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.user_type !== 'HOST') throw new Error('Only HOST users can access plan information');

    const basicPlan = await PlanModel.findByName('BASIC');
    if (!basicPlan?._id) throw new Error('BASIC plan not found');

    const planId = user.plan_id || basicPlan._id.toString();
    const plan = (await PlanModel.findById(planId)) || basicPlan;

    const expiresAt = user.duration_plan ? new Date(user.duration_plan) : null;
    const isTimeBound = plan.duration_months !== null;
    const isActive = !isTimeBound ? true : !!(expiresAt && expiresAt.getTime() > Date.now());

    return {
      plan: {
        id: plan._id!.toString(),
        name: plan.name,
        duration_months: plan.duration_months
      },
      is_active: isActive,
      expires_at: expiresAt ? expiresAt.toISOString() : null
    };
  }
}

