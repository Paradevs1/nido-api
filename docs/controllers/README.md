# Controllers – Índice

Documentação de cada controller da API (responsabilidades, base path, autenticação e endpoints).

| Controller | Base path | Descrição resumida |
|------------|-----------|--------------------|
| [AdminController](./AdminController.md) | `/api/admin` | Operações administrativas: listagens (creators, hosts, payments, short-urls), combos, stats, export Excel, atualizar plano host |
| [AuthController](./AuthController.md) | `/api/auth` | Registro e login: host (2 etapas), creator (Privy), link accounts, user-exist |
| [CreatorController](./CreatorController.md) | `/api/creator` | Ações do creator: submissão, comentários, perfil, carteiras, short URLs, transações, vencedores |
| [HostController](./HostController.md) | `/api/host` | Ações do host: campanhas (CRUD), leaderboard, vencedores, perfil, rank Twitter, verificação email, KOLs |
| [JobController](./JobController.md) | `/api/jobs` | Execução manual de jobs: expired campaigns, get info post X, clicks, update Twitter followers |
| [PaymentController](./PaymentController.md) | `/api/payments` | Pagamentos: saldos EVM/SOL/SUI, send winners, payment host/plan create&confirm, KOLs selective |
| [PlanController](./PlanController.md) | `/api/plans` | Planos: listar (público), meu plano (host) |
| [WaitlistController](./WaitlistController.md) | `/api/waitlist` | Waitlist: submit, check-email, listagem, stats, get by id, delete |

**Montagem das rotas:** `src/app.ts` (ex.: `app.use('/api/admin', adminRoutes)`).  
**Definição das rotas por controller:** `src/routes/*.ts`.
