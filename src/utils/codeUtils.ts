import { CampaignModel } from '../models/Campaign';
import { CampaignParticipantsModel } from '../models/CampaignParticipants';
import { MAX_PARTICIPANTS_LIMIT } from './consts';

/**
 * Gera um código de verificação alfanumérico de 6 dígitos
 * @returns Código de verificação (letras maiúsculas + números)
 */
export function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Verifica se o usuário participa de alguma campanha em "waiting payment"
 * para uma determinada chain (evm/sol/sui).
 */
export async function hasWaitingPaymentCampaignForChain(
  userId: string,
  chainType: 'evm' | 'sol' | 'sui' | 'stellar'
): Promise<boolean> {
  const participantsResult = await CampaignParticipantsModel.findByUserId(userId, 1, MAX_PARTICIPANTS_LIMIT);

  for (const participant of participantsResult.participants) {
    const campaign = await CampaignModel.findById(participant.campaignId);
    if (!campaign) continue;
    if (campaign.status !== 'waiting payment') continue;

    const chain = campaign.payment_chain;
    const isSol = chain === 'solana' || chain === 'SOL';
    const isSui = chain === 'sui' || chain === 'SUI';
    const isStellar = chain === 'stellar' || chain === 'STELLAR';
    const isEvm = !isSol && !isSui && !isStellar;

    if (
      (chainType === 'sol' && isSol) ||
      (chainType === 'sui' && isSui) ||
      (chainType === 'stellar' && isStellar) ||
      (chainType === 'evm' && isEvm)
    ) {
      return true;
    }
  }

  return false;
}

