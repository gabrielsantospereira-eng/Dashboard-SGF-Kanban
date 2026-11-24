# SGF – Qualidade do Concreto

Módulo do Sistema de Gestão e Fiscalização (SGF) para registrar e acompanhar amostras de concreto coletadas em obra, com aprovação pelo responsável técnico.

Trabalho da disciplina Processos de Software (BES016, UCSal). Equipe: Giovanne Menezes e Gabriel Pereira.

## O que o sistema faz

- **Fiscal de obra:** cadastra amostras (obra, local, data, código e lote) e registra a resistência do rompimento.
- **Gestor:** consulta o Dashboard e o Histórico e cadastra obras.
- **Responsável técnico:** único perfil que aprova ou reprova uma amostra pendente (a reprovação exige justificativa).
- **Dashboard:** indicadores e gráficos calculados a partir dos registros, com filtros de obra e período.

Fluxo da amostra: `Aguardando rompimento` → `Pendente de aprovação` → `Aprovada` ou `Reprovada`.

## Como rodar

Requer Node 22.13 ou superior.

```bash
npm install
npm run server   # API em http://localhost:3001 (cria server/sgf.db na primeira execução)
npm run dev      # interface; o Vite encaminha /api para a API
npm run test:server   # testes automáticos da API
```

Contas de demonstração (somente desenvolvimento): `fiscal@sgf.com / fiscal123`, `gestor@sgf.com / gestor123`, `rt@sgf.com / rt123`.

Detalhes da API, das permissões e das variáveis de ambiente: [server/README.md](server/README.md).

## Tecnologias

React 19, TypeScript, Vite, Tailwind CSS e Recharts na interface. Node.js (módulo HTTP nativo) e SQLite (`node:sqlite`) na API.

## Documentação

Diagramas do artigo da Unidade 2 em [docs/figuras](docs/figuras): C4 de contexto, C4 de containers, UML de sequência do cadastro e DER.

## Estado do projeto

Implementado: API com login e perfis, banco SQLite, interface integrada à API, fluxo de aprovação e testes de integração da API.
Pendente: views SQL (Issue #4), testes automatizados da interface, HTTPS e renovação de sessão.
