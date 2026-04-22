/**
 * Tests for CAC (Cost per Acquisition) calculation logic.
 *
 * Formula: (conversions / quantity_conversion) * amount_convertion
 * Capped by limit_amount_convertion when defined.
 */

interface CacCampaign {
  is_cac: boolean;
  format_cac: 'clicks' | 'view';
  quantity_conversion: number;
  amount_convertion: number;
  limit_amount_convertion?: number;
  list_kols?: Array<{ userId: string; amount: number }>;
  total_prize_pool?: number;
}

function calculateCacAmount(
  conversions: number,
  campaign: CacCampaign
): number {
  const quantityConversion = campaign.quantity_conversion || 1;
  let amount = (conversions / quantityConversion) * campaign.amount_convertion;
  if (campaign.limit_amount_convertion && amount > campaign.limit_amount_convertion) {
    amount = campaign.limit_amount_convertion;
  }
  return amount;
}

/** Mirrors leaderboard-submits views_instagram aggregation */
function aggregateInstagramViews(views_instagram: number, views_instagram_story: number): number {
  return (views_instagram || 0) + (views_instagram_story || 0);
}

/** Mirrors refund logic from PaymentService.paymentKolsSelective */
function calculateRefund(
  campaign: CacCampaign,
  totalSentToUsers: number
): number {
  let totalPaid = 0;
  if (campaign.is_cac && campaign.list_kols && campaign.limit_amount_convertion)
    totalPaid = campaign.list_kols.length * campaign.limit_amount_convertion;
  else
    totalPaid = campaign.total_prize_pool || 0;

  return Math.max(totalPaid - totalSentToUsers, 0);
}

// ──────────────────────────────────────────────
// Campanha 1 — format_cac: view
// $10 / 2000 views, limit $100
// ──────────────────────────────────────────────
describe('CAC Calculation - Campaign 1 (view)', () => {
  const campaign: CacCampaign = {
    is_cac: true,
    format_cac: 'view',
    quantity_conversion: 2000,
    amount_convertion: 10,
    limit_amount_convertion: 100,
  };

  it('should calculate total views correctly (500+250+750+5000 = 6500)', () => {
    const views_twitter = 500;
    const views_instagram = 250; // instagram + instagram_story
    const views_tiktok = 750;
    const views_youtube = 5000;
    const totalViews = views_twitter + views_instagram + views_tiktok + views_youtube;

    expect(totalViews).toBe(6500);
  });

  it('should calculate amount for 6500 views → (6500/2000)*10 = $32.50', () => {
    const amount = calculateCacAmount(6500, campaign);
    expect(amount).toBe(32.5);
  });

  it('should cap at limit_amount_convertion ($100) when views are very high', () => {
    // 25000 views → (25000/2000)*10 = $125 → capped at $100
    const amount = calculateCacAmount(25000, campaign);
    expect(amount).toBe(100);
  });

  it('should return $0 when conversions are 0', () => {
    const amount = calculateCacAmount(0, campaign);
    expect(amount).toBe(0);
  });

  it('should handle exactly at the limit → (20000/2000)*10 = $100', () => {
    const amount = calculateCacAmount(20000, campaign);
    expect(amount).toBe(100);
  });

  it('should calculate per-platform amounts', () => {
    expect(calculateCacAmount(500, campaign)).toBe(2.5);    // twitter
    expect(calculateCacAmount(250, campaign)).toBe(1.25);   // instagram
    expect(calculateCacAmount(750, campaign)).toBe(3.75);   // tiktok
    expect(calculateCacAmount(5000, campaign)).toBe(25);    // youtube
  });
});

// ──────────────────────────────────────────────
// Campanha 2 — format_cac: click
// $100 / 50 clicks, limit $1000
// ──────────────────────────────────────────────
describe('CAC Calculation - Campaign 2 (clicks)', () => {
  const campaign: CacCampaign = {
    is_cac: true,
    format_cac: 'clicks',
    quantity_conversion: 50,
    amount_convertion: 100,
    limit_amount_convertion: 1000,
  };

  it('should calculate amount for 85 clicks → (85/50)*100 = $170', () => {
    const amount = calculateCacAmount(85, campaign);
    expect(amount).toBe(170);
  });

  it('should cap at limit ($1000) when clicks are very high', () => {
    // 600 clicks → (600/50)*100 = $1200 → capped at $1000
    const amount = calculateCacAmount(600, campaign);
    expect(amount).toBe(1000);
  });

  it('should return $0 when clicks are 0', () => {
    const amount = calculateCacAmount(0, campaign);
    expect(amount).toBe(0);
  });

  it('should handle exactly at the limit → (500/50)*100 = $1000', () => {
    const amount = calculateCacAmount(500, campaign);
    expect(amount).toBe(1000);
  });

  it('should handle small amounts → 1 click → (1/50)*100 = $2', () => {
    const amount = calculateCacAmount(1, campaign);
    expect(amount).toBe(2);
  });
});

// ──────────────────────────────────────────────
// Multiple KOLs — ranking and mixed results
// ──────────────────────────────────────────────
describe('CAC Calculation - Multiple KOLs', () => {
  const campaign: CacCampaign = {
    is_cac: true,
    format_cac: 'view',
    quantity_conversion: 1000,
    amount_convertion: 20,
    limit_amount_convertion: 150,
    list_kols: [
      { userId: 'kol1', amount: 0 },
      { userId: 'kol2', amount: 0 },
      { userId: 'kol3', amount: 0 },
    ],
  };

  it('should calculate different amounts per KOL based on their conversions', () => {
    const kol1Conversions = 3000;  // (3000/1000)*20 = $60
    const kol2Conversions = 10000; // (10000/1000)*20 = $200 → cap $150
    const kol3Conversions = 500;   // (500/1000)*20 = $10

    expect(calculateCacAmount(kol1Conversions, campaign)).toBe(60);
    expect(calculateCacAmount(kol2Conversions, campaign)).toBe(150);
    expect(calculateCacAmount(kol3Conversions, campaign)).toBe(10);
  });

  it('should rank KOLs by conversions (highest first)', () => {
    const kols = [
      { userId: 'kol1', conversions: 3000 },
      { userId: 'kol2', conversions: 10000 },
      { userId: 'kol3', conversions: 500 },
    ];

    const ranked = [...kols].sort((a, b) => b.conversions - a.conversions);

    expect(ranked[0]!.userId).toBe('kol2');  // 10000
    expect(ranked[1]!.userId).toBe('kol1');  // 3000
    expect(ranked[2]!.userId).toBe('kol3');  // 500
  });

  it('should sum total paid across all KOLs', () => {
    const amounts = [60, 150, 10]; // kol1, kol2 (capped), kol3
    const totalSent = amounts.reduce((sum, a) => sum + a, 0);
    expect(totalSent).toBe(220);
  });
});

// ──────────────────────────────────────────────
// Views aggregation (leaderboard-submits)
// ──────────────────────────────────────────────
describe('Views Aggregation - Instagram + Story', () => {
  it('should sum instagram and instagram_story', () => {
    expect(aggregateInstagramViews(200, 50)).toBe(250);
  });

  it('should handle 0 instagram views', () => {
    expect(aggregateInstagramViews(0, 300)).toBe(300);
  });

  it('should handle 0 story views', () => {
    expect(aggregateInstagramViews(400, 0)).toBe(400);
  });

  it('should handle both 0', () => {
    expect(aggregateInstagramViews(0, 0)).toBe(0);
  });

  it('should handle undefined/null as 0 (falsy)', () => {
    expect(aggregateInstagramViews(undefined as any, 100)).toBe(100);
    expect(aggregateInstagramViews(null as any, null as any)).toBe(0);
  });
});

// ──────────────────────────────────────────────
// Refund calculation
// ──────────────────────────────────────────────
describe('Refund Calculation - CAC campaigns', () => {
  it('should calculate refund as (kols * limit) - totalSent for CAC with limit', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'view',
      quantity_conversion: 1000,
      amount_convertion: 20,
      limit_amount_convertion: 150,
      list_kols: [
        { userId: 'kol1', amount: 0 },
        { userId: 'kol2', amount: 0 },
        { userId: 'kol3', amount: 0 },
      ],
    };
    // totalPaid = 3 kols * $150 limit = $450
    // totalSent = $220 (from multiple KOLs test above)
    // refund = $450 - $220 = $230
    expect(calculateRefund(campaign, 220)).toBe(230);
  });

  it('should return 0 refund when all limit is used', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'clicks',
      quantity_conversion: 50,
      amount_convertion: 100,
      limit_amount_convertion: 1000,
      list_kols: [
        { userId: 'kol1', amount: 0 },
      ],
    };
    // totalPaid = 1 * $1000 = $1000, totalSent = $1000
    expect(calculateRefund(campaign, 1000)).toBe(0);
  });

  it('should fallback to total_prize_pool when CAC has no limit', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'view',
      quantity_conversion: 1000,
      amount_convertion: 20,
      list_kols: [
        { userId: 'kol1', amount: 0 },
        { userId: 'kol2', amount: 0 },
      ],
      total_prize_pool: 500,
    };
    // no limit → falls to total_prize_pool = $500
    // totalSent = $300
    // refund = $500 - $300 = $200
    expect(calculateRefund(campaign, 300)).toBe(200);
  });

  it('should not return negative refund', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'clicks',
      quantity_conversion: 10,
      amount_convertion: 50,
      limit_amount_convertion: 100,
      list_kols: [{ userId: 'kol1', amount: 0 }],
    };
    // totalPaid = 1 * $100 = $100, totalSent = $120 (overpaid edge case)
    expect(calculateRefund(campaign, 120)).toBe(0);
  });
});

// ──────────────────────────────────────────────
// Edge cases
// ──────────────────────────────────────────────
describe('CAC Calculation - Edge Cases', () => {
  it('should not cap when limit_amount_convertion is undefined', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'view',
      quantity_conversion: 1000,
      amount_convertion: 50,
    };
    // 10000 views → (10000/1000)*50 = $500, no cap
    const amount = calculateCacAmount(10000, campaign);
    expect(amount).toBe(500);
  });

  it('should fallback quantity_conversion to 1 when 0', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'clicks',
      quantity_conversion: 0,
      amount_convertion: 10,
      limit_amount_convertion: 100,
    };
    // 5 clicks → (5/1)*10 = $50
    const amount = calculateCacAmount(5, campaign);
    expect(amount).toBe(50);
  });

  it('should handle fractional results correctly', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'view',
      quantity_conversion: 3,
      amount_convertion: 10,
    };
    // 1 view → (1/3)*10 = 3.333...
    const amount = calculateCacAmount(1, campaign);
    expect(amount).toBeCloseTo(3.33, 2);
  });

  it('should handle quantity_conversion = 1 (1:1 ratio)', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'clicks',
      quantity_conversion: 1,
      amount_convertion: 5,
      limit_amount_convertion: 50,
    };
    // 8 clicks → (8/1)*5 = $40
    expect(calculateCacAmount(8, campaign)).toBe(40);
    // 15 clicks → (15/1)*5 = $75 → capped at $50
    expect(calculateCacAmount(15, campaign)).toBe(50);
  });

  it('should handle very large conversion numbers', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'view',
      quantity_conversion: 1000000,
      amount_convertion: 100,
      limit_amount_convertion: 500,
    };
    // 5M views → (5000000/1000000)*100 = $500 → exactly at limit
    expect(calculateCacAmount(5000000, campaign)).toBe(500);
    // 6M views → $600 → capped $500
    expect(calculateCacAmount(6000000, campaign)).toBe(500);
  });

  it('should handle conversions less than quantity_conversion (sub-unit)', () => {
    const campaign: CacCampaign = {
      is_cac: true,
      format_cac: 'clicks',
      quantity_conversion: 100,
      amount_convertion: 50,
    };
    // 1 click → (1/100)*50 = $0.50
    expect(calculateCacAmount(1, campaign)).toBe(0.5);
    // 10 clicks → (10/100)*50 = $5
    expect(calculateCacAmount(10, campaign)).toBe(5);
  });
});
