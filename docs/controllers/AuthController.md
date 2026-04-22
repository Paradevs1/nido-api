# AuthController

## Descrição

Controller de autenticação e registro: registro de hosts (em duas etapas), login de host e de creator, vinculação de contas (Privy) para creator e verificação de existência de usuário.

## Base path

`/api/auth`

## Autenticação

Rotas **públicas** (sem guard de autenticação). Algumas operações recebem token (ex.: link-accounts-creator) para identificar o usuário.

## Serviço

- **AuthService** (`src/services/AuthService.ts`)
- **config/twitter** – `authenticateWithPrivy`, `authenticateWithPrivyWithoutToken` (Privy/social login)

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| POST | `/register-host` | registerHost | Registro inicial de host (username, email, password) |
| POST | `/register-host-part-two/:host_id` | registerHostPartTwo | Segunda etapa do registro host (dados da empresa, etc.) |
| POST | `/login-host` | loginHost | Login de host (email, password) → token |
| POST | `/login-creator` | loginCreator | Login de creator (via Privy/social) |
| POST | `/link-accounts-creator` | linkAccountsCreator | Vincular contas (Privy) ao creator |
| POST | `/user-exist` | userExist | Verificar se usuário existe (ex.: por email) |

## Observações

- Login creator utiliza fluxo Privy (linked accounts, webhook, etc.).
- Registro host em duas etapas: primeira cria usuário; segunda completa dados do host.
