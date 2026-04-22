# WaitlistController

## Descrição

Controller da **waitlist**: inscrição na lista de espera, listagem de entradas (admin), estatísticas, consulta por ID, exclusão e verificação de e-mail já cadastrado.

## Base path

`/api/waitlist`

## Autenticação

- **Públicas (sem guard):** `POST /submit`, `POST /check-email` – qualquer um pode se inscrever ou verificar se o e-mail existe.
- **authGuard:** rotas que exigem usuário autenticado (provavelmente admin): `GET /`, `GET /stats`, `GET /:id`, `DELETE /:id`.

## Serviço

- **WaitlistService** (`src/services/WaitlistService.ts`)
- **WaitlistModel** (`src/models/Waitlist.ts`)

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| POST | `/submit` | submitWaitlist | Inscrever na waitlist (body: ex. email, nome, etc.) |
| POST | `/check-email` | checkEmailExists | Verificar se o e-mail já está na waitlist |
| GET | `/` | getWaitlistEntries | Listar entradas da waitlist (paginado/filtros; auth) |
| GET | `/stats` | getWaitlistStats | Estatísticas da waitlist (auth) |
| GET | `/:id` | getWaitlistById | Obter uma entrada por ID (auth) |
| DELETE | `/:id` | deleteWaitlist | Remover entrada da waitlist (auth) |

## Observações

- Submit e check-email são usados na landing/forma de captação.
- Listagem, stats e delete costumam ser usados pelo painel admin.
