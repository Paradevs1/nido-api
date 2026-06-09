# NIDO — Solana Incubator (Cohort 4) — Field-by-field answers

> Form: https://incubator.solanalabs.com/apply · Deadline June 5 · English
> 🔴 = fill with real data before submitting.

---

## 1. Company Background

**Company name:** NIDO

**Your name:** Gustavo Fontes
*(or Daniel Figueiredo if he submits as CEO)*

**Your email:** fontzweb3@gmail.com 🔴 *(use the submitter's email)*

**Your Telegram username:** 🔴

**Describe what your company does or makes** (400 max):
> NIDO is a B2B platform connecting brands and agencies to creators and KOLs, with trustless, non-custodial escrow as the payment rail. Brands lock funds on-chain before work starts; creators are paid automatically in stablecoins on approval, or auto-refunded if nothing is delivered. Live in production with 500+ users and real brands paying creators.

**Company website URL:** https://bounties.work *(rebranding to NIDO)*

**Company Twitter / X account URL:** https://x.com/bountiesdotwork

**Investor / company presentation URL:** 🔴 *(host NIDO_INVESTOR_TECH_DOC as a public link / deck)*

**Product demo URL:** 🔴 *(upload nido-stellar.mp4 to YouTube/Loom, or live: https://bounties.work)*

**Tell us about yourself and your cofounders** (how you know each other, for how long, who is technical, role):
> We're 4 cofounders who've been working together since 2025, and we lived the problem we're solving. Three of us are technical, one is the operator who felt the pain firsthand:
> • Daniel Figueiredo ("Dollar") — CEO / Growth (non-technical). 6+ years in the creator economy running brand campaigns and international creator payouts at scale; founded NIDO after living the pain of locked capital, late cross-border payments and FX losses from the inside.
> • Gustavo Fontes — Lead Blockchain Engineer & DevRel (technical). Built our trustless, non-custodial escrow — multisig, secure settlement — and shipped it to mainnet. Active in the Solana ecosystem: mentored Brazilian teams for the Solana Frontier hackathon and is building in the Solana hackathon (June 2026).
> • Alexandre Tavano Cardoso ("Tavano") — CTO (technical). Full-stack engineer with 6 years' experience; built the API that powers the platform.
> • Rômulo do Prado ("DeaG") — CPO (technical/product). Owns product, front-end and mobile — turns the vision into the interface creators and brands actually use.
> We met through the LatAm Web3 builder community and have shipped NIDO to production together since 2025. 🔴 *(confirm how you met)*

**When did you begin working on your company?** 2025

**Are you all working full-time on this?** 🔴
> *If yes:* Yes, full-time since ___. *If no:* ___ are full-time; ___ part-time because ___.

**How many full-time employees / contractors (incl. cofounders):** 4 🔴 *(add any contractors)*

**Web3 / Solana development experience:**
> Yes. Our blockchain lead and CTO built and shipped a full trustless-escrow payment system to mainnet: multisig 2-of-3, sponsored fees, pre-authorized time-bound transactions, and cross-chain USDC funding via Circle CCTP — including Solana as a source chain. The frontend already integrates Solana wallets (Phantom / wallet-adapter) and SPL token flows. Gustavo is building in the Solana hackathon (June 2026). We're proficient across Solana web3.js / SPL; ramping Rust/Anchor for native Solana programs as part of this expansion.

**Blockchain selection:**
> We have a live multichain product (EVM, Solana, Sui) and we're making **Solana our primary settlement and on/off-ramp layer**. We're expanding everything we already built to Solana — escrow + instant stablecoin payouts — because we need fast finality, sub-cent fees and deep stablecoin liquidity to pay creators at scale.

**1 minute intro video:** 🔴 *(record founders + why Solana — Loom/YouTube)*

---

## 2. Idea

**What is the problem / how are you solving it?** (600 max):
> Creator/influencer marketing runs on broken trust and slow, costly cross-border payments. Agencies lock capital and fear non-delivery; creators deliver and get paid late or never. On-chain fixes (custom EVM escrow) add high gas and crypto friction Web2 brands won't absorb. In LatAm there's no smooth path from a brand's budget to spendable local money in a creator's bank. We solve it with trustless, non-custodial escrow: funds locked on-chain, instant stablecoin payout on approval, protocol-enforced auto-refund — with zero gas/crypto friction for the user.

**What drove you to this idea? How do you know there's a burning need?** (600 max):
> Our CEO Daniel spent 6+ years in the creator economy managing brand campaigns and international creator payouts — he lived the pain: capital locked with delivery risk, creators paid late across borders, fees and FX bleeding margins. We built NIDO to fix exactly that. The need is proven, not assumed: 500+ users, 300+ creators, and real brands (JET Latam, CoinW, Venus, MEXC) already run campaigns and pay creators in USDC through us — demand we didn't have to manufacture.

**Founder-market fit. Why are you the right team?** (600 max):
> We lived the problem and have the stack to solve it. Daniel (CEO) — 6+ yrs creator economy, ran brand↔creator ops at scale. Gustavo (Lead Blockchain Eng) — built the trustless escrow (multisig, secure settlement) and shipped it to mainnet. Tavano (CTO) — full-stack, 6 yrs, built the API powering the platform. Rômulo (CPO) — product, front-end, mobile. A non-technical operator who felt the pain plus three engineers who already shipped a paying product to production — not a research project.

**How does your product use Solana?** (600 max):
> We're expanding our live settlement layer to Solana to make creator payouts instant (~400ms) and sub-cent at scale. USDC today; we're adding BRL stablecoins on Solana so LatAm creators get paid in money they actually use, plus PIX on/off ramp to close the loop: brand funds USDC → escrow on Solana → creator paid in BRL stablecoin → cash-out to a Brazilian bank in minutes. We already integrate Solana wallets (Phantom/wallet-adapter) and can fund the rail cross-chain from Solana via Circle CCTP.

**Competition, and what you understand that they don't?** (600 max):
> Competitors: creator-marketing SaaS (no on-chain settlement, slow fiat payouts) and crypto payout tools / custom escrow (custodial or high-friction, no local cash-out). What we understand that they don't: the bottleneck isn't the campaign tool — it's the last mile of getting brand budget into a creator's local bank trustlessly. We pair trustless, non-custodial escrow with stablecoin + PIX on/off ramp for LatAm, abstracting crypto entirely. And we're not chasing a market — brands already pay creators through us today.

**Path to $10M ARR? What needs to be true?** (600 max):
> $10M ARR ≈ ~$2B settled volume at our 0.5% fee, plus SaaS plans and ramp/FX spread. What must be true: convert our existing brand base (JET Latam, CoinW, Venus, MEXC) and 300+ creators to on-chain settlement; ship Solana settlement + BRL stablecoin + PIX ramp so payout and cash-out are frictionless; expand across LatAm where the cross-border pain is sharpest. The ramp/FX spread adds a second revenue line on every payout, so revenue scales with creator volume — not just brand count.

**Mobile? Interested in Solana Mobile?**
> Yes. Creators are mobile-first, so a great mobile payout/cash-out experience is core to our roadmap — we'd be very interested in working with the Solana Mobile team (Seeker / dApp Store distribution, seed-vault UX for non-custodial signing).

---

## 3. Traction

**How far along are you?**
> Live in production (public beta). Full trustless-escrow lifecycle running on mainnet — funding, release, dispute, refund — backed by 409 automated tests. Real brands run campaigns and pay creators in USDC today. Now expanding the settlement layer to Solana + BRL stablecoin + PIX ramp.

**Active users:**
> 500+ users, 300+ active creators, 200+ KOLs reached. Brands running campaigns: JET Latam, CoinW, Venus Protocol, MEXC, Rapidz, BH OnChain, TokenNation. 🔴 *(add the last-6-months growth figure if you have it)*

**Revenue:**
> Yes — two live lines: SaaS plans (BASIC/CORE/ENTERPRISE) and a 0.5% fee on stablecoin volume settled through escrow, plus per-campaign fees. 🔴 *(state real MRR/monthly revenue and 6-month growth)*

**How much money have you raised to date?** 🔴
> *(e.g., "$0 — bootstrapped and revenue-generating" OR list rounds/investors/valuation/date. Mention 37 Graus / NearX–SDF support and the pending ~$70k SCF Build Award if relevant.)*

**How long is your runway?** 🔴 *(months)*

---

## 4. Incubator Support

**Magic wand — what should the Incubator do for you?** (priority order):
> 1. Solana-native technical depth — port our settlement layer to Solana correctly (programs/Anchor, SPL/Token-2022 stablecoins, payment UX, Solana Mobile).
> 2. Stablecoin + on/off-ramp intros — connect us to BRL-stablecoin issuers and Solana on/off-ramp / PIX partners (the loop that makes creator payouts real in LatAm), plus compliance guidance.
> 3. GTM + fundraising — sharpen go-to-market and get in front of the right investors during the NYC program.
> 4. Ecosystem brand + network — convert our existing B2B pipeline into on-chain volume via the Solana ecosystem.

**Willing to relocate to NYC for 3 months (from March 2026)? From where?**
> Yes. 🔴 *(list each founder's city, e.g., "All four relocating from Brazil — ___, ___, ___, ___.")*

**Ecosystem reference:** 🔴
> *(Honest answer. If you have a Solana Foundation / Superteam Brazil / Anza contact, name them. If not: "Not yet directly; Gustavo is active in the Solana hackathon (June 2026) and the LatAm builder community.")*

**Single most noteworthy fact** (300 max):
> We're not pre-launch: NIDO is live in production with 500+ users and real brands — JET Latam, CoinW, Venus, MEXC — already paying creators in USDC through our trustless escrow on mainnet. Solana is an infra upgrade on a revenue-generating business, not a bet.

**Applied to a previous cohort?** No. 🔴 *(confirm)*

**How did you hear about the Incubator?** Twitter/X (@incubator).
