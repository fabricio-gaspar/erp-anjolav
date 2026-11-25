# Bridge NFS-e de homologação

Este serviço é uma implementação em desenvolvimento para a produção restrita da NFS-e Nacional. A emissão em produção é recusada no código; não liberar ou publicar até concluir a homologação e a revisão fiscal e de segurança.

O serviço escuta apenas em `127.0.0.1`; exige proxy autenticado com TLS e rede privada entre a Edge Function e o serviço. Não expor a porta HTTP à internet. Configure banco isolado, migrations, certificado A1, perfis e proxy por empresa. As credenciais nunca devem ser incluídas em Git, exemplos reais ou respostas HTTP.

Dependências: Node 24 e PostgreSQL. Instale via `npm ci`, execute `npm test` e inicie com `npm start`. O servidor exige `DATABASE_URL`, `NFSE_BRIDGE_TOKEN` (mínimo 32 bytes), `NFSE_PROFILE_DIR` (diretório absoluto) e `PORT` opcional. O diretório e seus arquivos devem ser legíveis apenas pelo usuário do processo.

A Edge Function envia `credentialRef`; essa referência seleciona o arquivo `<referência>.json` no diretório de perfis. O administrador deve configurar um arquivo por emitente com `tenantId`, `emitterId`, `cnpj`, `serie`, `certificatePath` absoluto, `passwordEnv` (nome começando por `NFSE_CERT_PASS_`), e `fiscal`: `codigoTributacaoNacional`, `regime` e `valoresTributarios` nos formatos do open-nfse. Todos os dados tributários devem ser confirmados pelo responsável fiscal. O documento do tomador precisa de código IBGE: para endereços sem esse campo, o perfil pode conter `municipios`, um mapa explícito de `CIDADE|UF` para o código IBGE de sete dígitos. A ausência ou divergência bloqueia o pedido.

O banco usa as tabelas privadas `nfse_bridge_private` para reservar a DPS e registrar o resultado. A conta de serviço deve ter somente as permissões necessárias nessas tabelas; configure TLS do PostgreSQL com validação de certificado em qualquer ambiente remoto. Backups e retenção dos documentos devem obedecer às políticas fiscais e de privacidade aplicáveis.

As operações aceitas são `POST /v1/nfse/emitir`, `/v1/nfse/consultar` e `/v1/nfse/cancelar`. O cabeçalho `Authorization: Bearer …` e `Idempotency-Key` são exigidos. Cada tentativa reserva sua DPS antes da transmissão; em falha ambígua, uma tentativa repetida é bloqueada até consulta oficial. O cancelamento também é persistido antes de enviar; resultado incerto precisa de conferência oficial.

## Limitações pendentes

- A implantação e os testes com certificado real no ambiente oficial ainda são necessários.
- A geração e o arquivamento do DANFSe conforme o leiaute oficial devem ser completados e homologados. O bridge conserva o XML autorizado.
- Ainda são necessários testes de integração completos para emissão, cancelamento e sua reconciliação, substituição, permissões entre empresas, falhas e recuperação.
- A seleção e configuração tributária, a identificação do município e o suporte completo ao CNPJ alfanumérico em todos os cadastros precisam de validação integrada.
- Não há suporte à substituição neste serviço e nenhuma rotina de reenvio automático foi liberada.
