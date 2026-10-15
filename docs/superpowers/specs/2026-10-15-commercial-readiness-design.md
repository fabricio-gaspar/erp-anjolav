# AnjoLav ERP — estabilização e prontidão comercial

**Data:** 15 de outubro de 2026  
**Status:** design aprovado para revisão do proprietário

## Objetivo

Levar o AnjoLav ERP de pré-produção para uma base comercial de SaaS multiempresa, preservando os dados e as regras atuais de operação industrial e residencial. A entrega deve corrigir os defeitos observados, tornar os fluxos mais claros, reduzir o custo das consultas, reforçar isolamento por empresa e preparar integrações de produção sem ativar cobranças ou emissão fiscal fictícias.

## Resultado esperado

Após as fases implementadas e homologadas, o produto deverá ter:

- navegação consistente por área e permissões;
- painel financeiro que consulta somente os dados agregados necessários;
- fidelidade funcional no banco, PDV, ROL, cadastro de cliente e portal;
- impressão confiável pelo diálogo do navegador, com uma arquitetura separada para futura ponte local Epson;
- RLS e funções de banco revisadas, índices medidos e monitoramento de falhas;
- testes automatizados de regras críticas, navegação, autorização entre empresas e fluxos de pagamento;
- administração SaaS para ciclo de vida de empresas sem cobrança automática;
- integração NFS-e mantida desativada e fail-closed até haver município, provedor e credenciais homologadas.

## Premissas e limites

1. O produto é um SaaS multiempresa. Cada empresa é isolada por `tenant_id` e as políticas RLS continuam sendo a barreira de dados obrigatória.
2. Nenhuma migração remove dados ou reduz permissões sem uma substituição validada.
3. Cobrança recorrente SaaS, PIX/cobranças reais, NFS-e e impressora silenciosa não serão ativados sem configuração válida do provedor e homologação externa.
4. Credenciais, senhas, certificados e chaves não serão inseridos no repositório ou exibidos em logs.
5. Cada alteração será testada localmente antes de ser publicada. Banco e Edge Functions serão aplicados em uma sequência versionada e verificável.
6. A publicação será feita somente depois de build, lint, testes e smoke tests da versão correspondente.

## Diagnóstico incorporado

- O Financeiro publicado falha por consultas históricas sem agregação/paginação e por custo acumulado de RLS e índices ausentes.
- A migration de fidelidade e as alterações posteriores do pagamento não estão implantadas no Supabase ativo.
- A rota `/central/auditoria` é exibida no código de navegação, mas não existe no roteador nem no mapa de permissões.
- A página inicial fixa Central, mesmo para usuários que só têm acesso Industrial ou Residencial.
- A barra lateral verifica módulo, mas não área; há links de Configurações duplicados e rótulos operacionais imprecisos.
- O Portal não apresenta fidelidade ao cliente.
- A impressão possui um caminho seguro para aguardar o spooler, mas ainda há caminhos que fecham a janela imediatamente após `print()`.
- O adaptador NFS-e foi concebido corretamente para falhar fechado, porém ainda não tem adaptador de provedor.
- A instância Supabase tem avisos de proteção contra senha vazada, exposição GraphQL, RLS por linha e chaves estrangeiras sem índices.
- A aplicação tem testes unitários e estáticos, mas não possui testes E2E ou de carga para os fluxos comerciais.

## Arquitetura proposta

### 1. Financeiro e desempenho

Substituir agregações feitas no navegador por uma API/RPC de leitura exclusiva para o dashboard financeiro. A rotina aceitará um intervalo de datas e um escopo operacional, devolverá apenas totais, contagens e vencimentos necessários e será protegida por contexto do tenant e da área. A interface passará a carregar widgets de forma independente, com estado de erro e repetição por widget.

Os índices serão adicionados a partir dos planos de execução das consultas críticas: faturas, contas a pagar, movimentos de caixa, ordens, pagamentos e filtros de tenant/área/data. Políticas RLS com chamadas de autenticação por linha serão reescritas para cache por consulta quando for seguro. Índices sem uso não serão removidos antes de uma linha de base de produção.

### 2. Navegação, autorização e experiência

O ponto de entrada escolherá a primeira área autorizada do funcionário, em vez de sempre redirecionar para Central. A barra lateral consumirá uma única fonte de verdade de rota, módulo e área. A rota de Auditoria será implementada como consulta somente leitura dos eventos auditáveis do tenant, acessível apenas a administradores autorizados; se o requisito não puder ser atendido pela RLS vigente, o item será removido até a entrega da tela.

Industrial terá nomes coerentes com a tarefa: Ordens de Serviço, Produção, Faturamento/Lançamentos e Análises. Residencial concentrará atendimento, PDV, clientes e fidelidade. Configurações permanecerá uma função administrativa Central, sem duplicação que mude silenciosamente de área. A busca global preservará a classificação e levará cada resultado para o espaço operacional correto.

### 3. Fidelidade e Portal

A migration existente de fidelidade será aplicada e validada antes de expor a funcionalidade. O crédito continuará ocorrendo somente após pagamento integral e acima do mínimo configurado; resgates continuarão atômicos, idempotentes e limitados ao saldo e à OS residencial.

O Portal passará a devolver e exibir resumo de pontos, valor estimado, regras de resgate e histórico limitado do próprio cliente. O ROL continuará informando pontos apenas quando a configuração do tenant permitir. Nenhum dado de outro cliente ou empresa poderá ser lido pelo Portal.

### 4. Impressão

Todos os caminhos de ROL e etiqueta usarão o mesmo serviço de impressão seguro, que escapa o conteúdo e não fecha prematuramente a janela. A configuração Epson TM-T20X continuará como orientação para o diálogo de impressão do Windows. Impressão direta, seleção automática de impressora, fila e telemetria serão tratados como uma futura ponte local autenticada e auditada, nunca como acesso oculto do navegador ao sistema operacional.

### 5. Segurança e confiabilidade

Serão corrigidos avisos de maior risco que não exigem decisão de negócio: proteção contra senhas vazadas, restrição de schema GraphQL quando não necessário, revisão explícita de `SECURITY DEFINER`, cabeçalhos de segurança no host, limites de taxa e rastreabilidade de falhas.

Webhooks e integrações assíncronas terão registro de tentativas, reprocessamento idempotente, estado de falha e alerta operacional. E-mail transacional continuará desacoplado até que um provedor seja configurado. Logs deverão remover dados sensíveis e expor um identificador de correlação para suporte.

### 6. Administração SaaS

Será introduzida uma camada administrativa separada da operação de lavanderia para status de empresas, planos de capacidade, limites de uso, onboarding, suspensão controlada e trilha de auditoria. Ela não criará cobranças automáticas, boletos, PIX ou assinaturas sem valores, periodicidade, política de inadimplência e conta de cobrança definidos pelo proprietário.

### 7. NFS-e e pagamentos reais

O adaptador NFS-e permanecerá desativado por padrão e retornará erro explícito quando não houver provedor homologado. A futura ativação exigirá município, provedor, ambiente de homologação, certificado/credenciais armazenados em cofre e testes de emissão, consulta, cancelamento e contingência.

O fluxo de PIX e cartão manterá idempotência e confirmação por webhook. A homologação real de Asaas e demais adquirentes ficará bloqueada até credenciais e dados empresariais válidos serem fornecidos fora do repositório.

## Entregas em fases

1. **Estabilização:** alinhamento de migrations e Edge Functions, consulta financeira agregada, correções de rotas, área/permissão e impressão.
2. **Segurança e dados:** RLS, índices, políticas, avisos Supabase, proteção de autenticação e observabilidade.
3. **Produto:** Fidelidade no Portal, tela de Auditoria, administração SaaS sem cobrança automática e melhoria de busca/navegação.
4. **Qualidade:** testes unitários, integração, E2E multiempresa, regressão visual em desktop/mobile e testes de carga das consultas financeiras.
5. **Publicação:** migration versionada, deploy das Edge Functions, build do frontend, smoke tests autenticados, monitoramento pós-publicação e registro de versão.

## Critérios de aceite

- Financeiro carrega sem timeout com dados reais do tenant de teste e não baixa o histórico completo para calcular cartões.
- Um usuário de cada área entra diretamente em uma área que possui e não vê links sem autorização.
- Dois tenants distintos não conseguem ler, gravar ou inferir dados um do outro em testes negativos.
- Fidelidade credita, resgata, estorna e imprime no ROL apenas quando as regras permitem; o Portal mostra somente o próprio saldo.
- ROL e etiqueta não fecham a janela antes do diálogo do Windows receber o trabalho.
- Build, typecheck, testes, lint sem novos avisos e E2E crítico passam no CI.
- NFS-e e cobrança SaaS permanecem bloqueadas de modo explícito enquanto a configuração externa não existir.
- A publicação aponta para a mesma versão de migrations, Edge Functions e frontend testada.

## Decisões futuras necessárias

Para ativar faturamento SaaS ou NFS-e reais, o proprietário deverá fornecer, em canal seguro, política comercial, valores, periodicidade, dados empresariais, provedor escolhido e credenciais de homologação/produção. Essas informações não são necessárias para as correções estruturais desta especificação.
