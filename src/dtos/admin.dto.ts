/**
 * DTOs para endpoints administrativos
 */

// Tipos de origem dos pagamentos
export type PaymentSource = 'Winners' | 'Active Campaign' | 'Refunds' | 'Plans';

// Status possíveis dos pagamentos
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'error';

// Interface base para pagamento enriquecido com informações adicionais
export interface AdminPaymentItem {
  id: string;
  source: PaymentSource;
  created_at: Date;
  updated_at: Date;
  status: PaymentStatus;
  
  // Informações do usuário (quando disponível)
  user_name?: string;
  company_name?: string;
  
  // Informações da campanha (quando disponível)
  campaign_name?: string;
  
  // Campos específicos por tipo de pagamento
  
  // Para Winners (source: 'Winners')
  userId?: string;
  campaignId?: string;
  signature?: string;
  to?: string;
  amount?: number;
  chain?: string;
  symbol?: string;
  
  // Para Active Campaign (source: 'Active Campaign')
  hostId?: string;
  walletAddressHost?: string;
  
  // Para Refunds (source: 'Refunds')
  campaign_id?: string;
  
  // Para Plans (source: 'Plans')
  plan_id?: string;
  user_id?: string;
  tax?: string;
  date?: Date;
}

// Resposta da lista de pagamentos
export interface AdminPaymentsListResponse {
  payments: AdminPaymentItem[];
  total: number;
  page: number;
  totalPages: number;
}
