# NIDO — Solana Incubator (Cohort 4) Application Draft

> Apply at: https://incubator.solanalabs.com/apply · Deadline: June 5 (rolling, early prioritized)
> Builder: Gustavo Fontes (`f0ntz`) · fontzweb3@gmail.com · Brazil
> Positioning: **Production B2B creator-economy payments platform expanding to Solana**, with native stablecoin settlement (BRL/USDC) and PIX on/off ramp for LatAm.

---

## 0. One-liner

**NIDO is a B2B platform that connects brands and agencies to creators and KOLs, with trustless, non-custodial escrow as the payment rail. We already run in production with 500+ users and real brands — and we're expanding our settlement layer to Solana to make creator payouts instant, cheap, and locally cashable through stablecoins and PIX on/off ramp in Latin America.**

---

## 1. Company / Project

- **Name:** NIDO
- **Website:** https://bounties.work (rebranding to NIDO in progress)
- **One-line pitch:** Trustless escrow + instant stablecoin payouts for the creator economy, B2B-first, built for Latin America.
- **Stage:** Live in production (public beta), real brands paying real creators in USDC. Expanding to Solana.
- **Location / Team base:** Brazil. Willing to relocate to NYC for the 3-month program.

---

## 2. What does NIDO do?

NIDO is a B2B SaaS where brands, agencies and exchanges (*Hosts*) launch marketing campaigns and pay content creators and KOLs (*Talents*). The hard part of this market is **trust on both sides**: agencies lock capital and fear non-delivery; creators deliver and don't get paid.

NIDO solves this with a **trustless, non-custodial escrow**: the brand's money is locked on-chain before the work starts, the creator is paid automatically on approval, and if the deadline passes with no delivery the brand is automatically refunded — without NIDO ever holding the funds. The blockchain layer is invisible to the user: no gas, no native token to hold, Web2-grade UX.

On top of the payment rail we run the full campaign workflow: submissions, leaderboards, winner selection, **Communities** (brands run exclusive groups with creators — announcements, group chat, members-only campaigns), profiles and social integrations.

---

## 3. The problem

- Influencer/creator marketing is a multi-billion-dollar market that still runs on **broken trust and slow, expensive cross-border payments**.
- Existing on-chain answers (custom EVM escrow contracts) fix trust but add **high gas, crypto friction and operational complexity** that Web2-first B2B clients won't absorb.
- In **Latin America specifically**, creators are paid late, in dollars they can't easily spend, through rails that take days and bleed fees. There is no smooth path from "brand budget" to "BRL in the creator's bank account."

---

## 4. The solution & why now

NIDO abstracts crypto entirely:
- **Trustless escrow** — funds locked on-chain, multisig, non-custodial. NIDO is a neutral arbiter, never a custodian (lower regulatory surface).
- **Zero-friction UX** — the user never holds the native token or pays network fees; the platform sponsors them.
- **Protocol-enforced refunds** — brand capital is protected by the chain, not by a platform promise.
- **Instant settlement** — creators receive stablecoins in seconds, auditable on-chain.

**Why now / why Solana:** to make this a true global-and-local payments product we need **fast finality, sub-cent fees, deep stablecoin liquidity, and real on/off ramps**. That's Solana. Expanding our settlement layer to Solana lets us pay creators instantly at near-zero cost AND close the loop with **local stablecoins (BRL) + PIX on/off ramp**, so a brand's budget becomes spendable money in a Brazilian creator's pocket in minutes.

---

## 5. Traction (already in production — not a pre-launch idea)

| Metric | Value |
|---|---|
| Users | 500+ |
| Active creators | 300+ |
| KOLs reached | 200+ |
| Brands running campaigns (Hosts) | JET Latam, CoinW, Venus Protocol, MEXC, Rapidz, BH OnChain, TokenNation |
| Real USDC payouts to creators | Recurring (top payouts: $500, $280, $271, $210, $186) |
| Revenue model live | SaaS plans (BASIC/CORE/ENTERPRISE) + 0.5% fee on settled volume |
| Escrow proof | Full trustless escrow lifecycle live on mainnet (funding, release, dispute, refund), 409 automated tests |
| Multichain today | Payments already support Solana, plus EVM (Ethereum/Arbitrum/Base/Polygon) and Sui |

NIDO is **not an MVP chasing a market** — it's a product in production, with validated B2B demand and brands paying creators. Solana is an infrastructure upgrade on a working business.

---

## 6. Why we're expanding to Solana (the thesis)

We're not migrating chains — we're **bringing everything we already have to Solana** and making Solana our primary settlement and on/off-ramp layer:

1. **Settlement on Solana** — port the escrow + payout rail to Solana for instant (~400ms), sub-cent creator payouts at scale.
2. **Stablecoin-native payouts** — USDC today, and **BRL stablecoins (e.g. BRZ) on Solana** so LatAm creators are paid in a currency they actually use.
3. **On/off ramp (PIX)** — integrate Solana-native ramps so the full loop works: brand funds in USDC → escrow on Solana → creator paid in BRL stablecoin → **PIX cash-out to a Brazilian bank in minutes**. This is the missing piece for real-world creator adoption in Brazil and LatAm.
4. **Cross-chain funding already supports Solana** (Circle CCTP), so brands holding USDC on Solana can fund campaigns natively today — we extend this both ways.
5. **Solana wallet stack already integrated** in our frontend (Phantom / wallet-adapter) — the client groundwork is done.

**Interest in Solana Mobile / GameShift:** Yes — Solana Mobile is a natural distribution channel for a creator-facing payouts app (creators are mobile-first); a Seeker/dApp Store presence and seed-vault-grade UX fit our roadmap. Open to exploring GameShift for in-app asset/reward flows.

---

## 7. Business model

- **0.5% fee** on stablecoin volume settled through escrow (live on mainnet today).
- **SaaS plans** — BASIC / CORE / ENTERPRISE (live).
- **Per-campaign fee** for brands.
- Expansion adds **ramp/FX spread** on the on/off-ramp (BRL ⇄ USDC ⇄ creator).

---

## 8. Team

A team that lived the problem and has the stack to solve it. 4 co-founders, shipping a product already live in production:

- **Daniel Figueiredo** ("Dollar") — **CEO / Growth.** 6+ years in the creator economy; built operations connecting brands to creators at scale. Founded NIDO after living the pain of international payments and creator management firsthand.
- **Gustavo Fontes** (`f0ntz`) — **Lead Blockchain Engineer.** Blockchain architecture for global payments — multisig, escrow, secure settlement. Shipped the trustless escrow to mainnet; active in the Solana hackathon (June 2026). fontzweb3@gmail.com
- **Alexandre Tavano Cardoso** ("Tavano") — **CTO.** Full-stack engineer, 6 years; built the API that powers the platform.
- **Rômulo do Prado** ("DeaG") — **CPO.** Product and front-end; translates vision into interface and mobile development.
- **Backed by / built under:** ParaBuilders (NIDO is a ParaBuilders Web3 venture focused on training and connecting talent to the decentralized ecosystem). Brand identity by DOTS.

> Note: add LinkedIn/X/GitHub per founder if the form asks.

---

## 9. Funding status

- Bootstrapped + program-supported. Currently in the **37 Graus (NearX/SDF)** builder track; preparing an SCF Build Award request (~$70k) for the escrow module.
- *(State here any raise to date, or "no institutional raise yet — revenue-generating.")*

---

## 10. Biggest challenges right now (be honest — they ask for this)

1. **Distribution / GTM beyond our existing brand base** — we have demand and brands, but converting that into high-volume on-chain settlement and acquiring net-new brands at scale is the gap.
2. **The last-mile cash-out** — solving BRL on/off ramp + compliance so creators get local money frictionlessly is what unlocks real retention; we want help nailing the ramp partners and regulatory posture.
3. **Fundraising** — turning a revenue-generating LatAm product into a venture-scale story for US investors.

---

## 11. What we want from the Incubator

- **Solana-native technical depth** — port our settlement layer to Solana correctly (programs, token-2022 / stablecoins, payment UX, Solana Mobile).
- **Ramp + stablecoin intros** — connect us to Solana on/off-ramp and BRL-stablecoin partners (the loop that makes creator payouts real in LatAm).
- **GTM + fundraising** — sharpen the go-to-market and get in front of the right investors during the NYC program.
- **Brand / network** — leverage the Solana ecosystem to convert our existing B2B pipeline into on-chain volume.

---

## 12. Links to attach

- Investor/tech doc: `docs/NIDO_INVESTOR_TECH_DOC.md` (export the PDF/HTML version in the same folder)
- Demo videos: `nido-stellar.mp4`, `nido-stellar-testnet.mp4` (record a 60-90s Solana-angled demo if time allows)
- Live product: https://bounties.work
- Repos: github.com/Paradevs1/nido-api · github.com/Paradevs1/nido-front
- Brand book: `Manual ID Nido.pdf`

---

*Draft generated 2026-06-04 for the June 5 deadline. Fill the TODOs (team, funding, exact form fields) before submitting.*
