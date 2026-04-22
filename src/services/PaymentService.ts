import { ethers } from "ethers";
import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction,
  TransactionExpiredBlockheightExceededError,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SuiClient, getFullnodeUrl } from "@mysten/sui.js/client";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { fromB64 } from "@mysten/sui.js/utils";
import bs58 from "bs58";
import * as StellarSdk from "@stellar/stellar-sdk";
import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { ERC20ABI, RPCS, TOKENS, WALLETS_DESTINATION, PLAN_CORE, MAX_PARTICIPANTS_LIMIT } from "../utils/consts";
import { PaymentModel } from "../models/Payment";
import { CampaignParticipantsModel } from "../models/CampaignParticipants";
import { UserModel } from "../models/User";
import { CampaignModel } from "../models/Campaign";
import { CampaignSugestionBountiesRankModel } from "../models/CampaignSugestionBountiesRank";
import { calculateDetailedDeadline } from "../utils/dateUtils";
import { campaignsCache, earnersCache } from "../utils/cache";
import { PaymentWinnersLogModel } from "../models/PaymentWinnersLog";

export interface SelectedKol {
  userId: string;
  quantity_convertion?: number;
}

interface PaymentResult {
  userId: string;
  wallet: string;
  amount: number;
  status: 'confirmed' | 'failed' | 'skipped';
  signature?: string | undefined;
  error?: string | undefined;
  paymentId?: string | undefined;
}

export class PaymentService {
  constructor() {}

  private getDestinationWallet(chain: string): string {
    if (chain === 'solana') return WALLETS_DESTINATION.solana;
    if (chain === 'sui') return WALLETS_DESTINATION.sui;
    if (chain === 'stellar') return WALLETS_DESTINATION.stellar;
    return WALLETS_DESTINATION.evm;
  }

  private getRpcHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    const origin =
      process.env['RPC_ORIGIN'] ||
      process.env['SUI_RPC_ORIGIN'] ||
      process.env['SOLANA_RPC_ORIGIN'] ||
      process.env['EVM_RPC_ORIGIN'];
    if (origin) headers['origin'] = origin;

    const referer =
      process.env['RPC_REFERER'] ||
      process.env['SUI_RPC_REFERER'] ||
      process.env['SOLANA_RPC_REFERER'] ||
      process.env['EVM_RPC_REFERER'];
    if (referer) headers['referer'] = referer;

    return headers;
  }

  private getRpcHeadersForUrl(rpcUrl: string): Record<string, string> {
    const headers = this.getRpcHeaders();
    if (rpcUrl.includes('ankr.com') && !headers['origin'] && !headers['referer']) {
      return { ...headers, origin: 'https://rpc.ankr.com', referer: 'https://rpc.ankr.com/' };
    }
    return headers;
  }

  private getEvmRpcUrl(chain: string): string | undefined {
    const chainKey = String(chain || '').toUpperCase();
    const envUrl =
      process.env[`RPC_${chainKey}_URL`] ||
      process.env[`RPC_${chainKey}`] ||
      process.env[`EVM_RPC_${chainKey}_URL`] ||
      process.env[`EVM_RPC_${chainKey}`];

    return envUrl || (RPCS as any)[chain];
  }

  private buildEvmProvider(rpcUrl: string): ethers.JsonRpcProvider {
    const request = new ethers.FetchRequest(rpcUrl);

    const headers = this.getRpcHeaders();
    for (const [key, value] of Object.entries(headers)) {
      request.setHeader(key, value);
    }

    return new ethers.JsonRpcProvider(request);
  }

  private getProviderEVM(chain: string): ethers.JsonRpcProvider {
    const rpcUrl = this.getEvmRpcUrl(chain);
    if (!rpcUrl) throw new Error(`RPC not configured for chain: ${chain}`);
    return this.buildEvmProvider(rpcUrl);
  }

  private async suiRpcRequest<T>(rpcUrl: string, method: string, params: any[]): Promise<T> {
    if (typeof fetch !== 'function') {
      throw new Error('Global fetch is not available to perform Sui RPC requests');
    }

    const headers = this.getRpcHeaders();

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    });

    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Sui RPC HTTP ${res.status}: ${JSON.stringify(data)}`);
    }

    if (data?.error) {
      const message = data.error?.message || 'Unknown Sui RPC error';
      const code = data.error?.code;
      const err: any = new Error(message);
      err.code = code;
      err.data = data.error?.data;
      throw err;
    }

    return data?.result as T;
  }

  private async getSuiClient(rpcUrl: string): Promise<SuiClient> {
    let rpcHeaders = this.getRpcHeaders();
    if (rpcUrl.includes('ankr.com') && !rpcHeaders['origin'] && !rpcHeaders['referer']) {
      rpcHeaders = { ...rpcHeaders, origin: 'https://rpc.ankr.com', referer: 'https://rpc.ankr.com/' };
    }
    const customFetch = (input: any, init?: any) => {
      const merged = new Headers(init?.headers ?? {});
      for (const [k, v] of Object.entries(rpcHeaders)) merged.set(k, v);
      return fetch(input, { ...init, headers: merged });
    };

    try {
      const mod: any = await import('@mysten/sui.js/client');
      const SuiHTTPTransport = mod?.SuiHTTPTransport;
      if (SuiHTTPTransport) {
        const transportCandidates = [
          () => new SuiHTTPTransport({ url: rpcUrl, fetch: customFetch }),
          () => new SuiHTTPTransport({ url: rpcUrl, headers: rpcHeaders }),
          () => new SuiHTTPTransport({ url: rpcUrl, requestOptions: { headers: rpcHeaders } }),
          () => new SuiHTTPTransport({ url: rpcUrl, fetchOptions: { headers: rpcHeaders } }),
        ];

        for (const buildTransport of transportCandidates) {
          try {
            const transport = buildTransport();
            return new SuiClient({ transport });
          } catch {
            // tenta próximo formato
          }
        }
      }
    } catch {
      // fallback
    }

    return new SuiClient({ url: rpcUrl, fetch: customFetch } as any);
  }

  public async getBalanceSOL(symbol: string, address: string) {
    try {
      const solanaRpc = (RPCS as any)["solana"];
      const connection = new Connection(solanaRpc, {
        commitment: "confirmed",
        httpHeaders: this.getRpcHeadersForUrl(solanaRpc),
      });
      const tokenMint = new PublicKey((TOKENS as any)["solana"][symbol]);
      const wallet = new PublicKey(address);

      const tokenAccount = await getAssociatedTokenAddress(tokenMint, wallet);
      
      const accountInfo = await connection.getAccountInfo(tokenAccount);
      if (!accountInfo) return 0;

      const balanceInfo = await connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balanceInfo.value.uiAmountString || "0");
    } catch (error: any) {
      console.error(`Error getting Solana balance for ${symbol}:`, error.message);
      return 0;
    }
  }

  public async getBalanceEVM(chain: string, symbol: string, address: string) {
    const provider = this.getProviderEVM(chain);
    const tokenAddress = (TOKENS as any)[chain][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for ${chain}`);

    const contract = new ethers.Contract(tokenAddress, ERC20ABI, provider) as any;
    const decimals = await contract.decimals();
    const balance = await contract.balanceOf(address);

    return Number(ethers.formatUnits(balance, decimals));
  }

  public async getBalanceSUI(symbol: string, address: string) {
    try {
      const client = await this.getSuiClient((RPCS as any)["sui"]);
      const tokenType = (TOKENS as any)["sui"][symbol];
      if (!tokenType) throw new Error(`Token ${symbol} not configured for Sui`);
  
      const balanceInfo = await client.getBalance({
        owner: address,
        coinType: tokenType,
      });
  
      return Number(balanceInfo.totalBalance) / Math.pow(10, 6);
    } catch (error: any) {
      return 0;
    }
  }

  public async retryFailedPayments(campaign_id: string) {
    const campaign = await CampaignModel.findById(campaign_id);
    if (!campaign) throw new Error('Campaign not found');

    const { payment_chain, payment_token } = campaign;
    if (!payment_chain || !payment_token) throw new Error('Campaign does not have payment_chain or payment_token configured');

    const { participants } = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, 1000);
    const winners = participants.filter(p => p.winner === true);
    if (winners.length === 0) throw new Error('No winners found for this campaign');

    const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(
      existingPayments.filter(p => p.status === 'confirmed').map(p => p.userId.toString())
    );

    const unpaidWinners = winners.filter(w => !paidUserIds.has(w.userId.toString()));
    if (unpaidWinners.length === 0) throw new Error('All winners already received payment');

    console.log(`🔄 Retry: ${unpaidWinners.length} winners não pagos na campanha ${campaign_id}`);

    let results: PaymentResult[];
    if (payment_chain === 'solana' || payment_chain === 'SOL') {
      results = await this.sendTokenSOL(payment_token, campaign_id);
    } else if (payment_chain === 'sui' || payment_chain === 'SUI') {
      results = await this.sendTokenSUI(payment_token, campaign_id);
    } else if (payment_chain === 'stellar' || payment_chain === 'STELLAR') {
      results = await this.sendTokenStellar(payment_token, campaign_id);
    } else {
      results = await this.sendTokenEVM(payment_chain, payment_token, campaign_id);
    }

    await this.savePaymentLogs(campaign_id, payment_chain, payment_token, results, 'retryFailedPayments');

    const allPayments = await PaymentModel.findByCampaignId(campaign_id);
    const confirmedUserIds = new Set(
      allPayments.filter(p => p.status === 'confirmed').map(p => p.userId.toString())
    );
    const allWinnersPaid = winners.every(w => confirmedUserIds.has(w.userId.toString()));

    if (allWinnersPaid) {
      await CampaignModel.updateById(campaign_id, {
        rewards_distributed: true,
        status: 'completed'
      });
      console.log(`✅ Campanha ${campaign_id}: todos os winners pagos. Status atualizado para completed.`);
    } else {
      const stillUnpaid = winners.filter(w => !confirmedUserIds.has(w.userId.toString())).length;
      console.warn(`⚠️ Campanha ${campaign_id}: ainda ${stillUnpaid} winners sem pagamento após retry.`);
    }

    const confirmedResults = results
      .filter(r => r.status === 'confirmed')
      .map(r => ({ paymentId: r.paymentId || '', signature: r.signature || '', to: r.wallet, transactionHash: r.signature || '' }));

    return {
      campaign_id,
      totalRetried: confirmedResults.length,
      totalUnpaidBefore: unpaidWinners.length,
      allPaid: allWinnersPaid,
      transactions: confirmedResults
    };
  }

  public async sendTokenWinners(campaign_id: string, acceptedRank?: boolean) {
    const campaign = await CampaignModel.findById(campaign_id);
    if (!campaign) throw new Error('Campaign not found');

    const { payment_chain, payment_token } = campaign;
    if (!payment_chain || !payment_token) throw new Error('Campaign does not have payment_chain or payment_token configured');

    if(campaign.rewards_distributed && campaign.status === 'completed') {
      const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
      const paidUserIds = new Set(existingPayments.map(p => p.userId.toString()));
      const { participants } = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, 1000);
      const unpaidWinners = participants.filter(p => p.winner === true && !paidUserIds.has(p.userId.toString()));

      if (unpaidWinners.length === 0) throw new Error('Campaign rewards already distributed or completed');
      console.log(`⚠️ Campanha ${campaign_id} marcada como completed mas ${unpaidWinners.length} winners não receberam. Reprocessando...`);
    } else if(campaign.status !== 'waiting payment')
      throw new Error('Campaign must be in waiting payment status to send winners');

    if(campaign.payment_received === false)
      throw new Error('Payment for the campaign is pending. Please make the payment to enable the distribution of rewards to participants');

    let winnersWithAmounts: Array<{ userId: string; amount_received: number; rank: number }> = [];

    if (acceptedRank) {
      const rankData = await CampaignSugestionBountiesRankModel.findByCampaignId(campaign_id);
      if (!rankData || !rankData.ranking || rankData.ranking.length === 0) throw new Error('No rank suggestion found for this campaign');

      winnersWithAmounts = rankData.ranking
        .filter(entry => entry.amount_received > 0)
        .map(entry => ({
          userId: entry.user_id,
          amount_received: entry.amount_received,
          rank: entry.rank
        }));
    } else winnersWithAmounts = await this.calculateRankManually(campaign_id, campaign);

    if (winnersWithAmounts.length === 0) throw new Error('No winners found for this campaign');

    for (const winner of winnersWithAmounts) {
      await CampaignParticipantsModel.updateWinnerData(
        winner.userId,
        campaign_id,
        {
          amount_received: winner.amount_received,
          winner: true,
          rank: winner.rank
        }
      );
    }

    let results: PaymentResult[];
    if (payment_chain === 'solana' || payment_chain === 'SOL') {
      results = await this.sendTokenSOL(payment_token, campaign_id);
    } else if (payment_chain === 'sui' || payment_chain === 'SUI') {
      results = await this.sendTokenSUI(payment_token, campaign_id);
    } else if (payment_chain === 'stellar' || payment_chain === 'STELLAR') {
      results = await this.sendTokenStellar(payment_token, campaign_id);
    } else {
      results = await this.sendTokenEVM(payment_chain, payment_token, campaign_id);
    }

    await this.savePaymentLogs(campaign_id, payment_chain, payment_token, results, 'sendTokenWinners');

    const allPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(allPayments.filter(p => p.status === 'confirmed').map(p => p.userId.toString()));
    const allWinnersPaid = winnersWithAmounts.every(w => paidUserIds.has(w.userId.toString()));

    if (allWinnersPaid) {
      await CampaignModel.updateById(campaign_id, {
        rewards_distributed: true,
        status: 'completed',
        payment_rank_generate_ai: acceptedRank ?? false
      });
    } else {
      const unpaidCount = winnersWithAmounts.filter(w => !paidUserIds.has(w.userId.toString())).length;
      console.warn(`⚠️ Campanha ${campaign_id}: ${unpaidCount} winners não receberam pagamento. Status não atualizado para completed.`);
    }

    return results
      .filter(r => r.status === 'confirmed')
      .map(r => ({ paymentId: r.paymentId || '', signature: r.signature || '', to: r.wallet, transactionHash: r.signature || '' }));
  }

  private async savePaymentLogs(
    campaignId: string,
    chain: string,
    symbol: string,
    results: PaymentResult[],
    source: 'sendTokenWinners' | 'retryFailedPayments'
  ): Promise<void> {
    try {
      const entries = results.map(r => ({
        campaignId,
        userId: r.userId,
        wallet: r.wallet,
        amount: r.amount,
        chain,
        symbol,
        status: r.status,
        signature: r.signature,
        error: r.error,
        source,
      }));
      await PaymentWinnersLogModel.createMany(entries);
    } catch (error: any) {
      console.error(`❌ Erro ao salvar payment_winners_logs para campanha ${campaignId}:`, error.message);
    }
  }

  private async calculateRankManually(campaign_id: string, campaign: any): Promise<Array<{ userId: string; amount_received: number; rank: number }>> {
    const result = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, MAX_PARTICIPANTS_LIMIT);
    const participants = result.participants;

    const participantsWithRank = participants.filter(p => p.rank !== undefined && p.rank !== null);

    participantsWithRank.sort((a, b) => (a.rank || 0) - (b.rank || 0));

    const rankedParticipants = participantsWithRank.map(participant => {
      const rank = participant.rank || 0;
      let amount_received = 0;
      
      if (campaign.reward_tiers && campaign.reward_tiers.length > 0) {
        const rewardTier = campaign.reward_tiers.find(
          (tier: any) => {
            const positionInitial = Number(tier.position_initial);
            const positionFinal = Number(tier.position_final);
            return rank >= positionInitial && rank <= positionFinal;
          }
        );
        
        if (rewardTier) amount_received = Number(rewardTier.payment_amount)
      } else if (campaign.total_prize_pool > 0) {
        const totalParticipants = participantsWithRank.length;
        if (totalParticipants > 0) amount_received = Number(campaign.total_prize_pool) / totalParticipants;
      }
      
      return {
        userId: participant.userId,
        amount_received,
        rank
      };
    });

    return rankedParticipants.filter(p => p.amount_received > 0);
  }

  private async sendTokenSOL(symbol: string, campaign_id: string) {
    const { participants } = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, 1000);
    const winners = participants.filter(p => p.winner === true);
    
    if (winners.length === 0) throw new Error('No winners found for this campaign');

    const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(existingPayments.map(p => p.userId.toString()));
    
    const unpaidWinners = winners.filter(winner => !paidUserIds.has(winner.userId.toString()));
    
    if (unpaidWinners.length === 0) {
      console.log(`Todos os winners da campanha ${campaign_id} já receberam pagamento`);
      return [];
    }
    
    console.log(`Enviando pagamentos para ${unpaidWinners.length} winners (${winners.length - unpaidWinners.length} já receberam)`);

    const solanaRpc = (RPCS as any)["solana"];
    const connection = new Connection(solanaRpc, {
      commitment: "confirmed",
      httpHeaders: this.getRpcHeadersForUrl(solanaRpc),
    });
    const tokenMint = new PublicKey((TOKENS as any)["solana"][symbol]);

    const solanaPrivateKey = process.env['SOLANA_PRIVATE_KEY'];
    if (!solanaPrivateKey) throw new Error('SOLANA_PRIVATE_KEY environment variable is not set. Please configure your Solana private key in the .env file.');
    
    let sender: Keypair;
    
    try {
      const decoded = bs58.decode(solanaPrivateKey);
      
      if (decoded.length === 64) sender = Keypair.fromSecretKey(decoded);
      else if (decoded.length === 32) {
        try {
          sender = Keypair.fromSeed(decoded);
        } catch (seedError) {
          throw new Error(`Invalid private key length: ${decoded.length} bytes. Expected 64 bytes for full private key or 32 bytes for seed. This appears to be a public key (32 bytes) instead of a private key.`);
        }
      } else throw new Error(`Invalid private key length: ${decoded.length} bytes. Expected 64 bytes for full private key or 32 bytes for seed.`);
    } catch (base58Error) {
      try {
        const decoded = Buffer.from(solanaPrivateKey, 'base64');
        if (decoded.length === 64) sender = Keypair.fromSecretKey(new Uint8Array(decoded)); 
        else throw new Error(`Invalid base64 private key length: ${decoded.length} bytes. Expected 64 bytes.`);
      } catch (base64Error) {
        try {
          const privateKeyArray = JSON.parse(solanaPrivateKey);
          if (privateKeyArray.length !== 64) throw new Error(`Invalid JSON private key length: ${privateKeyArray.length}. Expected 64 bytes.`);
          sender = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
        } catch (jsonError) {
          try {
            const privateKeyArray = solanaPrivateKey.split(',').map(n => parseInt(n.trim()));
            if (privateKeyArray.length !== 64) throw new Error(`Invalid comma-separated private key length: ${privateKeyArray.length}. Expected 64 bytes.`);
            sender = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
          } catch (csvError) {
            throw new Error(`Invalid Solana private key format. The provided key "${solanaPrivateKey.substring(0, 20)}..." appears to be a public key or invalid format. Please provide a valid 64-byte private key in one of these formats: base58, base64, JSON array, or comma-separated values.`);
          }
        }
      }
    }

    const fromTokenAccount = await getAssociatedTokenAddress(tokenMint, sender.publicKey);
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    const solUserIds = unpaidWinners.map(w => w.userId);
    const solUsersMap = await UserModel.findByIds(solUserIds);

    const results: PaymentResult[] = [];
    for (const winner of unpaidWinners) {
      const user = solUsersMap.get(winner.userId);
      if (!user || !user.wallet_sol) {
        console.warn(`⚠️ Winner ${winner.userId} não tem wallet_sol configurada, pulando pagamento`);
        results.push({ userId: winner.userId, wallet: '', amount: Number(winner.amount_received), status: 'skipped', error: 'wallet_sol not configured' });
        continue;
      }

      try {
        const amountReceived = Number(winner.amount_received);
        const amountInLamports = BigInt(Math.floor(amountReceived * 10 ** decimals));
        const toPublicKey = new PublicKey(user.wallet_sol);
        const toTokenAccount = await getAssociatedTokenAddress(tokenMint, toPublicKey);

        let signature: string | undefined;
        const maxRetries = 5;
        let retryCount = 0;
        let success = false;
        let lastError: any = null;

        const isTransactionExpiredError = (error: any): boolean => {
          return error instanceof TransactionExpiredBlockheightExceededError ||
                 error?.name === 'TransactionExpiredBlockheightExceededError' ||
                 (error?.message && error.message.includes('block height exceeded')) ||
                 (error?.message && error.message.includes('expired'));
        };

        while (retryCount < maxRetries && !success) {
          try {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

            const transaction = new Transaction().add(
              createTransferInstruction(
                fromTokenAccount,
                toTokenAccount,
                sender.publicKey,
                amountInLamports,
                [],
                TOKEN_PROGRAM_ID
              )
            );

            transaction.recentBlockhash = blockhash;
            transaction.feePayer = sender.publicKey;
            transaction.sign(sender);

            signature = await connection.sendRawTransaction(transaction.serialize(), {
              skipPreflight: false,
              maxRetries: 0
            });

            try {
              await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
              }, 'confirmed');

              success = true;
            } catch (confirmError: any) {
              if (isTransactionExpiredError(confirmError)) {
                const txStatus = await connection.getSignatureStatus(signature);
                if (txStatus?.value?.confirmationStatus === 'confirmed' ||
                    txStatus?.value?.confirmationStatus === 'finalized') {
                  success = true;
                } else {
                  lastError = confirmError;
                  retryCount++;
                  if (retryCount < maxRetries) {
                    console.log(`⚠️ Transação expirada (${signature.substring(0, 16)}...), tentando novamente (tentativa ${retryCount + 1}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  }
                }
              } else {
                const txStatus = await connection.getSignatureStatus(signature);
                if (txStatus?.value?.confirmationStatus === 'confirmed' ||
                    txStatus?.value?.confirmationStatus === 'finalized') {
                  success = true;
                } else {
                  throw confirmError;
                }
              }
            }
          } catch (error: any) {
            lastError = error;

            if (isTransactionExpiredError(error)) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`⚠️ Transação expirada, tentando novamente (tentativa ${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
            }

            throw error;
          }
        }

        if (!success || !signature) {
          throw new Error(`Failed to send transaction after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
        }

        const finalSignature: string = signature;

        const payment = await PaymentModel.create({
          userId: winner.userId,
          campaignId: campaign_id,
          signature: finalSignature,
          to: user.wallet_sol,
          amount: amountReceived,
          symbol,
          chain: 'solana',
          status: 'confirmed'
        });

        await CampaignParticipantsModel.updateDateReceived(winner.userId, campaign_id);

        await earnersCache.deleteByPrefix('earners:');

        results.push({ userId: winner.userId, wallet: user.wallet_sol, amount: amountReceived, status: 'confirmed', signature: finalSignature, paymentId: payment._id?.toString() });
      } catch (error: any) {
        console.error(`❌ Erro ao enviar token SOL para ${user.wallet_sol}:`, error.message);
        results.push({ userId: winner.userId, wallet: user.wallet_sol, amount: Number(winner.amount_received), status: 'failed', error: error.message });
      }
    }

    return results;
  }

  private async sendTokenSUI(symbol: string, campaign_id: string): Promise<PaymentResult[]> {
    const { participants } = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, 1000);
    const winners = participants.filter(p => p.winner === true);

    if (winners.length === 0) throw new Error('No winners found for this campaign');

    const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(existingPayments.map(p => p.userId.toString()));

    const unpaidWinners = winners.filter(winner => !paidUserIds.has(winner.userId.toString()));

    if (unpaidWinners.length === 0) {
      console.log(`Todos os winners da campanha ${campaign_id} já receberam pagamento`);
      return [];
    }

    console.log(`Enviando pagamentos para ${unpaidWinners.length} winners (${winners.length - unpaidWinners.length} já receberam)`);

    const client = await this.getSuiClient((RPCS as any)["sui"]);
    console.log('client', client);
    const tokenAddress = (TOKENS as any)["sui"][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for Sui`);

    const suiPrivateKey = process.env['SUI_PRIVATE_KEY'];
    if (!suiPrivateKey) throw new Error('SUI_PRIVATE_KEY environment variable is not set.');

    const { schema, secretKey } = decodeSuiPrivateKey(suiPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    const suiUserIds = unpaidWinners.map(w => w.userId);
    const suiUsersMap = await UserModel.findByIds(suiUserIds);

    const results: PaymentResult[] = [];

    for (const winner of unpaidWinners) {
      const user = suiUsersMap.get(winner.userId);
      if (!user || !user.wallet_sui) {
        console.warn(`⚠️ Winner ${winner.userId} não tem wallet_sui configurada, pulando pagamento`);
        results.push({ userId: winner.userId, wallet: '', amount: Number(winner.amount_received), status: 'skipped', error: 'wallet_sui not configured' });
        continue;
      }

      try {
        const amountReceived = Number(winner.amount_received);
        const amount = Math.floor(amountReceived * 1e6);

        const tx = new TransactionBlock();

        if (symbol === 'USDT' || symbol === 'USDC') {
          const senderCoins = await client.getCoins({
            owner: senderAddress,
            coinType: tokenAddress,
          });

          if (senderCoins.data.length === 0) {
            throw new Error(`No ${symbol} tokens found in sender wallet`);
          }

          const coinToSplit = senderCoins.data[0];
          if (coinToSplit) {
            const [splitCoin] = tx.splitCoins(tx.object(coinToSplit.coinObjectId), [tx.pure(amount)]);
            if (splitCoin) {
              tx.transferObjects([splitCoin], tx.pure(user.wallet_sui));
            }
          }
        } else {
          const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
          if (coin) tx.transferObjects([coin], tx.pure(user.wallet_sui));
        }

        tx.setGasBudget(100_000_000);

        const response = await client.signAndExecuteTransactionBlock({
          signer: keypair,
          transactionBlock: tx,
          options: { showEffects: true },
        });

        const txHash = response.digest;

        const isSuccess = response.effects?.status?.status === 'success';
        const status = isSuccess ? 'confirmed' : 'failed';

        const payment = await PaymentModel.create({
          userId: winner.userId,
          campaignId: campaign_id,
          signature: txHash,
          to: user.wallet_sui,
          amount: amountReceived,
          symbol,
          chain: 'sui',
          status: status,
        });

        if (isSuccess) {
          await CampaignParticipantsModel.updateDateReceived(winner.userId, campaign_id);
          await earnersCache.deleteByPrefix('earners:');
        }

        results.push({ userId: winner.userId, wallet: user.wallet_sui, amount: amountReceived, status, signature: txHash, paymentId: payment._id?.toString() });
      } catch (error: any) {
        console.error(`❌ Error sending Sui token to ${user.wallet_sui}:`, error.message);
        results.push({ userId: winner.userId, wallet: user.wallet_sui, amount: Number(winner.amount_received), status: 'failed', error: error.message });
      }
    }

    return results;
  }

  private async sendTokenEVM(chain: string, symbol: string, campaign_id: string): Promise<PaymentResult[]> {
    const { participants } = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, 1000);
    const winners = participants.filter(p => p.winner === true);

    if (winners.length === 0) throw new Error('No winners found for this campaign');

    const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(existingPayments.map(p => p.userId.toString()));

    const unpaidWinners = winners.filter(winner => !paidUserIds.has(winner.userId.toString()));

    if (unpaidWinners.length === 0) {
      console.log(`Todos os winners da campanha ${campaign_id} já receberam pagamento`);
      return [];
    }

    console.log(`Enviando pagamentos para ${unpaidWinners.length} winners (${winners.length - unpaidWinners.length} já receberam)`);

    const wallet = this.getWalletEVM(chain);
    const tokenAddress = (TOKENS as any)[chain][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for ${chain}`);

    const contract = new ethers.Contract(tokenAddress, ERC20ABI, wallet) as any;
    const decimals = await contract.decimals();

    const evmUserIds = unpaidWinners.map(w => w.userId);
    const evmUsersMap = await UserModel.findByIds(evmUserIds);

    const results: PaymentResult[] = [];
    for (const winner of unpaidWinners) {
      const user = evmUsersMap.get(winner.userId);
      if (!user || !user.wallet_evm) {
        console.warn(`⚠️ Winner ${winner.userId} não tem wallet_evm configurada, pulando pagamento`);
        results.push({ userId: winner.userId, wallet: '', amount: Number(winner.amount_received), status: 'skipped', error: 'wallet_evm not configured' });
        continue;
      }

      try {
        const amountReceived = Number(winner.amount_received);
        const amountInWei = ethers.parseUnits(amountReceived.toString(), decimals);
        const tx = await contract.transfer(user.wallet_evm, amountInWei);
        await tx.wait();

        const payment = await PaymentModel.create({
          userId: winner.userId,
          campaignId: campaign_id,
          signature: tx.hash,
          to: user.wallet_evm,
          amount: amountReceived,
          chain,
          symbol,
          status: 'confirmed'
        });

        await CampaignParticipantsModel.updateDateReceived(winner.userId, campaign_id);

        await earnersCache.deleteByPrefix('earners:');

        results.push({ userId: winner.userId, wallet: user.wallet_evm, amount: amountReceived, status: 'confirmed', signature: tx.hash, paymentId: payment._id?.toString() });
      } catch (error: any) {
        console.error(`❌ Erro ao enviar token EVM para ${user.wallet_evm}:`, error.message);
        results.push({ userId: winner.userId, wallet: user.wallet_evm, amount: Number(winner.amount_received), status: 'failed', error: error.message });
      }
    }

    return results;
  }

  private getWalletEVM(chain: string) {
    const provider = this.getProviderEVM(chain);
    return new ethers.Wallet(process.env['EVM_PRIVATE_KEY']!, provider);
  }

  private async getHostFeePercent(hostId: string, baseAmountUsd: number): Promise<number> {
    try {
      const { PlanService } = await import('./PlanService');
      const planInfo = await new PlanService().getHostPlan(hostId);

      if (planInfo.plan.name === 'ENTERPRISE' && planInfo.is_active) {
        return 0;
      }

      if (planInfo.plan.name === 'CORE' && planInfo.is_active) {
        if (baseAmountUsd <= 2000) return 0.06;
        if (baseAmountUsd <= 5000) return 0.05;
        return 0.03;
      }

      return 0.12;
    } catch {
      return 0.12;
    }
  }

  private async calculateExpectedAmountWithFee(campaign: any, hostId: string): Promise<number> {
    let baseAmount = 0;
    if (campaign.is_cac && campaign.list_kols && campaign.limit_amount_convertion) {
      baseAmount = (campaign.list_kols.length * campaign.limit_amount_convertion);
    } else {
      baseAmount = Number(campaign.total_prize_pool || 0);
    }

    const feePercent = await this.getHostFeePercent(hostId, baseAmount);
    const feeAmount = baseAmount * feePercent;
    return baseAmount + feeAmount;
  }

  public async paymentHostCreate(walletAddress: string, campaignId: string, hostId: string, chain: string, symbol: string): Promise<{ paymentId: string, destinationAddress: string, token: string, amount: number, message: string }> {
    try {
      const { CampaignModel } = await import('../models/Campaign');
      const campaign = await CampaignModel.findById(campaignId);
      
      if (!campaign) throw new Error('Campaign not found');

      if (campaign.start_date && campaign.end_date) {
        const deadline = calculateDetailedDeadline(campaign.start_date, campaign.end_date);
        if (deadline.is_expired) 
          throw new Error('Campaign deadline has expired. Payment cannot be created.');
      }

      const expectedAmount = await this.calculateExpectedAmountWithFee(campaign, hostId);

      const destinationAddress = this.getDestinationWallet(chain);
      const tokenAddress = (TOKENS as any)[chain][symbol];

      const { PaymentHostModel } = await import('../models/PaymentHost');
      const paymentHost = await PaymentHostModel.create({
        hostId: hostId,
        campaignId: campaignId,
        signature: "",
        amount: expectedAmount,
        status: 'pending',
        walletAddressHost: walletAddress
      });

      return {
        paymentId: paymentHost._id?.toString() || '',
        destinationAddress: destinationAddress,
        token: tokenAddress,
        amount: expectedAmount,
        message: 'Payment host created successfully'
      };
    } catch (error: any) {
      console.error('Error creating payment host:', error.message);
      throw error;
    }
  }

  public async paymentHostConfirm(paymentId: string, taxId: string, campaignId: string, chain: string, symbol: string, userId: string): Promise<{ isValidTransaction: boolean; paymentId: string; message: string }> {
    try {
      const { CampaignModel } = await import('../models/Campaign');
      const campaign = await CampaignModel.findById(campaignId);
      
      if (!campaign) throw new Error('Campaign not found');

      const expectedAmount = await this.calculateExpectedAmountWithFee(campaign, userId);

      const tokenAddress = (TOKENS as any)[chain][symbol];
      const isValidTransaction = await this.validateTransactionOnChain(taxId, chain, expectedAmount, tokenAddress);

      const { PaymentHostModel } = await import('../models/PaymentHost');
      
      if (!isValidTransaction) {
        await PaymentHostModel.updateStatusAndSignature(paymentId, taxId, 'error');
        return { isValidTransaction: false, paymentId: paymentId, message: 'Invalid transaction' };
      }

      const paymentHost = await PaymentHostModel.updateStatusAndSignature(paymentId, taxId, 'confirmed');

      await CampaignModel.updateById(campaignId, { status: 'active', payment_received: true });

      await campaignsCache.deleteByPrefix('campaigns:all');

      await UserModel.incrementCampaignsCreated(userId);

      return {
        isValidTransaction: true,
        paymentId: paymentId,
        message: 'Transaction confirmed'
      };
    } catch (error: any) {
      console.error('Error activating campaign with payment:', error.message);
      throw error;
    }
  }

  public async paymentPlanCreate(hostId: string, chain: string, symbol: string): Promise<{ destinationAddress: string; token: string; amount: number; message: string }> {
    const host = await UserModel.findById(hostId);
    if (!host) throw new Error('Host not found');
    if (host.user_type !== 'HOST') throw new Error('Only HOST users can pay plans');

    const destinationAddress = this.getDestinationWallet(chain);
    const tokenAddress = (TOKENS as any)[chain]?.[symbol];
    if (!tokenAddress) throw new Error('Token not supported for this chain');

    return {
      destinationAddress,
      token: tokenAddress,
      amount: PLAN_CORE,
      message: 'Plan payment info generated successfully'
    };
  }

  public async paymentPlanConfirm(hostId: string, taxId: string, chain: string, symbol: string): Promise<{ isValidTransaction: boolean; message: string; token?: string; expiresAt?: string | null }> {
    const host = await UserModel.findById(hostId);
    if (!host) throw new Error('Host not found');
    if (host.user_type !== 'HOST') throw new Error('Only HOST users can pay plans');

    const { PlanModel } = await import('../models/Plan');
    const { PlanPaymentModel } = await import('../models/PlanPayment');
    const { generateToken } = await import('../config/jwt');

    await PlanModel.ensureDefaults();
    const corePlan = await PlanModel.findByName('CORE');
    if (!corePlan?._id) throw new Error('CORE plan not found');

    const alreadyUsed = await PlanPaymentModel.findByTax(taxId);
    if (alreadyUsed) {
      return { isValidTransaction: true, message: 'Transaction already used to activate plan' };
    }

    const tokenAddress = (TOKENS as any)[chain]?.[symbol];
    if (!tokenAddress) throw new Error('Token not supported for this chain');

    const expectedAmount = PLAN_CORE;
    const isValidTransaction = await this.validateTransactionOnChain(taxId, chain, expectedAmount, tokenAddress);

    if (!isValidTransaction) {
      return { isValidTransaction: false, message: 'Invalid transaction' };
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    await PlanPaymentModel.create({
      plan_id: corePlan._id.toString(),
      user_id: hostId,
      tax: taxId,
      date: now,
      status: 'confirmed'
    });

    await UserModel.updateById(hostId, {
      plan_id: corePlan._id.toString(),
      duration_plan: expiresAt
    });

    const token = generateToken({
      userId: hostId,
      email: host.email || '',
      role: host.user_type,
      planId: corePlan._id.toString(),
      planName: 'CORE',
      planExpiresAt: expiresAt.toISOString(),
      ...(host.status !== undefined && { status: host.status })
    });

    return {
      isValidTransaction: true,
      message: 'Transaction confirmed. Plan CORE activated',
      token,
      expiresAt: expiresAt.toISOString()
    };
  }

  public async validateTransactionOnChain(taxId: string, chain: string, expectedAmount: number, tokenAddress?: string): Promise<boolean> {
    try {
      const rpcUrl = (chain === 'solana' || chain === 'sui' || chain === 'stellar')
        ? (RPCS as any)[chain]
        : this.getEvmRpcUrl(chain);
      if (!rpcUrl) throw new Error(`RPC not configured for chain: ${chain}`);

      if (chain === 'solana') return await this.validateSolanaTransaction(taxId, rpcUrl, expectedAmount, tokenAddress);
      else if (chain === 'sui') return await this.validateSuiTransaction(taxId, rpcUrl, expectedAmount);
      else if (chain === 'stellar') return await this.validateStellarTransaction(taxId, rpcUrl, expectedAmount);
      else return await this.validateEVMTransaction(chain, taxId, rpcUrl, expectedAmount, tokenAddress);
    } catch (error: any) {
      return false;
    }
  }

  private async validateEVMTransaction(chain: string, taxId: string, rpcUrl: string, expectedAmount: number, tokenAddress?: string): Promise<boolean> {
    try {
      const provider = this.buildEvmProvider(rpcUrl);
      const receipt = await provider.getTransactionReceipt(taxId);
      if (!receipt || receipt.status !== 1) return false;

      if (!tokenAddress) return false;

      const iface = new ethers.Interface([ "event Transfer(address indexed from, address indexed to, uint256 value)" ]);
      const erc20 = new ethers.Contract(tokenAddress, ["function decimals() view returns (uint8)"], provider ) as unknown as { decimals: () => Promise<number> };
      const decimals = Number(await erc20["decimals"]());
  
      let totalTransferred = 0;
      let validDestination = false;
      
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === tokenAddress.toLowerCase()) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && parsed.name === "Transfer") {
              const to = parsed.args["to"] as string;
              const value = parsed.args["value"] as bigint;
              const amount = Number(value) / Math.pow(10, decimals);
              
              if (to.toLowerCase() === WALLETS_DESTINATION.evm.toLowerCase()) {
                validDestination = true;
                totalTransferred += amount;
              }
            }
          } catch { }
        }
      }
  
      return validDestination && Math.abs(totalTransferred - expectedAmount) < 0.1;
    } catch (error) {
      console.error("Error validating transaction:", error);
      return false;
    }
  }
  
  private async validateSolanaTransaction(taxId: string, rpcUrl: string, expectedAmount: number, tokenAddress?: string): Promise<boolean> {
    const maxRetries = 3;
    const retryDelay = 2000;
    const rpcCandidates = Array.from(new Set([
      rpcUrl,
      "https://rpc.ankr.com/solana/867c41c4fee0017d9229258bbb15e7dc556628a41d88c70fe660baaea34a13e3",
    ]));

    for (const rpc of rpcCandidates) {
      const connection = new Connection(rpc, { httpHeaders: this.getRpcHeadersForUrl(rpc) });

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          let transaction = null;
          const commitments = ["confirmed", "finalized"] as const;
          const maxSupportedTransactionVersion = 0;
          
          for (const commitment of commitments) {
            try {
              transaction = await connection.getTransaction(taxId, { 
                commitment,
                maxSupportedTransactionVersion
              });
              
              if (transaction && transaction.meta) {
                break;
              }
            } catch (err: any) {
              // Continua tentando
            }
          }

          if (!transaction || !transaction.meta) {
            try {
              transaction = await connection.getTransaction(taxId, { 
                commitment: "confirmed"
              });
            } catch (err: any) {
              // Continua tentando
            }
          }

          if (!transaction || !transaction.meta) {
            try {
              const parsedTx = await connection.getParsedTransaction(taxId, {
                commitment: "confirmed",
                maxSupportedTransactionVersion: 0
              });
              
              if (parsedTx && parsedTx.meta) {
                transaction = parsedTx as any;
              }
            } catch (err: any) {
              // Continua
            }
          }
          
          if (!transaction || !transaction.meta) {
            if (attempt < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
            break; // troca de RPC
          }

          const { preTokenBalances, postTokenBalances } = transaction.meta;

          const preBalances = preTokenBalances?.filter((b: any) => b.mint === tokenAddress) || [];
          const postBalances = postTokenBalances?.filter((b: any) => b.mint === tokenAddress) || [];

          if (preBalances.length === 0 && postBalances.length === 0) {
            return false;
          }

          let totalTransferred = 0;
          let validDestination = false;
          const destinationWallet = WALLETS_DESTINATION.solana;

          for (const post of postBalances) {
            const decimals = post.uiTokenAmount.decimals || 6;
            const pre = preBalances.find((p: any) => p.owner === post.owner);

            const preAmount = pre ? Number(pre.uiTokenAmount.amount) / Math.pow(10, decimals) : 0;
            const postAmount = Number(post.uiTokenAmount.amount) / Math.pow(10, decimals);

            const delta = postAmount - preAmount;
            
            if (delta > 0) {
              if (post.owner === destinationWallet) {
                validDestination = true;
                totalTransferred += delta;
              }
            }
          }

          const amountDiff = Math.abs(totalTransferred - expectedAmount);
          const isValid = validDestination && amountDiff < 0.1;
          return isValid;
        } catch (error: any) {
          if (attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
      }
    }

    return false;
  }

  private async validateSuiTransaction(taxId: string, rpcUrl: string, expectedAmount: number): Promise<boolean> {
    const maxRetries = 5;
    const retryDelay = 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const transaction = await this.suiRpcRequest<any>(
          rpcUrl,
          'sui_getTransactionBlock',
          [
            taxId,
            { showEffects: true, showObjectChanges: true, showBalanceChanges: true }
          ]
        );

        if (transaction.effects?.status?.status !== 'success') {
          return false;
        }

        let totalTransferred = 0;
        let validDestination = false;

        const balanceChanges = (transaction as any).balanceChanges || [];
        if (Array.isArray(balanceChanges) && balanceChanges.length > 0) {
          for (const change of balanceChanges) {
            const owner = change?.owner;
            const coinType: string | undefined = change?.coinType;
            const amountRaw = change?.amount;

            if (!coinType || amountRaw === undefined || amountRaw === null) continue;
            if (!(coinType.includes('::usdc::USDC') || coinType.includes('::usdt::USDT'))) continue;
            if (!(owner && typeof owner === 'object' && 'AddressOwner' in owner && owner.AddressOwner === WALLETS_DESTINATION.sui)) continue;

            const amountNumber = Number(amountRaw);
            if (!Number.isFinite(amountNumber) || amountNumber <= 0) continue;

            validDestination = true;
            totalTransferred += amountNumber / 1e6;
          }
        } else {
          const objectChanges = transaction.objectChanges || [];
          for (const change of objectChanges) {
            if (change.type === 'created' && change.objectType) {
              const coinObject = await this.suiRpcRequest<any>(
                rpcUrl,
                'sui_getObject',
                [change.objectId, { showContent: true }]
              );
              const content = coinObject.data?.content;
              if (content?.dataType === 'moveObject' && (content.type.includes('::usdc::USDC') || content.type.includes('::usdt::USDT'))) {
                const fields = (content as any).fields;
                if (fields?.balance) {
                  const owner = change.owner;
                  if (owner && typeof owner === 'object' && 'AddressOwner' in owner && owner.AddressOwner === WALLETS_DESTINATION.sui) {
                    validDestination = true;
                    totalTransferred += Number(fields.balance) / 1e6;
                  }
                }
              }
            }
          }
        }

        const isValid = validDestination && Math.abs(totalTransferred - expectedAmount) < 0.1;
        return isValid;
      } catch (error: any) {
        console.error('[validateSuiTransaction] getTransactionBlock error:', {
          attempt,
          message: error?.message,
          code: error?.code,
          data: error?.data,
        });

        const isTransactionNotFound = 
          error?.code === -32602 || 
          error?.message?.includes('Could not find the referenced transaction') ||
          error?.message?.includes('TransactionDigest') ||
          error?.message?.toLowerCase?.().includes('not found');

        const isRetryable =
          isTransactionNotFound ||
          error?.code === -32603 ||
          error?.message?.includes('502') ||
          error?.message?.includes('503') ||
          error?.message?.includes('504') ||
          error?.message?.toLowerCase?.().includes('timeout') ||
          error?.message?.toLowerCase?.().includes('rate');

        if (isRetryable && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        return false;
      }
    }

    return false;
  }

  public async paymentKolsSelective(campaign_id: string, selectedKols: SelectedKol[]) {
    const campaign = await CampaignModel.findById(campaign_id);
    if (!campaign) throw new Error('Campaign not found');

    const { payment_chain, payment_token, list_kols } = campaign;
    if (!payment_chain || !payment_token) throw new Error('Campaign does not have payment_chain or payment_token configured');
    
    if (!list_kols || list_kols.length === 0) throw new Error('Campaign does not have KOLs configured');

    if (campaign.status !== 'waiting payment' && campaign.status !== 'completed') {
      throw new Error('Campaign must be in waiting payment or completed status to pay KOLs');
    }

    if (campaign.payment_received === false) {
      throw new Error('Payment for the campaign is pending. Please make the payment to enable the distribution of rewards to KOLs');
    }

    const hostWallet = await this.getHostWalletByCampaignId(campaign_id);
    if (!hostWallet) throw new Error('Host wallet not found');

    const selectedKolUserIds = selectedKols.map(s => String(s.userId));
    const selectedKolsFromCampaign = list_kols.filter(kol => selectedKolUserIds.includes(String(kol.userId)));
    const unselectedKols = list_kols.filter(kol => !selectedKolUserIds.includes(String(kol.userId)));

    if (selectedKols.length === 0 && unselectedKols.length === 0) {
      throw new Error('No KOLs found to process');
    }

    const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(existingPayments.map(p => String(p.userId)));

    const isCacCampaign = Boolean(campaign.is_cac && campaign.amount_convertion);

    const selectedKolsWithAmounts: Array<{ userId: string; amount: number; quantity_convertion?: number }> = selectedKolsFromCampaign.map(kol => {
      const userId = String(kol.userId);

      if (!isCacCampaign) {
        return { userId, amount: kol.amount };
      }

      const selectedKol = selectedKols.find(s => String(s.userId) === userId);
      if (!selectedKol) throw new Error(`Selected KOL with userId ${userId} not found`);

      if (selectedKol.quantity_convertion === undefined || selectedKol.quantity_convertion === null) {
        throw new Error(`quantity_convertion is required for KOL ${userId} when campaign.is_cac is true`);
      }

      const amountConvertion = campaign.amount_convertion!;
      const quantityConversion = campaign.quantity_conversion || 1;
      const limitAmountConvertion = campaign.limit_amount_convertion;

      // (conversions / quantity_conversion) * amount_convertion
      let calculatedAmount = (selectedKol.quantity_convertion / quantityConversion) * amountConvertion;
      if (limitAmountConvertion && calculatedAmount > limitAmountConvertion) calculatedAmount = limitAmountConvertion;

      return { userId, amount: calculatedAmount, quantity_convertion: selectedKol.quantity_convertion };
    });

    const rankedSelectedKols = [...selectedKolsWithAmounts].sort((a, b) => {
      if (isCacCampaign) {
        const qa = a.quantity_convertion ?? 0;
        const qb = b.quantity_convertion ?? 0;
        if (qb !== qa) return qb - qa;
      } else {
        if (b.amount !== a.amount) return b.amount - a.amount;
      }
      return a.userId.localeCompare(b.userId);
    });

    const rankByUserId = new Map<string, number>();
    rankedSelectedKols.forEach((k, idx) => rankByUserId.set(k.userId, idx + 1));

    for (const kol of selectedKolsWithAmounts) {
      await CampaignParticipantsModel.updateWinnerData(kol.userId, campaign_id, {
        amount_received: kol.amount,
        winner: true,
        rank: rankByUserId.get(kol.userId)!,
      });
    }

    const unpaidSelectedKols = selectedKolsWithAmounts.filter(kol => !paidUserIds.has(kol.userId));

    const results = {
      payments: [] as Array<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string }>,
      refunds: [] as Array<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string; amount: number }>
    };

    if (unpaidSelectedKols.length > 0) {
      console.log(`Sending payments to ${unpaidSelectedKols.length} selected KOLs`);
      
      let paymentResults: Array<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string }>;
      
      if (payment_chain === 'solana' || payment_chain === 'SOL') {
        paymentResults = await this.sendTokenKolsSOL(payment_token, campaign_id, unpaidSelectedKols);
      } else if (payment_chain === 'sui' || payment_chain === 'SUI') {
        paymentResults = await this.sendTokenKolsSUI(payment_token, campaign_id, unpaidSelectedKols);
      } else if (payment_chain === 'stellar' || payment_chain === 'STELLAR') {
        paymentResults = await this.sendTokenKolsStellar(payment_token, campaign_id, unpaidSelectedKols);
      } else {
        paymentResults = await this.sendTokenKolsEVM(payment_chain, payment_token, campaign_id, unpaidSelectedKols);
      }
      
      results.payments = paymentResults;
    }

    let totalPaid = 0;
    if (campaign.is_cac && campaign.list_kols && campaign.limit_amount_convertion)
      totalPaid = campaign.list_kols.length * campaign.limit_amount_convertion;
    else 
      totalPaid = campaign.total_prize_pool;

    const allPayments = await PaymentModel.findByCampaignId(campaign_id);
    const totalSentToUsers = allPayments
      .filter(p => p.status === 'confirmed' && p.to !== hostWallet)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const refundAmount = totalPaid - totalSentToUsers;
    
    if (refundAmount > 0) {
      console.log(`Refunding ${refundAmount} to host (Total paid: ${totalPaid}, Total sent: ${totalSentToUsers})`);
      
      let refundResult: { paymentId?: string | any; signature?: string; to: string; transactionHash?: string; amount: number } | null = null;
      
      if (payment_chain === 'solana' || payment_chain === 'SOL') {
        refundResult = await this.refundAmountToHostSOL(payment_token, campaign_id, refundAmount, hostWallet);
      } else if (payment_chain === 'sui' || payment_chain === 'SUI') {
        refundResult = await this.refundAmountToHostSUI(payment_token, campaign_id, refundAmount, hostWallet);
      } else if (payment_chain === 'stellar' || payment_chain === 'STELLAR') {
        refundResult = await this.refundAmountToHostStellar(payment_token, campaign_id, refundAmount, hostWallet);
      } else {
        refundResult = await this.refundAmountToHostEVM(payment_chain, payment_token, campaign_id, refundAmount, hostWallet);
      }
      
      if (refundResult) {
        results.refunds = [refundResult];
      }
    }

    await CampaignModel.updateById(campaign_id, { 
      rewards_distributed: true, 
      status: 'completed',
    });

    return results;
  }

  private async getHostWalletByCampaignId(campaignId: string): Promise<string | null> {
    try {
      const { CampaignModel } = await import('../models/Campaign');
      const campaign = await CampaignModel.findById(campaignId);
      
      if (campaign) {
        const PARABUILDERS_HOST_ID = '691f8e7b70fa2866f6ec97e7';
        if (campaign.host_id === PARABUILDERS_HOST_ID) {
          return '0x8ce17196ED839FC0Fd62F725780BbcA087774eC3';
        }
      }

      const { PaymentHostModel } = await import('../models/PaymentHost');
      const paymentHosts = await PaymentHostModel.findByCampaignId(campaignId);
      const confirmedPayment = paymentHosts.find(p => p.status === 'confirmed');
      
      if (confirmedPayment && confirmedPayment.walletAddressHost) {
        return confirmedPayment.walletAddressHost;
      }
      return null;
    } catch (error: any) {
      return null;
    }
  }

  private async sendTokenKolsSOL(symbol: string, campaign_id: string, kols: Array<{ userId: string; amount: number }>) {
    const solanaRpc = (RPCS as any)["solana"];
    const connection = new Connection(solanaRpc, {
      commitment: "confirmed",
      httpHeaders: this.getRpcHeadersForUrl(solanaRpc),
    });
    const tokenMint = new PublicKey((TOKENS as any)["solana"][symbol]);

    const solanaPrivateKey = process.env['SOLANA_PRIVATE_KEY'];
    if (!solanaPrivateKey) throw new Error('SOLANA_PRIVATE_KEY environment variable is not set.');
    
    let sender: Keypair;
    
    try {
      const decoded = bs58.decode(solanaPrivateKey);
      if (decoded.length === 64) sender = Keypair.fromSecretKey(decoded);
      else if (decoded.length === 32) {
        sender = Keypair.fromSeed(decoded);
      } else throw new Error(`Invalid private key length: ${decoded.length} bytes.`);
    } catch (base58Error) {
      try {
        const decoded = Buffer.from(solanaPrivateKey, 'base64');
        if (decoded.length === 64) sender = Keypair.fromSecretKey(new Uint8Array(decoded)); 
        else throw new Error(`Invalid base64 private key length: ${decoded.length} bytes.`);
      } catch (base64Error) {
        throw new Error(`Invalid Solana private key format.`);
      }
    }

    const fromTokenAccount = await getAssociatedTokenAddress(tokenMint, sender.publicKey);
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    const kolSolUserIds = kols.map(k => k.userId);
    const kolSolUsersMap = await UserModel.findByIds(kolSolUserIds);

    const results = [];
    for (const kol of kols) {
      const user = kolSolUsersMap.get(kol.userId);
      if (!user || !user.wallet_sol) {
        console.warn(`KOL ${kol.userId} não tem wallet_sol configurada`);
        continue;
      }

      const amountInLamports = BigInt(Math.floor(kol.amount * 10 ** decimals));
      const toPublicKey = new PublicKey(user.wallet_sol);
      const toTokenAccount = await getAssociatedTokenAddress(tokenMint, toPublicKey);

      let signature: string | undefined;
      const maxRetries = 5;
      let retryCount = 0;
      let success = false;
      let lastError: any = null;

      const isTransactionExpiredError = (error: any): boolean => {
        return error instanceof TransactionExpiredBlockheightExceededError ||
               error?.name === 'TransactionExpiredBlockheightExceededError' ||
               (error?.message && error.message.includes('block height exceeded')) ||
               (error?.message && error.message.includes('expired'));
      };

      while (retryCount < maxRetries && !success) {
        try {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          
          const transaction = new Transaction().add(
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              sender.publicKey,
              amountInLamports,
              [],
              TOKEN_PROGRAM_ID
            )
          );
          
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = sender.publicKey;
          transaction.sign(sender);

          signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            maxRetries: 0
          });

          try {
            await connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight
            }, 'confirmed');
            
            success = true;
          } catch (confirmError: any) {
            if (isTransactionExpiredError(confirmError)) {
              const txStatus = await connection.getSignatureStatus(signature);
              if (txStatus?.value?.confirmationStatus === 'confirmed' || 
                  txStatus?.value?.confirmationStatus === 'finalized') {
                success = true;
              } else {
                lastError = confirmError;
                retryCount++;
                if (retryCount < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              }
            } else {
              const txStatus = await connection.getSignatureStatus(signature);
              if (txStatus?.value?.confirmationStatus === 'confirmed' || 
                  txStatus?.value?.confirmationStatus === 'finalized') {
                success = true;
              } else {
                throw confirmError;
              }
            }
          }
        } catch (error: any) {
          lastError = error;
          if (isTransactionExpiredError(error)) {
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            } else {
              console.error(`❌ Erro ao enviar token SOL para KOL ${user.wallet_sol} após ${maxRetries} tentativas:`, error.message);
              throw error;
            }
          } else {
            console.error(`❌ Erro ao enviar token SOL para KOL ${user.wallet_sol}:`, error.message);
            throw error;
          }
        }
      }

      if (!success || !signature) {
        throw new Error(`Failed to send transaction after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      const payment = await PaymentModel.create({
        userId: kol.userId,
        campaignId: campaign_id,
        signature: signature,
        to: user.wallet_sol,
        amount: kol.amount,
        symbol,
        chain: 'solana',
        status: 'confirmed'
      });

      await CampaignParticipantsModel.updateDateReceived(kol.userId, campaign_id);
      await earnersCache.deleteByPrefix('earners:');

      results.push({ paymentId: payment._id?.toString() || '', signature: signature, to: user.wallet_sol });
    }

    return results;
  }

  private async sendTokenKolsSUI(symbol: string, campaign_id: string, kols: Array<{ userId: string; amount: number }>) {
    const client = await this.getSuiClient((RPCS as any)["sui"]);
    const tokenAddress = (TOKENS as any)["sui"][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for Sui`);

    const suiPrivateKey = process.env['SUI_PRIVATE_KEY'];
    if (!suiPrivateKey) throw new Error('SUI_PRIVATE_KEY environment variable is not set.');

    const { schema, secretKey } = decodeSuiPrivateKey(suiPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    const kolSuiUserIds = kols.map(k => k.userId);
    const kolSuiUsersMap = await UserModel.findByIds(kolSuiUserIds);

    const results = [];

    for (const kol of kols) {
      const user = kolSuiUsersMap.get(kol.userId);
      if (!user || !user.wallet_sui) {
        console.warn(`KOL ${kol.userId} não tem wallet_sui configurada`);
        continue;
      }

      try {
        const amount = Math.floor(kol.amount * 1e6);

        const tx = new TransactionBlock();
        
        if (symbol === 'USDT' || symbol === 'USDC') {
          const senderCoins = await client.getCoins({
            owner: senderAddress,
            coinType: tokenAddress,
          });
          
          if (senderCoins.data.length === 0) {
            throw new Error(`No ${symbol} tokens found in sender wallet`);
          }
          
          const coinToSplit = senderCoins.data[0];
          if (coinToSplit) {
            const [splitCoin] = tx.splitCoins(tx.object(coinToSplit.coinObjectId), [tx.pure(amount)]);
            if (splitCoin) {
              tx.transferObjects([splitCoin], tx.pure(user.wallet_sui));
            }
          }
        } else {
          const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
          if (coin) tx.transferObjects([coin], tx.pure(user.wallet_sui));
        }
        
        tx.setGasBudget(100_000_000);

        const response = await client.signAndExecuteTransactionBlock({
          signer: keypair,
          transactionBlock: tx,
          options: { showEffects: true },
        });

        const txHash = response.digest;
        const isSuccess = response.effects?.status?.status === 'success';
        const status = isSuccess ? 'confirmed' : 'failed';

        const payment = await PaymentModel.create({
          userId: kol.userId,
          campaignId: campaign_id,
          signature: txHash,
          to: user.wallet_sui,
          amount: kol.amount,
          symbol,
          chain: 'sui',
          status: status,
        });

        if (isSuccess) {
          await CampaignParticipantsModel.updateDateReceived(kol.userId, campaign_id);
          await earnersCache.deleteByPrefix('earners:');
        }

        results.push({
          paymentId: payment._id?.toString() || '',
          signature: txHash,
          to: user.wallet_sui
        });
      } catch (error: any) {
        console.error(`❌ Error sending Sui token to KOL ${user.wallet_sui}:`, error.message);
      }
    }

    return results;
  }

  private async sendTokenKolsEVM(chain: string, symbol: string, campaign_id: string, kols: Array<{ userId: string; amount: number }>) {
    const wallet = this.getWalletEVM(chain);
    const tokenAddress = (TOKENS as any)[chain][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for ${chain}`);

    const contract = new ethers.Contract(tokenAddress, ERC20ABI, wallet) as any;
    const decimals = await contract.decimals();

    const kolEvmUserIds = kols.map(k => k.userId);
    const kolEvmUsersMap = await UserModel.findByIds(kolEvmUserIds);

    const results = [];

    for (const kol of kols) {
      const user = kolEvmUsersMap.get(kol.userId);
      if (!user || !user.wallet_evm) {
        console.warn(`KOL ${kol.userId} não tem wallet_evm configurada`);
        continue;
      }

      try {
        const amountInWei = ethers.parseUnits(kol.amount.toString(), decimals);
        
        const tx = await contract.transfer(user.wallet_evm, amountInWei);
        const receipt = await tx.wait();

        const payment = await PaymentModel.create({
          userId: kol.userId,
          campaignId: campaign_id,
          signature: receipt.hash,
          to: user.wallet_evm,
          amount: kol.amount,
          symbol,
          chain: chain,
          status: 'confirmed'
        });

        await CampaignParticipantsModel.updateDateReceived(kol.userId, campaign_id);
        await earnersCache.deleteByPrefix('earners:');

        results.push({
          paymentId: payment._id?.toString() || '',
          transactionHash: receipt.hash,
          to: user.wallet_evm
        });
      } catch (error: any) {
        console.error(`❌ Error sending EVM token to KOL ${user.wallet_evm}:`, error.message);
      }
    }

    return results;
  }

  private async refundAmountToHostSOL(symbol: string, campaign_id: string, amount: number, hostWallet: string): Promise<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string; amount: number } | null> {
    const solanaRpc = (RPCS as any)["solana"];
    const connection = new Connection(solanaRpc, {
      commitment: "confirmed",
      httpHeaders: this.getRpcHeadersForUrl(solanaRpc),
    });
    const tokenMint = new PublicKey((TOKENS as any)["solana"][symbol]);

    const solanaPrivateKey = process.env['SOLANA_PRIVATE_KEY'];
    if (!solanaPrivateKey) throw new Error('SOLANA_PRIVATE_KEY environment variable is not set.');
    
    let sender: Keypair;
    
    try {
      const decoded = bs58.decode(solanaPrivateKey);
      if (decoded.length === 64) sender = Keypair.fromSecretKey(decoded);
      else if (decoded.length === 32) {
        sender = Keypair.fromSeed(decoded);
      } else throw new Error(`Invalid private key length: ${decoded.length} bytes.`);
    } catch (base58Error) {
      try {
        const decoded = Buffer.from(solanaPrivateKey, 'base64');
        if (decoded.length === 64) sender = Keypair.fromSecretKey(new Uint8Array(decoded)); 
        else throw new Error(`Invalid base64 private key length: ${decoded.length} bytes.`);
      } catch (base64Error) {
        throw new Error(`Invalid Solana private key format.`);
      }
    }

    const fromTokenAccount = await getAssociatedTokenAddress(tokenMint, sender.publicKey);
    const mintInfo = await getMint(connection, tokenMint);
    const decimals = mintInfo.decimals;

    const hostPublicKey = new PublicKey(hostWallet);
    const hostTokenAccount = await getAssociatedTokenAddress(tokenMint, hostPublicKey);

    try {
      const amountInLamports = BigInt(Math.floor(amount * 10 ** decimals));

      let signature: string | undefined;
      const maxRetries = 5;
      let retryCount = 0;
      let success = false;
      let lastError: any = null;

      const isTransactionExpiredError = (error: any): boolean => {
        return error instanceof TransactionExpiredBlockheightExceededError ||
               error?.name === 'TransactionExpiredBlockheightExceededError' ||
               (error?.message && error.message.includes('block height exceeded')) ||
               (error?.message && error.message.includes('expired'));
      };

      while (retryCount < maxRetries && !success) {
        try {
          const transferInstruction = createTransferInstruction(
            fromTokenAccount,
            hostTokenAccount,
            sender.publicKey,
            amountInLamports,
            [],
            TOKEN_PROGRAM_ID
          );

          const transaction = new Transaction().add(transferInstruction);
          const { blockhash } = await connection.getLatestBlockhash('confirmed');
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = sender.publicKey;

          signature = await sendAndConfirmTransaction(connection, transaction, [sender], {
            commitment: 'confirmed',
            maxRetries: 0
          });

          success = true;
        } catch (error: any) {
          lastError = error;
          if (isTransactionExpiredError(error) && retryCount < maxRetries - 1) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          } else {
            throw error;
          }
        }
      }

      if (!success || !signature) {
        throw new Error(`Failed to refund after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      const { PaymentRefundModel } = await import('../models/PaymentRefund');
      const refund = await PaymentRefundModel.create({
        campaign_id: campaign_id,
        signature: signature,
        to: hostWallet,
        amount: amount,
        symbol,
        chain: 'solana',
        status: 'confirmed'
      });

      await earnersCache.deleteByPrefix('earners:');

      return {
        paymentId: refund._id?.toString() || '',
        signature: signature,
        transactionHash: signature,
        to: hostWallet,
        amount: amount
      };
    } catch (error: any) {
      console.error(`❌ Error refunding Solana token amount to host:`, error.message);
      return null;
    }
  }

  private async refundAmountToHostSUI(symbol: string, campaign_id: string, amount: number, hostWallet: string): Promise<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string; amount: number } | null> {
    const client = await this.getSuiClient((RPCS as any)["sui"]);
    const tokenAddress = (TOKENS as any)["sui"][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for Sui`);

    const suiPrivateKey = process.env['SUI_PRIVATE_KEY'];
    if (!suiPrivateKey) throw new Error('SUI_PRIVATE_KEY environment variable is not set.');

    const { schema, secretKey } = decodeSuiPrivateKey(suiPrivateKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();

    try {
      const amountInSmallestUnit = Math.floor(amount * 1e6);

      const tx = new TransactionBlock();
      
      if (symbol === 'USDT' || symbol === 'USDC') {
        const senderCoins = await client.getCoins({
          owner: senderAddress,
          coinType: tokenAddress,
        });
        
        if (senderCoins.data.length === 0) {
          throw new Error(`No ${symbol} tokens found in sender wallet`);
        }
        
        const coinToSplit = senderCoins.data[0];
        if (coinToSplit) {
          const [splitCoin] = tx.splitCoins(tx.object(coinToSplit.coinObjectId), [tx.pure(amountInSmallestUnit)]);
          if (splitCoin) {
            tx.transferObjects([splitCoin], tx.pure(hostWallet));
          }
        }
      } else {
        const [coin] = tx.splitCoins(tx.gas, [tx.pure(amountInSmallestUnit)]);
        if (coin) tx.transferObjects([coin], tx.pure(hostWallet));
      }
      
      tx.setGasBudget(100_000_000);

      const response = await client.signAndExecuteTransactionBlock({
        signer: keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true
        }
      });

      const { PaymentRefundModel } = await import('../models/PaymentRefund');
      const refund = await PaymentRefundModel.create({
        campaign_id: campaign_id,
        signature: response.digest,
        to: hostWallet,
        amount: amount,
        symbol,
        chain: 'sui',
        status: 'confirmed'
      });

      await earnersCache.deleteByPrefix('earners:');

      return {
        paymentId: refund._id?.toString() || '',
        signature: response.digest,
        transactionHash: response.digest,
        to: hostWallet,
        amount: amount
      };
    } catch (error: any) {
      console.error(`❌ Error refunding Sui token amount to host:`, error.message);
      return null;
    }
  }

  private getStellarServer(): StellarSdk.Horizon.Server {
    const rpcUrl = (RPCS as any)['stellar'];
    return new StellarSdk.Horizon.Server(rpcUrl);
  }

  private getStellarKeypair(): StellarSdk.Keypair {
    const stellarKey = process.env['STELLAR_PRIVATE_KEY'];
    if (!stellarKey) throw new Error('STELLAR_PRIVATE_KEY environment variable is not set. Provide a secret key (S...) or a 12-word mnemonic.');

    const trimmed = stellarKey.trim();

    if (trimmed.startsWith('S') && trimmed.length === 56) {
      return StellarSdk.Keypair.fromSecret(trimmed);
    }

    const words = trimmed.split(/\s+/);
    if (words.length === 12 && bip39.validateMnemonic(trimmed)) {
      const seed = bip39.mnemonicToSeedSync(trimmed);
      const { key } = derivePath("m/44'/148'/0'", seed.toString('hex'));
      return StellarSdk.Keypair.fromRawEd25519Seed(key);
    }

    throw new Error('STELLAR_PRIVATE_KEY must be a Stellar secret key (starts with S, 56 chars) or a valid 12-word mnemonic phrase.');
  }

  private getStellarAsset(symbol: string): StellarSdk.Asset {
    const tokenIssuer = (TOKENS as any)['stellar'][symbol];
    if (!tokenIssuer) throw new Error(`Token ${symbol} not configured for Stellar`);
    return new StellarSdk.Asset(symbol, tokenIssuer);
  }

  public async getBalanceStellar(symbol: string, address: string): Promise<number> {
    try {
      const server = this.getStellarServer();
      const account = await server.accounts().accountId(address).call();
      const asset = this.getStellarAsset(symbol);

      for (const balance of account.balances) {
        if (
          balance.asset_type !== 'native' &&
          'asset_code' in balance &&
          'asset_issuer' in balance &&
          balance.asset_code === asset.getCode() &&
          balance.asset_issuer === asset.getIssuer()
        ) {
          return parseFloat(balance.balance);
        }
      }
      return 0;
    } catch (error: any) {
      console.error(`Error getting Stellar balance for ${symbol}:`, error.message);
      return 0;
    }
  }

  private async sendTokenStellar(symbol: string, campaign_id: string): Promise<PaymentResult[]> {
    const { participants } = await CampaignParticipantsModel.findByCampaignId(campaign_id, 1, 1000);
    const winners = participants.filter(p => p.winner === true);

    if (winners.length === 0) throw new Error('No winners found for this campaign');

    const existingPayments = await PaymentModel.findByCampaignId(campaign_id);
    const paidUserIds = new Set(existingPayments.map(p => p.userId.toString()));

    const unpaidWinners = winners.filter(winner => !paidUserIds.has(winner.userId.toString()));

    if (unpaidWinners.length === 0) {
      console.log(`All winners for campaign ${campaign_id} have already received payment`);
      return [];
    }

    console.log(`Sending Stellar payments to ${unpaidWinners.length} winners (${winners.length - unpaidWinners.length} already paid)`);

    const server = this.getStellarServer();
    const senderKeypair = this.getStellarKeypair();
    const asset = this.getStellarAsset(symbol);

    const stellarUserIds = unpaidWinners.map(w => w.userId);
    const stellarUsersMap = await UserModel.findByIds(stellarUserIds);

    const results: PaymentResult[] = [];

    for (const winner of unpaidWinners) {
      const user = stellarUsersMap.get(winner.userId);
      if (!user || !user.wallet_stellar) {
        console.warn(`⚠️ Winner ${winner.userId} does not have wallet_stellar configured, skipping payment`);
        results.push({ userId: winner.userId, wallet: '', amount: Number(winner.amount_received), status: 'skipped', error: 'wallet_stellar not configured' });
        continue;
      }

      if (!StellarSdk.StrKey.isValidEd25519PublicKey(user.wallet_stellar)) {
        console.warn(`⚠️ Winner ${winner.userId} has invalid wallet_stellar: ${user.wallet_stellar}`);
        results.push({ userId: winner.userId, wallet: user.wallet_stellar, amount: Number(winner.amount_received), status: 'skipped', error: 'invalid wallet_stellar address' });
        continue;
      }

      try {
        const amountReceived = Number(winner.amount_received);
        if (!amountReceived || amountReceived <= 0 || !isFinite(amountReceived)) {
          results.push({ userId: winner.userId, wallet: user.wallet_stellar, amount: amountReceived, status: 'skipped', error: 'invalid amount' });
          continue;
        }

        const senderAccount = await server.loadAccount(senderKeypair.publicKey());
        const fee = await server.fetchBaseFee();

        const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
          fee: String(Math.max(fee, 200)),
          networkPassphrase: StellarSdk.Networks.PUBLIC,
        })
          .addOperation(StellarSdk.Operation.payment({
            destination: user.wallet_stellar,
            asset,
            amount: amountReceived.toFixed(7),
          }))
          .setTimeout(30)
          .build();

        transaction.sign(senderKeypair);

        const response = await server.submitTransaction(transaction);
        const txHash = (response as any).hash || (response as any).id || '';

        const payment = await PaymentModel.create({
          userId: winner.userId,
          campaignId: campaign_id,
          signature: txHash,
          to: user.wallet_stellar,
          amount: amountReceived,
          symbol,
          chain: 'stellar',
          status: 'confirmed'
        });

        await CampaignParticipantsModel.updateDateReceived(winner.userId, campaign_id);
        await earnersCache.deleteByPrefix('earners:');

        results.push({ userId: winner.userId, wallet: user.wallet_stellar, amount: amountReceived, status: 'confirmed', signature: txHash, paymentId: payment._id?.toString() });
      } catch (error: any) {
        const errorMsg = error?.response?.data?.extras?.result_codes?.operations?.[0] === 'op_no_trust'
          ? `Recipient has not established a trustline for ${symbol}`
          : error.message;
        console.error(`❌ Error sending Stellar token to ${user.wallet_stellar}:`, errorMsg);
        results.push({ userId: winner.userId, wallet: user.wallet_stellar, amount: Number(winner.amount_received), status: 'failed', error: errorMsg });
      }
    }

    return results;
  }

  private async sendTokenKolsStellar(symbol: string, campaign_id: string, kols: Array<{ userId: string; amount: number }>) {
    const server = this.getStellarServer();
    const senderKeypair = this.getStellarKeypair();
    const asset = this.getStellarAsset(symbol);

    const kolUserIds = kols.map(k => k.userId);
    const kolUsersMap = await UserModel.findByIds(kolUserIds);

    const results = [];

    for (const kol of kols) {
      const user = kolUsersMap.get(kol.userId);
      if (!user || !user.wallet_stellar) {
        console.warn(`KOL ${kol.userId} does not have wallet_stellar configured`);
        continue;
      }

      if (!StellarSdk.StrKey.isValidEd25519PublicKey(user.wallet_stellar)) {
        console.warn(`KOL ${kol.userId} has invalid wallet_stellar: ${user.wallet_stellar}`);
        continue;
      }

      try {
        const senderAccount = await server.loadAccount(senderKeypair.publicKey());
        const fee = await server.fetchBaseFee();

        const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
          fee: String(Math.max(fee, 200)),
          networkPassphrase: StellarSdk.Networks.PUBLIC,
        })
          .addOperation(StellarSdk.Operation.payment({
            destination: user.wallet_stellar,
            asset,
            amount: kol.amount.toFixed(7),
          }))
          .setTimeout(30)
          .build();

        transaction.sign(senderKeypair);

        const response = await server.submitTransaction(transaction);
        const txHash = (response as any).hash || (response as any).id || '';

        const payment = await PaymentModel.create({
          userId: kol.userId,
          campaignId: campaign_id,
          signature: txHash,
          to: user.wallet_stellar,
          amount: kol.amount,
          symbol,
          chain: 'stellar',
          status: 'confirmed'
        });

        await CampaignParticipantsModel.updateDateReceived(kol.userId, campaign_id);
        await earnersCache.deleteByPrefix('earners:');

        results.push({
          paymentId: payment._id?.toString() || '',
          signature: txHash,
          to: user.wallet_stellar
        });
      } catch (error: any) {
        const errorMsg = error?.response?.data?.extras?.result_codes?.operations?.[0] === 'op_no_trust'
          ? `Recipient has not established a trustline for ${symbol}`
          : error.message;
        console.error(`❌ Error sending Stellar token to KOL ${user.wallet_stellar}:`, errorMsg);
      }
    }

    return results;
  }

  private async refundAmountToHostStellar(symbol: string, campaign_id: string, amount: number, hostWallet: string): Promise<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string; amount: number } | null> {
    const server = this.getStellarServer();
    const senderKeypair = this.getStellarKeypair();
    const asset = this.getStellarAsset(symbol);

    try {
      if (!StellarSdk.StrKey.isValidEd25519PublicKey(hostWallet)) {
        throw new Error(`Invalid Stellar host wallet address: ${hostWallet}`);
      }

      const senderAccount = await server.loadAccount(senderKeypair.publicKey());
      const fee = await server.fetchBaseFee();

      const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: String(Math.max(fee, 200)),
        networkPassphrase: StellarSdk.Networks.PUBLIC,
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: hostWallet,
          asset,
          amount: amount.toFixed(7),
        }))
        .setTimeout(30)
        .build();

      transaction.sign(senderKeypair);

      const response = await server.submitTransaction(transaction);
      const txHash = (response as any).hash || (response as any).id || '';

      const { PaymentRefundModel } = await import('../models/PaymentRefund');
      const refund = await PaymentRefundModel.create({
        campaign_id: campaign_id,
        signature: txHash,
        to: hostWallet,
        amount: amount,
        symbol,
        chain: 'stellar',
        status: 'confirmed'
      });

      await earnersCache.deleteByPrefix('earners:');

      return {
        paymentId: refund._id?.toString() || '',
        signature: txHash,
        transactionHash: txHash,
        to: hostWallet,
        amount: amount
      };
    } catch (error: any) {
      console.error(`❌ Error refunding Stellar token amount to host:`, error.message);
      return null;
    }
  }

  private async validateStellarTransaction(taxId: string, _rpcUrl: string, expectedAmount: number): Promise<boolean> {
    const maxRetries = 5;
    const retryDelay = 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const server = this.getStellarServer();
        const transaction = await server.transactions().transaction(taxId).call();

        if (!(transaction as any).successful) return false;

        const operations = await server.operations().forTransaction(taxId).limit(200).call();

        let totalTransferred = 0;
        let validDestination = false;
        const destinationWallet = WALLETS_DESTINATION.stellar;

        const stellarTokens = (TOKENS as any)['stellar'] || {};
        const validIssuers = new Set(Object.values(stellarTokens) as string[]);

        for (const op of operations.records) {
          if (op.type === 'payment') {
            const paymentOp = op as any;
            if (
              paymentOp.to === destinationWallet &&
              paymentOp.asset_type !== 'native' &&
              validIssuers.has(paymentOp.asset_issuer)
            ) {
              validDestination = true;
              totalTransferred += parseFloat(paymentOp.amount);
            }
          }
        }

        return validDestination && Math.abs(totalTransferred - expectedAmount) < 0.01;
      } catch (error: any) {
        const isRetryable =
          error?.response?.status === 404 ||
          error?.response?.status >= 500 ||
          error?.message?.toLowerCase?.().includes('timeout') ||
          error?.message?.toLowerCase?.().includes('network');

        if (isRetryable && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        console.error('[validateStellarTransaction] error:', { attempt, message: error?.message });
        return false;
      }
    }

    return false;
  }

  private async refundAmountToHostEVM(chain: string, symbol: string, campaign_id: string, amount: number, hostWallet: string): Promise<{ paymentId?: string | any; signature?: string; to: string; transactionHash?: string; amount: number } | null> {
    const wallet = this.getWalletEVM(chain);
    const tokenAddress = (TOKENS as any)[chain][symbol];
    if (!tokenAddress) throw new Error(`Token ${symbol} not configured for ${chain}`);

    const contract = new ethers.Contract(tokenAddress, ERC20ABI, wallet) as any;
    const decimals = await contract.decimals();

    try {
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);
      
      const tx = await contract.transfer(hostWallet, amountInWei);
      const receipt = await tx.wait();

      const { PaymentRefundModel } = await import('../models/PaymentRefund');
      const refund = await PaymentRefundModel.create({
        campaign_id: campaign_id,
        signature: receipt.hash,
        to: hostWallet,
        amount: amount,
        symbol,
        chain: chain,
        status: 'confirmed'
      });

      await earnersCache.deleteByPrefix('earners:');

      return {
        paymentId: refund._id?.toString() || '',
        transactionHash: receipt.hash,
        to: hostWallet,
        amount: amount
      };
    } catch (error: any) {
      console.error(`❌ Error refunding EVM token amount to host:`, error.message);
      return null;
    }
  }
}
