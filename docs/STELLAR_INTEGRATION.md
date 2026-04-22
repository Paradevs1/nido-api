# Stellar Chain Integration - Frontend Guide

## Overview

Stellar was added as a new payment chain alongside the existing EVM, Solana, and Sui chains. The chain identifier is `"stellar"` and the supported token is **USDC**.

- **Chain name:** `stellar`
- **Token:** `USDC`
- **Token issuer (classic asset):** `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
- **Wallet format:** Stellar public key starting with `G`, 56 characters (e.g., `GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC`)
- **Destination wallet (platform):** env `WALLET_DESTINATION_STELLAR`

---

## API Changes

### 1. Wallet Management

#### Insert/Update Stellar Wallet

**POST** `/api/creator/insert-wallets`

```json
{
  "wallet_stellar": "GBBTFVCUFETYRCS4R6JKYBKZ6XKTSHFSVSI7LJCVXHFEXUWSYEL4YHCQ"
}
```

Response:
```json
{
  "message": "Wallets added successfully",
  "wallet_evm": "0x...",
  "wallet_stellar": "GBBTFVCUFETYRCS4R6JKYBKZ6XKTSHFSVSI7LJCVXHFEXUWSYEL4YHCQ"
}
```

> Can be sent alongside other wallets (`wallet_evm`, `wallet_sol`, `wallet_sui`) in the same request.

#### Delete Stellar Wallet

**DELETE** `/api/creator/delete-wallet/stellar`

Response:
```json
{
  "message": "Wallet removed successfully",
  "wallet_evm": "0x..."
}
```

> Valid `walletType` values: `evm`, `sol`, `sui`, `stellar`

#### Update Profile

**PUT** `/api/creator/update-profile`
**PUT** `/api/creator/update-profile-after-login`

Both accept `wallet_stellar` as a field in the request body.

```json
{
  "wallet_stellar": "GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC"
}
```

---

### 2. Profile Response

**GET** `/api/creator/profile`

The response now includes `wallet_stellar` when set:

```json
{
  "id": "694f0fba607174336b6856d6",
  "wallet_evm": "0x...",
  "wallet_sol": "...",
  "wallet_sui": "...",
  "wallet_stellar": "GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC"
}
```

---

### 3. Campaign Submission (Stellar wallet required)

**POST** `/api/creator/submit-campaign/:campaign_id`

When a campaign has `payment_chain: "stellar"`, the user **must** have a `wallet_stellar` configured. If not, the API returns:

```json
{
  "message": "error_stellar",
  "wallet_stellar": ""
}
```

> Status code is `200` (same pattern as `error_solana`, `error_sui`, `error_evm`). The frontend should prompt the user to add a Stellar wallet before submitting.

---

### 4. Balance Check

**GET** `/api/payments/stellar/balance?symbol=USDC&address=GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC`

Response:
```json
{
  "success": true,
  "data": {
    "symbol": "USDC",
    "address": "GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC",
    "balance": 1.0336767
  }
}
```

> Supported symbols: `USDC`

---

### 5. Payment Host (Campaign Creation)

**POST** `/api/payments/payment-host-create`

The `chain` field now accepts `stellar`:

```json
{
  "walletAddress": "GAEC5IKE6SEZOOU73ZB6SMQ6GTI6WJQNOQIE6X5EBFW3JCDASL4RQNYC",
  "campaignId": "...",
  "chain": "stellar",
  "symbol": "USDC"
}
```

**POST** `/api/payments/payment-host-confirm`

```json
{
  "paymentId": "...",
  "taxId": "stellar-transaction-hash",
  "campaignId": "...",
  "chain": "stellar",
  "symbol": "USDC"
}
```

---

### 6. Plan Payment

**POST** `/api/payments/plan-create`
**POST** `/api/payments/plan-confirm`

Both accept `chain: "stellar"` with `symbol: "USDC"`.

---

## Frontend Checklist

### Wallet UI
- [ ] Add Stellar wallet field in wallet management (insert/edit/delete)
- [ ] Validate format: starts with `G`, 56 characters
- [ ] Show Stellar wallet in user profile
- [ ] Add Stellar as an option in wallet type selector (delete wallet)

### Campaign Creation (Host)
- [ ] Add `stellar` to the chain dropdown (alongside base, arbitrum, ethereum, polygon, bsc, solana, sui, etc.)
- [ ] When `stellar` is selected, only show `USDC` as token option
- [ ] Use `chain: "stellar"` in payment-host-create/confirm requests

### Campaign Submission (Creator)
- [ ] Handle `message: "error_stellar"` response from submit-campaign
- [ ] Prompt user to add Stellar wallet when this error occurs

### Balance Display
- [ ] Call `/api/payments/stellar/balance` for Stellar balance checks
- [ ] Display USDC balance for Stellar wallets

### Plan Payment
- [ ] Add `stellar` as chain option for plan payments

---

## Important Notes

1. **Trustline required:** Recipients must have a USDC trustline on Stellar before receiving tokens. If a payment fails with trustline error, the API returns `"Recipient has not established a trustline for USDC"` in the error message.

2. **Wallet validation:** The backend validates Stellar addresses using `StrKey.isValidEd25519PublicKey()`. Invalid addresses are rejected.

3. **Chain identifiers in DB:** Campaigns can have `payment_chain` as `"stellar"` or `"STELLAR"` (both are handled).

4. **Wallet blocking:** Users cannot change their Stellar wallet while participating in a campaign with `status: "waiting payment"` on the Stellar chain (same behavior as other chains).
