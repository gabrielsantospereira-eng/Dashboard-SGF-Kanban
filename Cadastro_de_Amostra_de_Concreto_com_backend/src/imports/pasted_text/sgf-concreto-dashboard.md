Crie uma nova aba no protótipo do sistema SGF — Qualidade do Concreto, chamada “Dashboard”.

Essa tela deve apresentar, de forma visual, clara e objetiva, as principais informações coletadas no formulário de Cadastro de Amostra de Concreto, permitindo que um fiscal ou gestor acompanhe rapidamente as amostras registradas e sua situação.

Objetivo da Dashboard
A Dashboard deve funcionar como uma visão geral do controle de amostras de concreto da obra.

O usuário deve conseguir identificar rapidamente:

Quantas amostras foram cadastradas.
Quantas estão aguardando rompimento.
Quantas já possuem resultado registrado.
Quantas amostras foram cadastradas recentemente.
Em quais obras estão concentradas as amostras.
Em quais locais da obra as amostras foram coletadas.
A evolução dos registros ao longo do período.
Não criar regras normativas de aprovação ou reprovação do concreto. A Dashboard deve apresentar dados de cadastro e situação dos registros, sem realizar análise técnica ou julgamento da qualidade do concreto.

Estilo visual
Manter o mesmo padrão visual já criado para o SGF:

Interface profissional, moderna e limpa.
Design mobile-first.
Aparência de sistema corporativo utilizado na construção civil.
Azul como cor principal.
Fundo claro.
Cards com bordas arredondadas.
Ícones simples e consistentes.
Tipografia moderna e de fácil leitura.
Boa hierarquia visual.
Poucos elementos por tela.
Informações importantes devem ter destaque.
Utilizar cores de apoio para diferenciar situações, sem transmitir aprovação/reprovação técnica.
Cabeçalho
Criar um cabeçalho contendo:

Título: “Dashboard”
Subtítulo: “Qualidade do Concreto”
Seletor de obra, permitindo visualizar os dados de uma obra específica.
Filtro de período.
Exemplo:

Obra: Edifício Alfa
Período: Últimos 30 dias

Cards principais
Logo abaixo do cabeçalho, criar cards resumidos com os principais indicadores.

Card 1 — Total de Amostras
Exibir:

24

Texto auxiliar:

Amostras cadastradas

Utilizar um ícone relacionado a amostra/concreto.

Card 2 — Aguardando Rompimento
Exibir:

12

Texto auxiliar:

Aguardando rompimento

Utilizar uma cor de destaque, como amarelo/laranja suave.

Card 3 — Resultado Registrado
Exibir:

10

Texto auxiliar:

Resultados registrados

Utilizar azul ou verde de forma discreta, apenas para representar a situação do registro.

Card 4 — Cadastradas no Período
Exibir:

6

Texto auxiliar:

Novas amostras

Gráfico — Amostras por período
Criar um gráfico simples de linha ou barras chamado:

“Amostras cadastradas”

Demonstrar a quantidade de amostras cadastradas ao longo dos últimos 7 ou 30 dias.

Utilizar dados fictícios/mockados.

Exemplo:

01/09 — 2
02/09 — 3
03/09 — 1
04/09 — 4
05/09 — 2
06/09 — 5
07/09 — 7

O gráfico deve ser simples e adequado para visualização em celular.

Distribuição por situação
Criar uma seção chamada:

“Situação das amostras”

Utilizar um gráfico de rosca ou barras horizontais.

Exemplo:

Aguardando rompimento — 12
Resultado registrado — 10
Outros registros — 2
Não utilizar os termos “aprovado”, “reprovado” ou qualquer classificação normativa.

Amostras recentes
Criar uma seção:

“Amostras recentes”

Exibir uma lista de cards compactos com as últimas amostras cadastradas.

Cada item deve apresentar:

AM-2026-001
Edifício Alfa
Pilar P12
07/09/2026

Status: Aguardando rompimento

Outro exemplo:

AM-2026-002
Edifício Alfa
Laje L03
07/09/2026

Status: Resultado registrado

Adicionar um botão ou link:

“Ver todas”

Esse botão deve levar para a tela Histórico de Amostras já criada no protótipo.

Distribuição por local de concretagem
Adicionar uma seção chamada:

“Amostras por local”

Apresentar os principais locais onde as amostras foram coletadas.

Exemplo:

Pilares — 8
Lajes — 7
Vigas — 5
Fundação — 4
Pode utilizar barras horizontais ou cards compactos.

Resumo por obra
Caso o usuário selecione a opção “Todas as obras”, apresentar uma seção:

“Amostras por obra”

Exemplo:

Edifício Alfa — 18 amostras
Edifício Beta — 6 amostras

Permitir que o usuário toque em uma obra para filtrar a Dashboard.

Filtros
Adicionar filtros de fácil utilização no topo da tela:

Obra
Período
Situação
Exemplo:

Obra: Todas ▼
Período: Últimos 30 dias ▼
Situação: Todas ▼

Os filtros devem atualizar visualmente os indicadores e gráficos da Dashboard.

Ação rápida
Adicionar um botão de destaque:

“+ Nova Amostra”

Esse botão deve direcionar o usuário para a tela Cadastro de Amostra de Concreto já criada.

Navegação
Integrar a nova Dashboard ao fluxo existente.

Criar uma navegação inferior mobile (bottom navigation) contendo:

Dashboard
Nova Amostra
Histórico
A aba Dashboard deve estar destacada quando estiver selecionada.

Fluxo esperado:

Dashboard → Nova Amostra → Cadastro de Amostra

Dashboard → Histórico → Histórico de Amostras

Dashboard → selecionar uma amostra recente → Detalhes da amostra, caso seja necessário criar essa tela como parte do protótipo.

Dados mockados
Utilizar exclusivamente dados fictícios/mockados para demonstrar o funcionamento.

Os dados da Dashboard devem ser coerentes com os dados utilizados nas telas de Cadastro, Confirmação e Histórico.

Exemplo de dados:

Obra: Edifício Alfa
Total de amostras: 24
Aguardando rompimento: 12
Resultado registrado: 10
Novas amostras no período: 6
Localizações: Pilar P12, Laje L03, Viga V08, Fundação F02
Datas: 01/09/2026 a 07/09/2026
Responsividade
Priorizar a experiência mobile-first, mas estruturar os componentes de forma que a Dashboard também possa ser adaptada para tablet e desktop.

No mobile:

Cards devem ser empilhados ou organizados em uma grade de 2 colunas quando houver espaço.
Gráficos devem ocupar a largura disponível.
Filtros podem ser apresentados em uma área horizontal com rolagem.
A navegação inferior deve permanecer acessível.
Evitar excesso de informações simultaneamente na tela.
Resultado esperado
O resultado deve parecer uma Dashboard real de um MVP de controle tecnológico de concreto, integrada às telas já existentes do SGF.

A prioridade é permitir que um fiscal ou gestor, ao abrir a Dashboard, consiga responder rapidamente:

Quantas amostras temos?
Onde foram coletadas?
Quando foram cadastradas?
Quais estão aguardando rompimento?
Quais já possuem resultado registrado?

Não adicionar funcionalidades de análise estrutural, aprovação/reprovação ou regras normativas. A Dashboard deve ser exclusivamente uma visão gerencial dos dados coletados e registrados no sistema.