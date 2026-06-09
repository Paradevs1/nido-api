# NIDO API

A modern REST API built with Node.js, TypeScript, Express and MongoDB for managing bounties and campaigns. This API provides a complete platform for hosts to create and manage marketing campaigns, and for creators to participate in these campaigns through submissions and community engagement.

## ✨ Key Features

- **User Management**: Separate authentication for hosts, creators, and admins
- **Campaign Management**: Create, update, and manage marketing campaigns
- **Submission System**: Creators can submit content for campaigns
- **Winner Management**: Hosts can define campaign winners with automatic reward calculation
- **Comment System**: Interactive commenting system for campaign engagement
- **Leaderboard**: Track and display campaign submissions with reward amounts
- **Profile Management**: Comprehensive user profiles with social media integration
- **Wallet Integration**: Support for cryptocurrency wallet addresses
- **Admin Panel**: Complete administrative control over campaigns and users
- **Reward System**: Automated reward distribution based on campaign tiers
- **Blockchain Payments**: Multi-chain cryptocurrency payment system (Ethereum, Polygon, BSC, Arbitrum, Base, Berachain, HyperEVM, Solana, Sui)
- **Automatic Token Distribution**: Send tokens to campaign winners automatically
- **Host Payment System**: Hosts must pay for campaigns before they become active
- **Transaction Validation**: Automatic validation of blockchain transactions
- **Fee System**: Automatic fee calculation and inclusion in payment amounts
- **Wallet Integration**: Support for EVM, Solana and Sui wallet addresses
- **Real-time Updates**: Campaign status management and notifications
- **Security**: JWT authentication with comprehensive security middleware
- **Production Security**: Swagger documentation disabled in production environment
- **Documentation**: Complete Swagger/OpenAPI documentation (development only)

## 🚀 Technologies

- **Node.js** - JavaScript runtime
- **TypeScript** - Typed JavaScript superset
- **Express** - Web framework for Node.js
- **MongoDB** - NoSQL database with native driver
- **Mongoose** - MongoDB object modeling for Node.js
- **JWT** - JSON Web Token authentication
- **bcryptjs** - Password hashing
- **Nodemon** - Development with hot reload
- **Swagger** - Interactive API documentation
- **Helmet** - Security middleware
- **CORS** - Cross-Origin Resource Sharing
- **Morgan** - HTTP request logger
- **dotenv** - Environment variable management
- **Ethers.js** - Ethereum blockchain interaction
- **Solana Web3.js** - Solana blockchain interaction
- **SPL Token** - Solana token operations
- **Sui SDK** - Sui blockchain interaction
- **BS58** - Base58 encoding/decoding
- **@mysten/sui** - Sui blockchain SDK
- **@mysten/sui.js** - Sui blockchain utilities

## 📋 Prerequisites

- Node.js (version 18 or higher)
- MongoDB (version 5 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd bounties.api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory with the following variables:

   ```env
   # Server Configuration
   NODE_ENV=development
   PORT=3000
   
   # Database
   MONGODB_URI=mongodb://localhost:27017/bounties
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   
   # Blockchain Configuration
   EVM_PRIVATE_KEY=your-ethereum-private-key
   SOLANA_PRIVATE_KEY=your-solana-private-key
   SUI_PRIVATE_KEY=your-sui-private-key

   # Optional: override EVM RPC URLs per chain (recommended in production)
   # Examples: RPC_BASE_URL=..., RPC_ARBITRUM_URL=...
   RPC_BASE_URL=
   RPC_ARBITRUM_URL=
   RPC_ETHEREUM_URL=

   # Optional: some RPC providers (e.g. Ankr with origin allowlist) may require these headers
   RPC_ORIGIN=https://yourdomain.com
   RPC_REFERER=https://yourdomain.com
   
   # CORS Configuration (production only)
   CORS_ORIGIN=https://yourdomain.com,https://anotherdomain.com
   ```

4. **Start MongoDB**

   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Run the application**

   ```bash
   # Development mode (with hot reload)
   npm run dev

   # Production mode
   npm run build
   npm start
   ```

## 📚 API Endpoints

### Base URL

```
http://localhost:3000/api
```

### 📚 Interactive Documentation

Access the complete API documentation with Swagger UI (development only):

```
http://localhost:3000/api-docs
```

**Note**: Swagger documentation is automatically disabled in production environment for security reasons.

### 🔒 Security

The API uses JWT authentication and Helmet for protection against common vulnerabilities:

- JWT Bearer Token authentication
- Content Security Policy (CSP)
- XSS Protection
- HSTS (HTTP Strict Transport Security)
- No Sniff
- Referrer Policy

## 🏗️ Project Structure

```
bounties.api/
├── src/
│   ├── config/
│   │   ├── database.ts          # MongoDB configuration
│   │   ├── jwt.ts              # JWT configuration
│   │   ├── swagger.ts          # Swagger configuration
│   │   └── twitter.ts          # Twitter API configuration
│   ├── controllers/
│   │   ├── AuthController.ts   # Authentication endpoints
│   │   ├── CreatorController.ts # Creator endpoints
│   │   ├── HostController.ts   # Host endpoints
│   │   ├── AdminController.ts  # Admin endpoints
│   │   └── PaymentController.ts # Payment endpoints
│   ├── services/
│   │   ├── AuthService.ts      # Authentication logic
│   │   ├── CreatorService.ts   # Creator business logic
│   │   ├── HostService.ts      # Host business logic
│   │   ├── AdminService.ts     # Admin business logic
│   │   └── PaymentService.ts   # Payment and blockchain logic
│   ├── models/
│   │   ├── User.ts             # User model
│   │   ├── Campaign.ts         # Campaign model
│   │   ├── CampaignParticipants.ts # Campaign participants model
│   │   ├── UserCommentCampaign.ts # User comments model
│   │   ├── Payment.ts          # Payment transactions model
│   │   └── PaymentHost.ts      # Host payment model
│   ├── dtos/
│   │   ├── auth.dto.ts         # Authentication DTOs
│   │   ├── campaign.dto.ts     # Campaign DTOs
│   │   ├── campaignParticipants.dto.ts # Participant DTOs
│   │   ├── comment.dto.ts      # Comment DTOs
│   │   └── creator.dto.ts      # Creator DTOs
│   ├── routes/
│   │   ├── auth.routes.ts      # Authentication routes
│   │   ├── creator.routes.ts   # Creator routes
│   │   ├── host.routes.ts      # Host routes
│   │   ├── admin.routes.ts     # Admin routes
│   │   └── payment.routes.ts   # Payment routes
│   ├── guards/
│   │   └── auth.guard.ts       # JWT authentication guard
│   ├── utils/
│   │   ├── dateUtils.ts        # Date utility functions
│   │   └── consts.ts           # Blockchain constants and configurations
│   └── app.ts                  # Main application
├── dist/                       # Compiled code (TypeScript → JavaScript)
├── package.json
├── tsconfig.json              # TypeScript configuration
├── nodemon.json               # Nodemon configuration
└── README.md
```

## 🔐 Authentication

The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

## 📊 Campaign Statistics

The API provides comprehensive campaign statistics for hosts to track their campaign performance:

### Features

- **Campaign Progress Tracking**: Count of active campaigns in progress
- **Completion Analytics**: Number of completed campaigns
- **Engagement Metrics**: Total user submissions across all campaigns
- **Real-time Data**: Up-to-date statistics based on current campaign status

### Statistics Response Format

```typescript
interface CampaignStatistics {
  campaigns_progress: number; // Active campaigns
  campaigns_completed: number; // Completed campaigns
  total_user_submiteds: number; // Total submissions across all campaigns
}
```

## 💰 Blockchain Payment System

The API includes a comprehensive blockchain payment system that supports multiple networks and automatic token distribution:

### Supported Blockchains

- **EVM Networks**: Ethereum, Polygon, BSC, Arbitrum, Base, Berachain, HyperEVM
- **Solana**: Native SPL token support
- **Sui**: Native SPL token support
- **Supported Tokens**: USDT, USDC on all networks, USDCE on HyperEVM, HONEY on Berachain

### Features

- **Multi-chain Support**: Send tokens across different blockchain networks
- **Host Payment System**: Hosts must pay for campaigns before activation
- **Transaction Validation**: Automatic validation of blockchain transactions
- **Fee System**: Automatic fee calculation and inclusion in payment amounts
- **Automatic Distribution**: Send tokens to all campaign winners automatically
- **Balance Checking**: Verify wallet balances before sending
- **Transaction Tracking**: Complete transaction history and status tracking
- **Date Tracking**: Automatic `date_received` update when tokens are sent
- **Error Handling**: Comprehensive error handling for failed transactions

### Payment Flow

1. **Campaign Creation**: Host creates campaign with `payment_chain` and `payment_token`
2. **Host Payment**: Host must pay for the campaign (including fees) before it becomes active
3. **Payment Validation**: API validates the host payment transaction
4. **Campaign Activation**: Campaign becomes active after payment confirmation
5. **Winner Selection**: Host selects campaign winners with amounts
6. **Token Distribution**: API automatically sends tokens to all winners
7. **Status Update**: `date_received` is automatically updated for each winner
8. **Transaction Logging**: All transactions are recorded in the database

## 🏆 Winner Management & Reward System

The API includes a comprehensive winner management system that allows hosts to select winners and automatically distribute rewards:

### Features

- **Winner Selection**: Hosts can define winners with specific ranks
- **Automatic Reward Calculation**: Rewards are calculated based on campaign tiers or equal distribution
- **Campaign Tiers**: Advanced reward tier system with position-based rewards
- **Winner Tracking**: Complete tracking of winners with amounts received
- **Campaign Completion**: Automatic campaign completion when winners are selected

### Reward Calculation Logic

- **With Reward Tiers**: Uses predefined tiers based on winner rank
- **Without Reward Tiers**: Divides total prize pool equally among all winners
- **Winner Data**: Tracks `amount_received`, `date_received`, and `winner` status

### Winner Response Format

```typescript
interface WinnerResponse {
  user_id: string;
  username: string;
  rank: number;
  amount_received: number;
  date_received: Date;
}
```

## 💬 Comment System

The API includes a comprehensive comment system that allows users to interact with campaigns:

### Features

- **Create Comments**: Users can add comments to campaigns
- **Edit Comments**: Users can edit their own comments
- **Delete Comments**: Users can delete their own comments
- **View Comments**: Paginated comment listing with user information
- **User Context**: Comments include user profile information (username, Twitter profile image)
- **Permission Control**: Users can only edit/delete their own comments

### Comment Response Format

```typescript
interface CommentResponse {
  id: string;
  userId: string;
  campaignId: string;
  comment: string;
  create_date: Date;
  twitter_profile_image?: string;
  username: string;
  userIsEditOrDelete: boolean;
  created_at: Date;
  updated_at: Date;
}
```

## 👨‍💼 Admin Panel

The API includes a comprehensive admin panel for managing campaigns and users:

### Features

- **Status Control**: Toggle campaign status with admin override

### Admin Capabilities

- **Campaign Status**: Can toggle any campaign status (except completed)

## 📊 Data Models

### User

```typescript
interface IUser {
  _id?: ObjectId;
  username: string;
  user_type: "CREATOR" | "HOST" | "ADMIN";
  email?: string;
  password_hash?: string;
  email_verified: boolean;
  isActive: boolean;
  campaigns_created: number;
  wallets?: string[];
  // Host-specific fields
  position_company?: string;
  name_company?: string;
  introduction_company?: string;
  logo_company?: string; // Base64 image
  categories_atuation?: CategoryAtuation[];
  // Social media fields
  twitter_username?: string;
  telegram_username?: string;
  social_media?: SocialMedia[];
  created_at: Date;
  updated_at: Date;
}
```

### Campaign

```typescript
interface ICampaign {
  _id?: ObjectId;
  host_id: string; // FK to User
  title: string;
  about_project: string;
  what_we_need: string;
  content_type: string;
  content_pillars: string[];
  benefits: string[];
  content_format: ContentFormat[];
  content_categories: ContentCategory[];
  country: Country;
  timezone: string;
  payment_chain: string;
  payment_token: string;
  total_prize_pool: number;
  reward_tiers: RewardTier[];
  official_links: OfficialLink[];
  support_contact: SupportContact[];
  status: "active" | "inactive" | "completed" | "cancelled";
  start_date: Date;
  end_date: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Campaign Participants

```typescript
interface ICampaignParticipants {
  _id?: ObjectId;
  userId: string; // FK to User
  campaignId: string; // FK to Campaign
  date_submit: Date;
  amount_received: number;
  date_received?: Date;
  submission: string;
  winner: boolean; // Indicates if user won the campaign
  created_at: Date;
  updated_at: Date;
}
```

### User Comment Campaign

```typescript
interface IUserCommentCampaign {
  _id?: ObjectId;
  userId: string; // FK to User
  campaignId: string; // FK to Campaign
  comment: string;
  create_date: Date;
  created_at: Date;
  updated_at: Date;
}
```

### Payment

```typescript
interface IPayment {
  _id?: ObjectId;
  userId: string; // FK to User
  campaignId: string; // FK to Campaign
  signature: string; // Transaction hash/signature
  to: string; // Recipient wallet address
  amount: number; // Amount sent
  chain?: string; // Blockchain network (for EVM)
  symbol: string; // Token symbol (USDT, USDC)
  status: "pending" | "confirmed" | "failed";
  created_at: Date;
  updated_at: Date;
}
```

### Payment Host

```typescript
interface IPaymentHost {
  _id?: ObjectId;
  hostId: string; // FK to User
  campaignId: string; // FK to Campaign
  signature: string; // Transaction hash/signature
  amount: number; // Amount to be paid
  status: "pending" | "confirmed" | "failed";
  walletAddressHost: string; // Host wallet address
  created_at: Date;
  updated_at: Date;
}
```

## 🎯 API Endpoints

### Authentication

| Method | Endpoint                                | Description                | Auth Required |
| ------ | --------------------------------------- | -------------------------- | ------------- |
| POST   | `/auth/register-host`                   | Register new host user     | No            |
| POST   | `/auth/register-host-part-two/:host_id` | Complete host registration | No            |
| POST   | `/auth/login-host`                      | Login host user            | No            |
| POST   | `/auth/login-creator`                   | Login creator user         | No            |

### Host Endpoints

| Method | Endpoint                                         | Description               | Auth Required |
| ------ | ------------------------------------------------ | ------------------------- | ------------- |
| GET    | `/host/profile`                                  | Get host profile          | Yes           |
| PUT    | `/host/update-profile`                           | Update host profile       | Yes           |
| GET    | `/host/get-count-campaigns-by-host`              | Get campaign statistics   | Yes           |
| GET    | `/host/campaigns/public`                         | Get public campaigns      | Yes           |
| GET    | `/host/campaigns`                                | Get host's campaigns      | Yes           |
| GET    | `/host/campaigns/:id`                            | Get campaign by ID        | Yes           |
| GET    | `/host/campaigns/:id/leaderboard-submits`        | Get campaign leaderboard  | Yes           |
| GET    | `/host/campaigns/:id/get-users-campaign-winners` | Get campaign winners      | Yes           |
| GET    | `/host/campaigns/:id/get-campaign-tiers`         | Get campaign reward tiers | Yes           |
| POST   | `/host/campaigns`                                | Create new campaign       | Yes           |
| POST   | `/host/campaigns/:id/create-campaign-winners`    | Create campaign winners   | Yes           |
| PUT    | `/host/campaigns/:id`                            | Update campaign           | Yes           |
| PATCH  | `/host/campaigns/:id/toggle-status`              | Toggle campaign status    | Yes           |
| DELETE | `/host/campaigns/:id`                            | Delete campaign           | Yes           |

### Creator Endpoints

| Method | Endpoint                                | Description             | Auth Required |
| ------ | --------------------------------------- | ----------------------- | ------------- |
| GET    | `/creator/profile`                      | Get creator profile     | Yes           |
| POST   | `/creator/submit-campaign/:campaign_id` | Submit to campaign      | Yes           |
| GET    | `/creator/campaigns-submitted`          | Get submitted campaigns | Yes           |
| POST   | `/creator/insert-wallets`               | Add wallets to user     | Yes           |
| DELETE | `/creator/delete-wallet/:wallet`        | Remove wallet from user | Yes           |
| GET    | `/creator/comments/:campaignId`         | Get campaign comments   | Yes           |
| POST   | `/creator/comments`                     | Create comment          | Yes           |
| PUT    | `/creator/comments/:id`                 | Update comment          | Yes           |
| DELETE | `/creator/comments/:id`                 | Delete comment          | Yes           |

### Admin Endpoints

| Method | Endpoint                   | Description            | Auth Required |
| ------ | -------------------------- | ---------------------- | ------------- |
| PATCH  | `/admin/:id/toggle-status` | Toggle campaign status | Yes           |

### Payment Endpoints

| Method | Endpoint                                    | Description                    | Auth Required |
| ------ | ------------------------------------------- | ------------------------------ | ------------- |
| POST   | `/payments/send/:campaign_id`              | Send tokens to campaign winners | Yes           |
| GET    | `/payments/evm/balance`                    | Check EVM wallet balance       | Yes           |
| GET    | `/payments/solana/balance`                 | Check Solana wallet balance    | Yes           |
| GET    | `/payments/sui/balance`                    | Check Sui wallet balance       | Yes           |
| POST   | `/payments/payment-host-create`            | Create host payment entry      | Yes           |
| POST   | `/payments/payment-host-confirm`           | Confirm host payment           | Yes           |

### Payment Host System

The API includes a comprehensive payment host system that allows hosts to pay for campaigns before they become active:

#### Features

- **Payment Creation**: Hosts can create payment entries with destination addresses
- **Transaction Validation**: Automatic validation of blockchain transactions
- **Campaign Activation**: Campaigns are automatically activated when payment is confirmed
- **Multi-chain Support**: Support for EVM, Solana, and Sui networks
- **Token Support**: USDT, USDC, USDCE, and HONEY tokens
- **Fee System**: Automatic fee calculation and inclusion in payment amounts
- **Status Tracking**: Complete payment status tracking (pending, confirmed, failed)

#### Payment Flow

1. **Create Payment**: Host creates a payment entry with campaign details
2. **Get Destination**: API returns destination wallet address and token information (including fees)
3. **Send Transaction**: Host sends tokens to the provided address
4. **Confirm Payment**: Host confirms payment with transaction hash
5. **Transaction Validation**: API validates the transaction on the blockchain
6. **Campaign Activation**: Campaign is automatically activated if payment is valid
7. **Status Update**: Payment status is updated to confirmed

## 🔧 Available Scripts

```bash
npm run dev      # Run in development mode with hot reload
npm run build    # Compile TypeScript to JavaScript
npm start        # Run the application in production mode
npm run clean    # Remove the dist folder
```

## 📝 Usage Examples

### Register a Host User

```bash
curl -X POST http://localhost:3000/api/auth/register-host \
  -H "Content-Type: application/json" \
  -d '{
    "username": "host_user",
    "email": "host@example.com",
    "password": "password123"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login-host \
  -H "Content-Type: application/json" \
  -d '{
    "email": "host@example.com",
    "password": "password123"
  }'
```

### Create a Campaign (with authentication)

```bash
curl -X POST http://localhost:3000/api/host/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "title": "Marketing Campaign",
    "about_project": "Promote our new product",
    "what_we_need": "Social media content",
    "content_type": "social_media",
    "content_pillars": ["brand_awareness", "engagement"],
    "benefits": ["Increased visibility", "Brand recognition"],
    "content_format": ["image", "video"],
    "content_categories": [{"slug": "social-media"}],
    "country": "US",
    "timezone": "UTC-5",
    "payment_chain": "ethereum",
    "payment_token": "USDT",
    "total_prize_pool": 10000,
    "reward_tiers": [{"position_initial": 1, "position_final": 5, "payment_amount": 1000}],
    "official_links": [{"type": "website", "url": "https://example.com"}],
    "support_contact": [{"type": "email", "contact": "support@example.com"}],
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-01-31T23:59:59Z"
  }'
```

### Submit to Campaign (Creator)

```bash
curl -X POST http://localhost:3000/api/creator/submit-campaign/64a1b2c3d4e5f6789012345 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "submission": "My campaign submission content"
  }'
```

### Add Wallets (Creator)

```bash
curl -X POST http://localhost:3000/api/creator/insert-wallets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "wallets": ["0x1234567890abcdef", "0xabcdef1234567890"]
  }'
```

### Get User Profile

```bash
# Get creator profile
curl -X GET http://localhost:3000/api/creator/profile \
  -H "Authorization: Bearer <your-jwt-token>"

# Get host profile
curl -X GET http://localhost:3000/api/host/profile \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Get Campaign Statistics (Host)

```bash
curl -X GET http://localhost:3000/api/host/get-count-campaigns-by-host \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**

```json
{
  "message": "Campaign count retrieved successfully",
  "campaigns_progress": 5,
  "campaigns_completed": 3,
  "total_user_submiteds": 150
}
```

### Update Host Profile

```bash
curl -X PUT http://localhost:3000/api/host/update-profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "position_company": "Marketing Director",
    "name_company": "Tech Corp",
    "introduction_company": "Leading technology company",
    "categories_atuation": [{"slug": "technology", "name": "Technology"}],
    "twitter_username": "techcorp",
    "telegram_username": "techcorp_official"
  }'
```

### Get Campaign Leaderboard

```bash
curl -X GET http://localhost:3000/api/host/campaigns/64a1b2c3d4e5f6789012345/leaderboard-submits \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Comment System Examples

#### Create a Comment

```bash
curl -X POST http://localhost:3000/api/creator/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "campaignId": "64a1b2c3d4e5f6789012345",
    "comment": "This campaign looks amazing! I would love to participate."
  }'
```

#### Get Campaign Comments

```bash
curl -X GET "http://localhost:3000/api/creator/comments/64a1b2c3d4e5f6789012345?page=1&limit=10" \
  -H "Authorization: Bearer <your-jwt-token>"
```

#### Update a Comment

```bash
curl -X PUT http://localhost:3000/api/creator/comments/64a1b2c3d4e5f6789012346 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "comment": "Updated comment content"
  }'
```

#### Delete a Comment

```bash
curl -X DELETE http://localhost:3000/api/creator/comments/64a1b2c3d4e5f6789012346 \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Create Campaign Winners (Host)

```bash
curl -X POST http://localhost:3000/api/host/campaigns/64a1b2c3d4e5f6789012345/create-campaign-winners \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "winners": [
      {
        "user_id": "64a1b2c3d4e5f6789012346",
        "rank": 1
      },
      {
        "user_id": "64a1b2c3d4e5f6789012347",
        "rank": 2
      }
    ]
  }'
```

### Get Campaign Winners (Host)

```bash
curl -X GET http://localhost:3000/api/host/campaigns/64a1b2c3d4e5f6789012345/get-users-campaign-winners \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Get Campaign Tiers (Host)

```bash
curl -X GET http://localhost:3000/api/host/campaigns/64a1b2c3d4e5f6789012345/get-campaign-tiers \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Toggle Campaign Status (Admin)

```bash
curl -X PATCH http://localhost:3000/api/admin/64a1b2c3d4e5f6789012345/toggle-status \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Send Tokens to Campaign Winners

```bash
curl -X POST http://localhost:3000/api/payments/send/64a1b2c3d4e5f6789012345 \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Token(s) sent successfully",
  "data": {
    "campaign_id": "64a1b2c3d4e5f6789012345",
    "totalWinners": 3,
    "transactions": [
      {
        "paymentId": "507f1f77bcf86cd799439011",
        "signature": "0x...",
        "to": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
      }
    ]
  }
}
```

### Check EVM Wallet Balance

```bash
curl -X GET "http://localhost:3000/api/payments/evm/balance?chain=ethereum&symbol=USDT&address=0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "chain": "ethereum",
    "symbol": "USDT",
    "address": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "balance": 1000.5
  }
}
```

### Check Solana Wallet Balance

```bash
curl -X GET "http://localhost:3000/api/payments/solana/balance?symbol=USDC&address=9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "USDC",
    "address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "balance": 500.25
  }
}
```

### Check Sui Wallet Balance

```bash
curl -X GET "http://localhost:3000/api/payments/sui/balance?symbol=USDC&address=0x56f8da0ef046439fc493a470dcfe88b8e2966a9456a64f9be22726d83261a32f" \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "USDC",
    "address": "0x56f8da0ef046439fc493a470dcfe88b8e2966a9456a64f9be22726d83261a32f",
    "balance": 750.50
  }
}
```

### Create Host Payment

```bash
curl -X POST http://localhost:3000/api/payments/payment-host-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "walletAddress": "0x1234567890abcdef...",
    "campaignId": "507f1f77bcf86cd799439011",
    "chain": "ethereum",
    "symbol": "USDT"
  }'
```

**Response:**
```json
{
  "data": {
    "paymentId": "507f1f77bcf86cd799439012",
    "destinationAddress": "0xDA0BDEc39cFF206ff032EAC8F99F6B45d3dA8cF9",
    "amount": 1000,
    "chain": "ethereum",
    "token": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "message": "Payment host created successfully"
  }
}
```

### Confirm Host Payment

```bash
curl -X POST http://localhost:3000/api/payments/payment-host-confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "paymentId": "507f1f77bcf86cd799439012",
    "taxId": "0x1234567890abcdef...",
    "campaignId": "507f1f77bcf86cd799439011",
    "chain": "ethereum",
    "symbol": "USDT"
  }'
```

**Response:**
```json
{
  "data": {
    "paymentId": "507f1f77bcf86cd799439012",
    "success": true,
    "message": "Transaction confirmed"
  }
}
```

## 🚀 Deployment

### Build for production

```bash
npm run build
npm start
```

### Environment variables for production

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-mongodb-uri
JWT_SECRET=your-jwt-secret

# Blockchain Configuration
EVM_PRIVATE_KEY=your-ethereum-private-key
SOLANA_PRIVATE_KEY=your-solana-private-key
SUI_PRIVATE_KEY=your-sui-private-key

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://anotherdomain.com
```

### Required Environment Variables

- **NODE_ENV**: Environment mode (`development` or `production`)
- **PORT**: Server port (default: 3000)
- **MONGODB_URI**: MongoDB connection string
- **JWT_SECRET**: Secret key for JWT token signing
- **EVM_PRIVATE_KEY**: Ethereum private key for EVM transactions (Ethereum, Polygon, BSC, Arbitrum, Base, Berachain, HyperEVM)
- **SOLANA_PRIVATE_KEY**: Solana private key for Solana transactions
- **SUI_PRIVATE_KEY**: Sui private key for Sui transactions
- **CORS_ORIGIN**: Allowed origins for CORS (production only)

### Optional Environment Variables

- **JWT_EXPIRES_IN**: JWT token expiration time (default: 7d)
- **RPC_<CHAIN>_URL**: Override EVM RPC URL for a chain (e.g. `RPC_BASE_URL`)
- **RPC_ORIGIN / RPC_REFERER**: Extra headers for RPC providers that enforce origin allowlists

## 🔧 Development

### Adding new endpoints

1. **Create the controller** in `src/controllers/`
2. **Define the routes** in `src/routes/`
3. **Import the routes** in `src/app.ts`
4. **Add Swagger documentation** with JSDoc comments

### Adding new models

1. **Create the model** in `src/models/`
2. **Define TypeScript interfaces**
3. **Configure MongoDB native driver methods**

## 📝 License

This project is under the ISC license.

## 📞 Support

If you encounter any issues or have questions, please open an issue in the repository.
