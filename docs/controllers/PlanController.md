# PlanController

## Descrição

Controller de **planos** (assinaturas de hosts): listagem de planos disponíveis e plano atual do host logado. Usado pelo front para combos (ex.: admin ao atualizar plano do host) e pela área do host para exibir seu plano e duração.

## Base path

`/api/plans`

## Autenticação

- **listPlans**: rota **pública** (sem guard), para exibir opções de planos (ex.: combo no admin).
- **getMyPlan**: exige **hostGuard** (usuário tipo HOST).

## Serviço

- **PlanService** (`src/services/PlanService.ts`)
- **PlanModel** (`src/models/Plan.ts`)

## Endpoints

| Método | Path | Handler | Descrição |
|--------|------|---------|-----------|
| GET | `/list` | listPlans | Listar todos os planos (público; para combo, etc.) |
| GET | `/me` | getMyPlan | Plano atual do host logado (nome, duração, etc.) |

## Observações

- Planos típicos: BASIC, CORE, ENTERPRISE (definidos no modelo/seed).
- O admin atualiza o plano do host via **PATCH /api/admin/hosts/:hostId/plan** (AdminController).
