# API do SGF – Qualidade do Concreto

Servidor em Node.js **sem dependências externas** (usa o SQLite embutido do Node). Requer **Node 22.13 ou superior**.

## Como rodar

```bash
npm run server      # API em http://localhost:3001 (cria server/sgf.db na primeira execução)
npm run dev         # interface; o Vite encaminha /api para a API
npm run test:server # testes automáticos da API
```

Variáveis opcionais: `PORT`, `SGF_DB` (caminho do banco), `SGF_SEGREDO` (**defina em produção**), `SGF_CORS` (origem permitida), `SGF_SEED=0` (não criar amostras de exemplo), `SGF_API` (endereço da API para o Vite).

## Perfis e permissões

| Perfil | Vê dashboard e histórico | Cadastra amostra e registra resultado | Aprova ou reprova | Cadastra obra |
|---|---|---|---|---|
| Fiscal (`fiscal`) | sim | sim | não | não |
| Gestor (`gestor`) | sim | não | não | sim |
| Responsável técnico (`responsavel_tecnico`) | sim | sim | **sim** | sim |

Contas de demonstração (troque antes de usar de verdade): `fiscal@sgf.com / fiscal123`, `gestor@sgf.com / gestor123`, `rt@sgf.com / rt123`.

## Fluxo da amostra

`Aguardando rompimento` → (registrar resistência em MPa) → `Pendente de aprovação` → `Aprovada` ou `Reprovada` (reprovação exige justificativa). Cada passo só é aceito na situação correta.

## Rotas

| Método e rota | Perfis | O que faz |
|---|---|---|
| `POST /api/login` | público | devolve token de 8 horas |
| `GET /api/me` | todos | usuário logado |
| `GET /api/obras` · `POST /api/obras` | todos · gestor, RT | lista · cadastra obra |
| `GET /api/dashboard?obra=&periodo=7\|30\|90` | todos | indicadores calculados dos registros |
| `GET /api/amostras?obra=&situacao=&q=` | todos | histórico com filtros |
| `POST /api/amostras` | fiscal, RT | cadastra amostra |
| `POST /api/amostras/:id/resultado` | fiscal, RT | registra a resistência |
| `GET /api/amostras/pendentes` | RT | fila de aprovação |
| `POST /api/amostras/:id/aprovar` · `/reprovar` | RT | decide |

## Modelo de dados

Segue o DER da atividade da U2 (OBRA, LOTE, AMOSTRA, SITUACAO) mais USUARIO, que guarda o perfil, e campos de resultado e decisão em AMOSTRA. Regra assumida: um lote pertence a uma obra, um local e uma data.

## Limites conhecidos

O token fica no `localStorage` do navegador e não há HTTPS nem renovação de sessão, então isto é adequado para o trabalho acadêmico e não para produção sem endurecimento.
