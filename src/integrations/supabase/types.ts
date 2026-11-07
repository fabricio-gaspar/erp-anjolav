Warning: truncated output (original token count: 44246)
Total output lines: 5600

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          frequencia: string | null
          horario: string | null
          id: string
          motorista_id: string | null
          observacoes: string | null
          recorrente: boolean | null
          status: string | null
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data: string
          frequencia?: string | null
          horario?: string | null
          id?: string
          motorista_id?: string | null
          observacoes?: string | null
          recorrente?: boolean | null
          status?: string | null
          tenant_id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          frequencia?: string | null
          horario?: string | null
          id?: string
          motorista_id?: string | null
          observacoes?: string | null
          recorrente?: boolean | null
          status?: string | null
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_agendamentos_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_agendamentos_motorista"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_recorrencia_operacoes: {
        Row: {
          cliente_id: string
          created_at: string
          criado_por: string
          id: string
          idempotency_key: string
          request_fingerprint: string
          resultado: Json
          tenant_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          criado_por: string
          id?: string
          idempotency_key: string
          request_fingerprint: string
          resultado?: Json
          tenant_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          criado_por?: string
          id?: string
          idempotency_key?: string
          request_fingerprint?: string
          resultado?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_recorrencia_operacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_recorrencia_operacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      area_permissoes: {
        Row: {
          area: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          entity_id: string | null
          entity_schema: string
          entity_table: string
          id: string
          new_data: Json | null
          occurred_at: string
          old_data: Json | null
          tenant_id?: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          entity_id?: string | null
          entity_schema: string
          entity_table: string
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          entity_id?: string | null
          entity_schema?: string
          entity_table?: string
          id?: string
          new_data?: Json | null
          occurred_at?: string
          old_data?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_charges: {
        Row: {
          asaas_id: string | null
          bank_slip_url: string | null
          billing_type: string
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          created_at: string
          customer_cpf_cnpj: string | null
          customer_email: string | null
          customer_name: string
          description: string
          due_date: string
          external_reference: string | null
          id: string
          invoice_url: string | null
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_id?: string | null
          bank_slip_url?: string | null
          billing_type: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          created_at?: string
          customer_cpf_cnpj?: string | null
          customer_email?: string | null
          customer_name: string
          description: string
          due_date: string
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_id?: string | null
          bank_slip_url?: string | null
          billing_type?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          created_at?: string
          customer_cpf_cnpj?: string | null
          customer_email?: string | null
          customer_name?: string
          description?: string
          due_date?: string
          external_reference?: string | null
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_charges_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_charges_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhook_events: {
        Row: {
          charge_id: string | null
          event_type: string
          id: string
          attempt_count: number
          last_error: string | null
          payload: Json
          payment_id: string | null
          processed_at: string | null
          processing_status: string
          received_at: string
        }
        Insert: {
          charge_id?: string | null
          event_type: string
          id?: string
          attempt_count?: number
          last_error?: string | null
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
        }
        Update: {
          charge_id?: string | null
          event_type?: string
          id?: string
          attempt_count?: number
          last_error?: string | null
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asaas_webhook_events_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "asaas_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes_config: {
        Row: {
          ativo: boolean | null
          configuracao: Json | null
          created_at: string | null
          id: string
          proxima_execucao: string | null
          tipo: string
          ultima_execucao: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          configuracao?: Json | null
          created_at?: string | null
          id?: string
          proxima_execucao?: string | null
          tipo: string
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          configuracao?: Json | null
          created_at?: string | null
          id?: string
          proxima_execucao?: string | null
          tipo?: string
          ultima_execucao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      beneficios_catalogo: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          ordem: number
          tenant_id: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "beneficios_catalogo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_movimentacoes: {
        Row: {
          caixa_id: string
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          criado_por: string | null
          created_at: string
          descricao: string | null
          evento_pagamento: string | null
          forma_pagamento: string | null
          id: string
          idempotency_key: string | null
          ordem_servico_id: string | null
          pdv_pagamento_id: string | null
          request_fingerprint: string | null
          tipo: string
          valor: number
        }
        Insert: {
          caixa_id: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          criado_por?: string | null
          created_at?: string
          descricao?: string | null
          evento_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          idempotency_key?: string | null
          ordem_servico_id?: string | null
          pdv_pagamento_id?: string | null
          request_fingerprint?: string | null
          tipo: string
          valor: number
        }
        Update: {
          caixa_id?: string
          categoria_id?: string | null
          centro_custo_id?: string | null
          cliente_id?: string | null
          criado_por?: string | null
          created_at?: string
          descricao?: string | null
          evento_pagamento?: string | null
          forma_pagamento?: string | null
          id?: string
          idempotency_key?: string | null
          ordem_servico_id?: string | null
          pdv_pagamento_id?: string | null
          request_fingerprint?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentacoes_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_pdv_pagamento_id_fkey"
            columns: ["pdv_pagamento_id"]
            isOneToOne: false
            referencedRelation: "pdv_pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          aberto_por: string | null
          abertura_idempotency_key: string | null
          abertura_request_fingerprint: string | null
          created_at: string
          data_abertura: string
          data_fechamento: string | null
          diferenca: number | null
          fechado_por: string | null
          fechamento_idempotency_key: string | null
          fechamento_request_fingerprint: string | null
          fechamento_resumo: Json
          id: string
          identificador_caixa: string
          observacoes: string | null
          operador: string
          operador_id: string | null
          status: string
          updated_at: string
          valor_abertura: number
          valor_contado: number | null
          valor_esperado: number
          valor_reforcos: number
          valor_sangrias: number
          valor_vendas: number
        }
        Insert: {
          aberto_por?: string | null
          abertura_idempotency_key?: string | null
          abertura_request_fingerprint?: string | null
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          diferenca?: number | null
          fechado_por?: string | null
          fechamento_idempotency_key?: string | null
          fechamento_request_fingerprint?: string | null
          fechamento_resumo?: Json
          id?: string
          identificador_caixa?: string
          observacoes?: string | null
          operador: string
          operador_id?: string | null
          status?: string
          updated_at?: string
          valor_abertura?: number
          valor_contado?: number | null
          valor_esperado?: number
          valor_reforcos?: number
          valor_sangrias?: number
          valor_vendas?: number
        }
        Update: {
          aberto_por?: string | null
          abertura_idempotency_key?: string | null
          abertura_request_fingerprint?: string | null
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          diferenca?: number | null
          fechado_por?: string | null
          fechamento_idempotency_key?: string | null
          fechamento_request_fingerprint?: string | null
          fechamento_resumo?: Json
          id?: string
          identificador_caixa?: string
          observacoes?: string | null
          operador?: string
          operador_id?: string | null
          status?: string
          updated_at?: string
          valor_abertura?: number
          valor_contado?: number | null
          valor_esperado?: number
          valor_reforcos?: number
          valor_sangrias?: number
          valor_vendas?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixas_operador_id_fkey"
            columns: ["operador_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tenant_id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      centros_custo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          classificacao: string
          contato: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          regime_tributario: string | null
          tabela_preco_tipo: string
          telefone: string | null
          telefone2: string | null
          tenant_id: string
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          classificacao?: string
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          regime_tributario?: string | null
          tabela_preco_tipo?: string
          telefone?: string | null
          telefone2?: string | null
          tenant_id?: string
          tipo_pessoa?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          classificacao?: string
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          regime_tributario?: string | null
          tabela_preco_tipo?: string
          telefone?: string | null
          telefone2?: string | null
          tenant_id?: string
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_cliente: {
        Row: {
          cliente_id: string
          codigo_acesso: string | null
          created_at: string
          dias_entrega: string[] | null
          dias_retirada: string[] | null
          frequencia: string | null
          horario_entrega: string | null
          horario_retirada: string | null
          id: string
          link_acesso: string | null
          tenant_id: string
          tipo_relatorio: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          codigo_acesso?: string | null
          created_at?: string
          dias_entrega?: string[] | null
          dias_retirada?: string[] | null
          frequencia?: string | null
          horario_entrega?: string | null
          horario_retirada?: string | null
          id?: string
          link_acesso?: string | null
          tenant_id?: string
          tipo_relatorio?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          codigo_acesso?: string | null
          created_at?: string
          dias_entrega?: string[] | null
          dias_retirada?: string[] | null
          frequencia?: string | null
          horario_entrega?: string | null
          horario_retirada?: string | null
          id?: string
          link_acesso?: string | null
          tenant_id?: string
          tipo_relatorio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_configuracoes_cliente_cliente"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_fiscais: {
        Row: {
          aliquota_iss: number | null
          ambiente: string | null
          ativo: boolean
          certificado_url: string | null
          cnpj: string | null
          codigo_municipio_ibge: string | null
          codigo_servico: string | null
          created_at: string
          csc_dados: Json | null
          endereco: Json | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          modo_emissao: string | null
          nome: string
          razao_social: string | null
          regime_tributario: string | null
          senha_certificado_encrypted: string | null
          series_numeracao: Json | null
          updated_at: string
          url_api_nfse: string | null
          urls_webservice: Json | null
          validade_certificado: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          ambiente?: string | null
          ativo?: boolean
          certificado_url?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
          codigo_servico?: string | null
          created_at?: string
          csc_dados?: Json | null
          endereco?: Json | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          modo_emissao?: string | null
          nome: string
          razao_social?: string | null
          regime_tributario?: string | null
          senha_certificado_encrypted?: string | null
          series_numeracao?: Json | null
          updated_at?: string
          url_api_nfse?: string | null
          urls_webservice?: Json | null
          validade_certificado?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          ambiente?: string | null
          ativo?: boolean
          certificado_url?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
          codigo_servico?: string | null
          created_at?: string
          csc_dados?: Json | null
          endereco?: Json | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          modo_emissao?: string | null
          nome?: string
          razao_social?: string | null
          regime_tributario?: string | null
          senha_certificado_encrypted?: string | null
          series_numeracao?: Json | null
          updated_at?: string
          url_api_nfse?: string | null
          urls_webservice?: Json | null
          validade_certificado?: string | null
        }
        Relationships: []
      }
      configuracoes_gerais: {
        Row: {
          banco_agencia: string | null
          banco_conta: string | null
          banco_nome: string | null
          banco_titular: string | null
          cor_primaria: string | null
          created_at: string
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_latitude: number | null
          endereco_logradouro: string | null
          endereco_longitude: number | null
          endereco_numero: string | null
          endereco_uf: string | null
          id: string
          logo_url: string | null
          nome_empresa: string | null
          pix_chave: string | null
          pix_tipo_chave: string | null
          template_boleto: string | null
          template_pix: string | null
          template_transferencia: string | null
          updated_at: string
          whatsapp_numero: string | null
        }
        Insert: {
          banco_agencia?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_titular?: string | null
          cor_primaria?: string | null
          created_at?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_latitude?: number | null
          endereco_logradouro?: string | null
          endereco_longitude?: number | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          pix_chave?: string | null
          pix_tipo_chave?: string | null
          template_boleto?: string | null
          template_pix?: string | null
          template_transferencia?: string | null
          updated_at?: string
          whatsapp_numero?: string | null
        }
        Update: {
          banco_agencia?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_titular?: string | null
          cor_primaria?: string | null
          created_at?: string
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_latitude?: number | null
          endereco_logradouro?: string | null
          endereco_longitude?: number | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          id?: string
          logo_url?: string | null
          nome_empresa?: string | null
          pix_chave?: string | null
          pix_tipo_chave?: string | null
          template_boleto?: string | null
          template_pix?: string | null
          template_transferencia?: string | null
          updated_at?: string
          whatsapp_numero?: string | null
        }
        Relationships: []
      }
      configuracoes_pagamento_cliente: {
        Row: {
          cliente_id: string
          cnpj_emissor_id: string | null
          condicao_pagamento: string | null
          created_at: string
          descricao_nf_id: string | null
          dia_fechamento: number | null
          dia_vencimento: number | null
          forma_pagamento: string | null
          id: string
          listar_itens_detalhados: boolean | null
          observacao_faturamento: string | null
          tipo_faturamento: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          cnpj_emissor_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          descricao_nf_id?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          id?: string
          listar_itens_detalhados?: boolean | null
          observacao_faturamento?: string | null
          tipo_faturamento?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          cnpj_emissor_id?: string | null
          condicao_pagamento?: string | null
          created_at?: string
          descricao_nf_id?: string | null
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          id?: string
          listar_itens_detalhados?: boolean | null
          observacao_faturamento?: string | null
          tipo_faturamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_pagamento_cliente_cnpj_emissor_id_fkey"
            columns: ["cnpj_emissor_id"]
            isOneToOne: false
            referencedRelation: "configuracoes_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "configuracoes_pagamento_cliente_descricao_nf_id_fkey"
            columns: ["descricao_nf_id"]
            isOneToOne: false
            referencedRelation: "descricoes_servicos_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_configuracoes_pagamento_cliente"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          atualizado_por: string | null
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          categoria: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          created_at: string
          criado_por: string | null
          data_pagamento: string | null
          descricao: string
          fornecedor: string | null
          fornecedor_id: string | null
          id: string
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor: number
          valor_pago: number
          versao: number
          vencimento: string
        }
        Insert: {
          atualizado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          categoria?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao: string
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor: number
          valor_pago?: number
          versao?: number
          vencimento: string
        }
        Update: {
          atualizado_por?: string | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          categoria?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          descricao?: string
          fornecedor?: string | null
          fornecedor_id?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
          valor_pago?: number
          versao?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_operacoes: {
        Row: {
          conta_pagar_id: string
          created_at: string
          criado_por: string | null
          dados: Json
          id: string
          idempotency_key: string
          pagamento_id: string | null
          request_fingerprint: string
          resultado: Json
          tenant_id: string
          tipo: string
        }
        Insert: {
          conta_pagar_id: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          idempotency_key: string
          pagamento_id?: string | null
          request_fingerprint: string
          resultado?: Json
          tenant_id?: string
          tipo: string
        }
        Update: {
          conta_pagar_id?: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          idempotency_key?: string
          pagamento_id?: string | null
          request_fingerprint?: string
          resultado?: Json
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_operacoes_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_operacoes_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar_pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_pagamentos: {
        Row: {
          conta_pagar_id: string
          created_at: string
          criado_por: string | null
          data_pagamento: string
          forma_pagamento: string
          id: string
          idempotency_key: string
          observacoes: string | null
          referencia: string | null
          request_fingerprint: string
          status: string
          tenant_id: string
          valor: number
        }
        Insert: {
          conta_pagar_id: string
          created_at?: string
          criado_por?: string | null
          data_pagamento: string
          forma_pagamento: string
          id?: string
          idempotency_key: string
          observacoes?: string | null
          referencia?: string | null
          request_fingerprint: string
          status?: string
          tenant_id?: string
          valor: number
        }
        Update: {
          conta_pagar_id?: string
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string
          forma_pagamento?: string
          id?: string
          idempotency_key?: string
          observacoes?: string | null
          referencia?: string | null
          request_fingerprint?: string
          status?: string
          tenant_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_pagamentos_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_operacoes: {
        Row: {
          contrato_id: string
          created_at: string
          criado_por: string | null
          dados: Json
          id: string
          idempotency_key: string
          request_fingerprint: string
          resultado: Json
          tenant_id: string
          tipo: string
          versao_anterior: number | null
          versao_nova: number
        }
        Insert: {
          contrato_id: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          idempotency_key: string
          request_fingerprint: string
          resultado?: Json
          tenant_id?: string
          tipo: string
          versao_anterior?: number | null
          versao_nova: number
        }
        Update: {
          contrato_id?: string
          created_at?: string
          criado_por?: string | null
          dados?: Json
          id?: string
          idempotency_key?: string
          request_fingerprint?: string
          resultado?: Json
          tenant_id?: string
          tipo?: string
          versao_anterior?: number | null
          versao_nova?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_operacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_aluguel"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_aluguel: {
        Row: {
          ativo: boolean
          autoriza_faturamento: boolean
          cliente_id: string
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string
          dia_fechamento: number | null
          dia_vencimento: number
          encerrado_em: string | null
          encerrado_por: string | null
          encerramento_motivo: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          periodicidade_fechamento: string
          regras_comerciais: string | null
          tenant_id: string
          updated_at: string
          atualizado_por: string | null
          valor_servico: number
          versao: number
        }
        Insert: {
          ativo?: boolean
          autoriza_faturamento?: boolean
          cliente_id: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_fechamento?: number | null
          dia_vencimento?: number
          encerrado_em?: string | null
          encerrado_por?: string | null
          encerramento_motivo?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          periodicidade_fechamento?: string
          regras_comerciais?: string | null
          tenant_id?: string
          updated_at?: string
          atualizado_por?: string | null
          valor_servico?: number
          versao?: number
        }
        Update: {
          ativo?: boolean
          autoriza_faturamento?: boolean
          cliente_id?: string
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string
          dia_fechamento?: number | null
          dia_vencimento?: number
          encerrado_em?: string | null
          encerrado_por?: string | null
          encerramento_motivo?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          periodicidade_fechamento?: string
          regras_comerciais?: string | null
          tenant_id?: string
          updated_at?: string
          atualizado_por?: string | null
          valor_servico?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_aluguel_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      descricoes_servicos_fiscais: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      enderecos_clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          created_at: string
          id: string
          instrucoes: string | null
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          nome: string | null
          numero: string | null
          pais: string | null
          principal: boolean
          tipo: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          created_at?: string
          id?: string
          instrucoes?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string | null
          numero?: string | null
          pais?: string | null
          principal?: boolean
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          created_at?: string
          id?: string
          instrucoes?: string | null
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          nome?: string | null
          numero?: string | null
          pais?: string | null
          principal?: boolean
          tipo?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_enderecos_clientes"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          fornecedor_id: string | null
          id: string
          localizacao: string | null
          nome: string
          preco_custo: number
          quantidade_atual: number
          quantidade_minima: number
          tenant_id: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          preco_custo?: number
          quantidade_atual?: number
          quantidade_minima?: number
          tenant_id?: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          preco_custo?: number
          quantidade_atual?: number
          quantidade_minima?: number
          tenant_id?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas_configuracoes: {
        Row: {
          altura_codigo_barras: number | null
          created_at: string
          id: string
          margem_lateral: number | null
          margem_superior: number | null
          modelo_impressora: string | null
          tamanho_etiqueta: string | null
          tamanho_fonte: number | null
          tipo_impressora: string | null
          updated_at: string
        }
        Insert: {
          altura_codigo_barras?: number | null
          created_at?: string
          id?: string
          margem_lateral?: number | null
          margem_superior?: number | null
          modelo_impressora?: string | null
          tamanho_etiqueta?: string | null
          tamanho_fonte?: number | null
          tipo_impressora?: string | null
          updated_at?: string
        }
        Update: {
          altura_codigo_barras?: number | null
          created_at?: string
          id?: string
          margem_lateral?: number | null
          margem_superior?: number | null
          modelo_impressora?: string | null
          tamanho_etiqueta?: string | null
          tamanho_fonte?: number | null
          tipo_impressora?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      eventos_agenda: {
        Row: {
          concluido: boolean
          cor: string | null
          created_at: string
          data_evento: string
          descricao: string | null
          horario: string | null
          id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          concluido?: boolean
          cor?: string | null
          created_at?: string
          data_evento: string
          descricao?: string | null
          horario?: string | null
          id?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          concluido?: boolean
          cor?: string | null
          created_at?: string
          data_evento?: string
          descricao?: string | null
          horario?: string | null
          id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      faturas: {
        Row: {
          asaas_charge_id: string | null
          boleto_linha_digitavel: string | null
          boleto_url: string | null
          canais_envio: string[] | null
          cancelado_em: string | null
          cancelado_por: string | null
          cancelamento_motivo: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          chave_acesso: string | null
          cliente_id: string
          created_at: string
          dados_transferencia: Json | null
          data_emissao_nf: string | null
          data_envio: string | null
          data_ultimo_pagamento: string | null
          data_vencimento: string | null
          descricao_servico: string | null
          destinatario_envio: string | null
          erros_sefaz: Json | null
          forma_pagamento: string | null
          id: string
          criado_por: string | null
          idempotency_key: string | null
          imposto_calculado: Json | null
          itens_snapshot: Json | null
          link_pdf_nf: string | null
          mensagem_enviada: string | null
          natureza_operacao: string | null
          numero_nf: string | null
          observacao_fatura: string | null
          periodo_fim: string
          periodo_inicio: string
          pix_copia_cola: string | null
          pix_qr_code: string | null
          protocolo_nfse: string | null
          relatorio_data: string | null
          relatorio_gerado: boolean | null
          request_fingerprint: string | null
          snapshot_cliente: Json | null
          snapshot_emitente: Json | null
          status: string
          status_pagamento: string
          status_sefaz: string | null
          tipo_relatorio: string | null
          tenant_id: string
          updated_at: string
          valor_total: number
          valor_pago: number
          versao_financeira: number
          vencimento_ajustado_por: string | null
          xml_nfse: string | null
        }
        Insert: {
          asaas_charge_id?: string | null
          boleto_linha_digitavel?: string | null
          boleto_url?: string | null
          canais_envio?: string[] | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          chave_acesso?: string | null
          cliente_id: string
          created_at?: string
          dados_transferencia?: Json | null
          data_emissao_nf?: string | null
          data_envio?: string | null
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          descricao_servico?: string | null
          destinatario_envio?: string | null
          erros_sefaz?: Json | null
          forma_pagamento?: string | null
          id?: string
          criado_por?: string | null
          idempotency_key?: string | null
          imposto_calculado?: Json | null
          itens_snapshot?: Json | null
          link_pdf_nf?: string | null
          mensagem_enviada?: string | null
          natureza_operacao?: string | null
          numero_nf?: string | null
          observacao_fatura?: string | null
          periodo_fim: string
          periodo_inicio: string
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          protocolo_nfse?: string | null
          relatorio_data?: string | null
          relatorio_gerado?: boolean | null
          request_fingerprint?: string | null
          snapshot_cliente?: Json | null
          snapshot_emitente?: Json | null
          status?: string
          status_pagamento?: string
          status_sefaz?: string | null
          tipo_relatorio?: string | null
          tenant_id?: string
          updated_at?: string
          valor_total?: number
          valor_pago?: number
          versao_financeira?: number
          vencimento_ajustado_por?: string | null
          xml_nfse?: string | null
        }
        Update: {
          asaas_charge_id?: string | null
          boleto_linha_digitavel?: string | null
          boleto_url?: string | null
          canais_envio?: string[] | null
          cancelado_em?: string | null
          cancelado_por?: string | null
          cancelamento_motivo?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          chave_acesso?: string | null
          cliente_id?: string
          created_at?: string
          dados_transferencia?: Json | null
          data_emissao_nf?: string | null
          data_envio?: string | null
          data_ultimo_pagamento?: string | null
          data_vencimento?: string | null
          descricao_servico?: string | null
          destinatario_envio?: string | null
          erros_sefaz?: Json | null
          forma_pagamento?: string | null
          id?: string
          criado_por?: string | null
          idempotency_key?: string | null
          imposto_calculado?: Json | null
          itens_snapshot?: Json | null
          link_pdf_nf?: string | null
          mensagem_enviada?: string | null
          natureza_operacao?: string | null
          numero_nf?: string | null
          observacao_fatura?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          pix_copia_cola?: string | null
          pix_qr_code?: string | null
          protocolo_nfse?: string | null
          relatorio_data?: string | null
          relatorio_gerado?: boolean | null
          request_fingerprint?: string | null
          snapshot_cliente?: Json | null
          snapshot_emitente?: Json | null
          status?: string
          status_pagamento?: string
          status_sefaz?: string | null
          tipo_relatorio?: string | null
          tenant_id?: string
          updated_at?: string
          valor_total?: number
          valor_pago?: number
          versao_financeira?: number
          vencimento_ajustado_por?: string | null
          xml_nfse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_asaas_charge_id_fkey"
            columns: ["asaas_charge_id"]
            isOneToOne: false
            referencedRelation: "asaas_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      fidelidade_configuracoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          portal_exibir_fidelidade: boolean
          pontos_minimos_resgate: number
          reais_por_ponto: number
          tenant_id: string
          updated_at: string
          valor_minimo_acumulo: number
          valor_por_ponto: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          portal_exibir_fidelidade?: boolean
          pontos_minimos_resgate?: number
          reais_por_ponto?: number
          tenant_id: string
          updated_at?: string
          valor_minimo_acumulo?: number
          valor_por_ponto?: number
        }
        Update: {
          ativo?: boolean
          portal_exibir_fidelidade?: boolean
          pontos_minimos_resgate?: number
          reais_por_ponto?: number
          valor_minimo_acumulo?: number
          valor_por_ponto?: number
          updated_at?: string
        }
        Relationships: []
      }
      fidelidade_lancamentos: {
        Row: {
          cliente_id: string
          created_at: string
          criado_por: string | null
          descricao: string
          id: string
          idempotency_key: string
          ordem_servico_id: string | null
          pontos: number
          tenant_id: string
          tipo: string
          valor_referencia: number | null
        }
        Insert: {
          cliente_id: string
          criado_por?: string | null
          descricao: string
          id?: string
          idempotency_key: string
          ordem_servico_id?: string | null
          pontos: number
          tenant_id: string
          tipo: string
          valor_referencia?: number | null
        }
        Update: never
        Relationships: []
      }
      folha_beneficios: {
        Row: {
          ativo: boolean
          beneficio_id: string | nul…14246 tokens truncated…
          },
        ]
      }
      qualidade_operacoes: {
        Row: {
          created_at: string
          criado_por: string
          id: string
          idempotency_key: string
          ordem_servico_id: string
          request_fingerprint: string
          resultado: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          id?: string
          idempotency_key: string
          ordem_servico_id: string
          request_fingerprint: string
          resultado?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          id?: string
          idempotency_key?: string
          ordem_servico_id?: string
          request_fingerprint?: string
          resultado?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qualidade_operacoes_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordem_anexos: {
        Row: {
          categoria: string
          content_type: string
          created_at: string
          criado_por: string
          descricao: string | null
          id: string
          nome_arquivo: string
          object_path: string
          ordem_servico_id: string
          size_bytes: number
          tenant_id: string
        }
        Insert: {
          categoria: string
          content_type: string
          created_at?: string
          criado_por: string
          descricao?: string | null
          id?: string
          nome_arquivo: string
          object_path: string
          ordem_servico_id: string
          size_bytes: number
          tenant_id?: string
        }
        Update: {
          categoria?: string
          content_type?: string
          created_at?: string
          criado_por?: string
          descricao?: string | null
          id?: string
          nome_arquivo?: string
          object_path?: string
          ordem_servico_id?: string
          size_bytes?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordem_anexos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordem_anexos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          agendamento_id: string | null
          capacidade_excecao: boolean
          capacidade_limite_snapshot: number | null
          capacidade_reservada: number
          cliente_id: string
          condicao_pagamento: string | null
          created_at: string
          data_entrega: string | null
          data_previsao_entrega: string | null
          data_retirada: string
          entrega_modalidade: string
          endereco_atendimento_snapshot: Json
          forma_pagamento: string | null
          id: string
          motorista_id: string | null
          numero: string
          observacoes: string | null
          origem: string
          pago_na_entrada: boolean | null
          pdv_idempotency_key: string | null
          percentual_urgencia: number | null
          prioridade: string | null
          recebimento_modalidade: string
          status: string
          status_fiscal: string
          status_logistica: string
          status_pagamento: string | null
          status_qualidade: string
          tabela_preco_tipo_snapshot: string
          tenant_id: string
          updated_at: string
          urgente: boolean | null
          valor_desconto: number | null
          valor_pago: number | null
          valor_total: number | null
          veiculo_id: string | null
          versao_producao: number
        }
        Insert: {
          agendamento_id?: string | null
          capacidade_excecao?: boolean
          capacidade_limite_snapshot?: number | null
          capacidade_reservada?: number
          cliente_id: string
          condicao_pagamento?: string | null
          created_at?: string
          data_entrega?: string | null
          data_previsao_entrega?: string | null
          data_retirada?: string
          entrega_modalidade?: string
          endereco_atendimento_snapshot?: Json
          forma_pagamento?: string | null
          id?: string
          motorista_id?: string | null
          numero: string
          observacoes?: string | null
          origem?: string
          pago_na_entrada?: boolean | null
          pdv_idempotency_key?: string | null
          percentual_urgencia?: number | null
          prioridade?: string | null
          recebimento_modalidade?: string
          status?: string
          status_fiscal?: string
          status_logistica?: string
          status_pagamento?: string | null
          status_qualidade?: string
          tabela_preco_tipo_snapshot?: string
          tenant_id?: string
          updated_at?: string
          urgente?: boolean | null
          valor_desconto?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          veiculo_id?: string | null
          versao_producao?: number
        }
        Update: {
          agendamento_id?: string | null
          capacidade_excecao?: boolean
          capacidade_limite_snapshot?: number | null
          capacidade_reservada?: number
          cliente_id?: string
          condicao_pagamento?: string | null
          created_at?: string
          data_entrega?: string | null
          data_previsao_entrega?: string | null
          data_retirada?: string
          entrega_modalidade?: string
          endereco_atendimento_snapshot?: Json
          forma_pagamento?: string | null
          id?: string
          motorista_id?: string | null
          numero?: string
          observacoes?: string | null
          origem?: string
          pago_na_entrada?: boolean | null
          pdv_idempotency_key?: string | null
          percentual_urgencia?: number | null
          prioridade?: string | null
          recebimento_modalidade?: string
          status?: string
          status_fiscal?: string
          status_logistica?: string
          status_pagamento?: string | null
          status_qualidade?: string
          tabela_preco_tipo_snapshot?: string
          tenant_id?: string
          updated_at?: string
          urgente?: boolean | null
          valor_desconto?: number | null
          valor_pago?: number | null
          valor_total?: number | null
          veiculo_id?: string | null
          versao_producao?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      paradas_rota: {
        Row: {
          agendamento_id: string | null
          assinatura_url: string | null
          atualizado_por: string | null
          cliente_id: string | null
          created_at: string
          endereco_snapshot: Json
          entrega_id: string | null
          foto_comprovante_url: string | null
          hora_chegada: string | null
          hora_saida: string | null
          id: string
          janela_fim: string | null
          janela_inicio: string | null
          motivo_nao_entrega: string | null
          observacoes: string | null
          ordem: number
          ordem_servico_id: string | null
          reagendada_para: string | null
          recebedor_documento: string | null
          recebedor_nome: string | null
          rota_id: string
          status: string
          tenant_id: string
          tentativas: number
          tipo: string
          updated_at: string
          versao: number
        }
        Insert: {
          agendamento_id?: string | null
          assinatura_url?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          endereco_snapshot?: Json
          entrega_id?: string | null
          foto_comprovante_url?: string | null
          hora_chegada?: string | null
          hora_saida?: string | null
          id?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          motivo_nao_entrega?: string | null
          observacoes?: string | null
          ordem: number
          ordem_servico_id?: string | null
          reagendada_para?: string | null
          recebedor_documento?: string | null
          recebedor_nome?: string | null
          rota_id: string
          status?: string
          tenant_id: string
          tentativas?: number
          tipo: string
          updated_at?: string
          versao?: number
        }
        Update: {
          agendamento_id?: string | null
          assinatura_url?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          created_at?: string
          endereco_snapshot?: Json
          entrega_id?: string | null
          foto_comprovante_url?: string | null
          hora_chegada?: string | null
          hora_saida?: string | null
          id?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          motivo_nao_entrega?: string | null
          observacoes?: string | null
          ordem?: number
          ordem_servico_id?: string | null
          reagendada_para?: string | null
          recebedor_documento?: string | null
          recebedor_nome?: string | null
          rota_id?: string
          status?: string
          tenant_id?: string
          tentativas?: number
          tipo?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "paradas_rota_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas_pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_rota_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_rota_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_rota_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paradas_rota_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_capacidades_diarias: {
        Row: {
          ativo: boolean
          area: string
          created_at: string
          data: string
          id: string
          limite_carga: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          area: string
          created_at?: string
          data: string
          id?: string
          limite_carga: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          area?: string
          created_at?: string
          data?: string
          id?: string
          limite_carga?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdv_capacidades_diarias_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdv_pagamentos: {
        Row: {
          asaas_charge_id: string | null
          bandeira: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string
          codigo_autorizacao: string | null
          confirmado_em: string | null
          created_at: string
          criado_por: string | null
          id: string
          idempotency_key: string
          metadata: Json
          metodo: string
          momento: string
          nsu: string | null
          ordem_servico_id: string
          parcelas: number
          provedor: string
          provedor_pagamento_id: string | null
          request_fingerprint: string | null
          status: string
          status_provedor: string | null
          tenant_id: string
          troco: number
          updated_at: string
          valor: number
          valor_alocado: number
          valor_nao_alocado: number
          valor_recebido: number | null
        }
        Insert: {
          asaas_charge_id?: string | null
          bandeira?: string | null
          caixa_id?: string | null
          cancelado_em?: string | null
          cliente_id: string
          codigo_autorizacao?: string | null
          confirmado_em?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          idempotency_key: string
          metadata?: Json
          metodo: string
          momento?: string
          nsu?: string | null
          ordem_servico_id: string
          parcelas?: number
          provedor: string
          provedor_pagamento_id?: string | null
          request_fingerprint?: string | null
          status?: string
          status_provedor?: string | null
          tenant_id?: string
          troco?: number
          updated_at?: string
          valor: number
          valor_alocado?: number
          valor_nao_alocado?: number
          valor_recebido?: number | null
        }
        Update: {
          asaas_charge_id?: string | null
          bandeira?: string | null
          caixa_id?: string | null
          cancelado_em?: string | null
          cliente_id?: string
          codigo_autorizacao?: string | null
          confirmado_em?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          idempotency_key?: string
          metadata?: Json
          metodo?: string
          momento?: string
          nsu?: string | null
          ordem_servico_id?: string
          parcelas?: number
          provedor?: string
          provedor_pagamento_id?: string | null
          request_fingerprint?: string | null
          status?: string
          status_provedor?: string | null
          tenant_id?: string
          troco?: number
          updated_at?: string
          valor?: number
          valor_alocado?: number
          valor_nao_alocado?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdv_pagamentos_asaas_charge_id_fkey"
            columns: ["asaas_charge_id"]
            isOneToOne: false
            referencedRelation: "asaas_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_pagamentos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdv_pagamentos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_config: {
        Row: {
          cor_primaria: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          modulos_visiveis: Json | null
          portal_ativo: boolean | null
          texto_boas_vindas: string | null
          updated_at: string | null
        }
        Insert: {
          cor_primaria?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          modulos_visiveis?: Json | null
          portal_ativo?: boolean | null
          texto_boas_vindas?: string | null
          updated_at?: string | null
        }
        Update: {
          cor_primaria?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          modulos_visiveis?: Json | null
          portal_ativo?: boolean | null
          texto_boas_vindas?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      precos_especiais: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          preco_especial: number
          produto_id: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          preco_especial: number
          produto_id: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          preco_especial?: number
          produto_id?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_precos_especiais_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_precos_especiais_produto"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          codigo: string | null
          composicao: string | null
          cor: string | null
          created_at: string
          descricao: string | null
          id: string
          instrucoes_especiais: string | null
          nome: string
          porte: string | null
          peso_medio_kg: number | null
          preco: number
          processo_lavagem: string | null
          requer_secadora: boolean | null
          status: string
          temperatura_maxima: number | null
          tempo_processo_min: number | null
          unidade: string | null
          unidade_negocio: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          composicao?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          instrucoes_especiais?: string | null
          nome: string
          porte?: string | null
          peso_medio_kg?: number | null
          preco?: number
          processo_lavagem?: string | null
          requer_secadora?: boolean | null
          status?: string
          temperatura_maxima?: number | null
          tempo_processo_min?: number | null
          unidade?: string | null
          unidade_negocio?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          composicao?: string | null
          cor?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          instrucoes_especiais?: string | null
          nome?: string
          porte?: string | null
          peso_medio_kg?: number | null
          preco?: number
          processo_lavagem?: string | null
          requer_secadora?: boolean | null
          status?: string
          temperatura_maxima?: number | null
          tempo_processo_min?: number | null
          unidade?: string | null
          unidade_negocio?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rol_configuracoes: {
        Row: {
          assinatura_cliente: boolean | null
          bloco: boolean | null
          cnpj: string | null
          cor_primaria: string | null
          cor_secundaria: string | null
          created_at: string
          email: string | null
          endereco: string | null
          exibir_fidelidade: boolean
          exibir_logo: boolean | null
          fonte_principal: string | null
          id: string
          largura_papel: string | null
          linha_desconto: boolean | null
          logo_url: string | null
          margem_lateral: number | null
          margem_superior: number | null
          nome_completo: string | null
          nome_curto: string
          observacoes: boolean | null
          previsao_entrega: boolean | null
          slogan: string | null
          tamanho_item: number | null
          tamanho_nome: number | null
          tamanho_total: number | null
          telefone: string | null
          texto_rodape: string | null
          tipo_impressora: string | null
          tipo_preco: boolean | null
          updated_at: string
        }
        Insert: {
          assinatura_cliente?: boolean | null
          bloco?: boolean | null
          cnpj?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          exibir_fidelidade?: boolean
          exibir_logo?: boolean | null
          fonte_principal?: string | null
          id?: string
          largura_papel?: string | null
          linha_desconto?: boolean | null
          logo_url?: string | null
          margem_lateral?: number | null
          margem_superior?: number | null
          nome_completo?: string | null
          nome_curto?: string
          observacoes?: boolean | null
          previsao_entrega?: boolean | null
          slogan?: string | null
          tamanho_item?: number | null
          tamanho_nome?: number | null
          tamanho_total?: number | null
          telefone?: string | null
          texto_rodape?: string | null
          tipo_impressora?: string | null
          tipo_preco?: boolean | null
          updated_at?: string
        }
        Update: {
          assinatura_cliente?: boolean | null
          bloco?: boolean | null
          cnpj?: string | null
          cor_primaria?: string | null
          cor_secundaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          exibir_fidelidade?: boolean
          exibir_logo?: boolean | null
          fonte_principal?: string | null
          id?: string
          largura_papel?: string | null
          linha_desconto?: boolean | null
          logo_url?: string | null
          margem_lateral?: number | null
          margem_superior?: number | null
          nome_completo?: string | null
          nome_curto?: string
          observacoes?: boolean | null
          previsao_entrega?: boolean | null
          slogan?: string | null
          tamanho_item?: number | null
          tamanho_nome?: number | null
          tamanho_total?: number | null
          telefone?: string | null
          texto_rodape?: string | null
          tipo_impressora?: string | null
          tipo_preco?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      rotas_entrega: {
        Row: {
          created_at: string
          criado_por: string | null
          data: string
          hora_retorno: string | null
          hora_saida: string | null
          id: string
          km_final: number | null
          km_inicial: number | null
          motorista_id: string | null
          observacoes: string | null
          status: string
          tenant_id: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data?: string
          hora_retorno?: string | null
          hora_saida?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          motorista_id?: string | null
          observacoes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data?: string
          hora_retorno?: string | null
          hora_saida?: string | null
          id?: string
          km_final?: number | null
          km_inicial?: number | null
          motorista_id?: string | null
          observacoes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotas_entrega_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_entrega_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_operacoes: {
        Row: {
          created_at: string
          criado_por: string
          endereco_anterior: Json | null
          endereco_novo: Json | null
          id: string
          idempotency_key: string
          parada_id: string | null
          payload: Json
          request_fingerprint: string
          resultado: Json
          rota_id: string | null
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          criado_por: string
          endereco_anterior?: Json | null
          endereco_novo?: Json | null
          id?: string
          idempotency_key: string
          parada_id?: string | null
          payload?: Json
          request_fingerprint: string
          resultado?: Json
          rota_id?: string | null
          tenant_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          endereco_anterior?: Json | null
          endereco_novo?: Json | null
          id?: string
          idempotency_key?: string
          parada_id?: string | null
          payload?: Json
          request_fingerprint?: string
          resultado?: Json
          rota_id?: string | null
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_operacoes_parada_id_fkey"
            columns: ["parada_id"]
            isOneToOne: false
            referencedRelation: "paradas_rota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_operacoes_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas_entrega"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          ano: number | null
          ativo: boolean
          cor: string | null
          created_at: string
          id: string
          modelo: string
          placa: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ano?: number | null
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          modelo: string
          placa: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number | null
          ativo?: boolean
          cor?: string | null
          created_at?: string
          id?: string
          modelo?: string
          placa?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_instancias: {
        Row: {
          api_key_encrypted: string | null
          api_url: string | null
          created_at: string
          id: string
          nome_instancia: string
          qr_code: string | null
          status: string
          updated_at: string
          webhook_n8n_url: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          nome_instancia?: string
          qr_code?: string | null
          status?: string
          updated_at?: string
          webhook_n8n_url?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          nome_instancia?: string
          qr_code?: string | null
          status?: string
          updated_at?: string
          webhook_n8n_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      v_contas_receber: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string | null
          data_recebimento: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string | null
          origem: string | null
          status: string | null
          valor: number | null
          valor_recebido: number | null
        }
        Relationships: []
      }
      v_fluxo_caixa: {
        Row: {
          categoria_id: string | null
          centro_custo_id: string | null
          cliente_id: string | null
          data: string | null
          descricao: string | null
          fornecedor_id: string | null
          id: string | null
          origem: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adicionar_parada_planejada: {
        Args: {
          _agendamento_id: string | null
          _cliente_id: string | null
          _idempotency_key: string
          _janela_fim: string | null
          _janela_inicio: string | null
          _observacoes: string | null
          _ordem_servico_id: string | null
          _rota_id: string
          _tipo: string
        }
        Returns: Json
      }
      abrir_caixa: {
        Args: {
          _idempotency_key: string
          _identificador_caixa: string
          _valor_abertura: number
        }
        Returns: Json
      }
      arquivar_endereco_cliente: {
        Args: { _cliente_id: string; _endereco_id: string }
        Returns: Json
      }
      atualizar_folha_aberta: {
        Args: {
          _campo: string
          _folha_id: string
          _idempotency_key: string
          _valor: number
          _versao_observada: number
        }
        Returns: Json
      }
      avancar_etapa_producao: {
        Args: {
          _dados_formulario: Json
          _etapa_esperada: string
          _funcionario_id: string | null
          _itens?: Json
          _observacoes: string | null
          _ordem_servico_id: string
          _proxima_etapa: string
        }
        Returns: Json
      }
      cancelar_ordem_servico: {
        Args: { _motivo: string; _ordem_servico_id: string }
        Returns: Json
      }
      cancelar_intencao_pagamento_pdv: {
        Args: { _pagamento_id: string; _status_provedor: string }
        Returns: Json
      }
      cancelar_conta_pagar: {
        Args: {
          _conta_id: string
          _idempotency_key: string
          _motivo: string
          _versao_esperada: number
        }
        Returns: Json
      }
      cancelar_fatura: {
        Args: {
          _fatura_id: string
          _idempotency_key: string
          _motivo: string
          _versao_esperada: number
        }
        Returns: Json
      }
      cancelar_lancamento_pendente: {
        Args: {
          _idempotency_key: string
          _lancamento_id: string
          _motivo: string
          _updated_at_observado: string
        }
        Returns: Json
      }
      cancelar_folha_aberta: {
        Args: {
          _folha_id: string
          _idempotency_key: string
          _motivo: string
          _versao_observada: number
        }
        Returns: Json
      }
      confirmar_retirada_agendamento: {
        Args: { _agendamento_id: string; _status_esperado: string }
        Returns: Json
      }
      configurar_capacidade_pdv: {
        Args: {
          _area: string
          _ativo?: boolean
          _data: string
          _limite_carga: number
        }
        Returns: Json
      }
      consultar_metricas_producao: {
        Args: {
          _inicio_hoje: string
          _setor: string
          _trinta_dias_atras: string
        }
        Returns: Json
      }
      salvar_endereco_cliente: {
        Args: {
          _bairro: string | null
          _cep: string | null
          _cidade: string
          _cliente_id: string
          _complemento: string | null
          _endereco_id: string | null
          _instrucoes: string | null
          _latitude: number | null
          _logradouro: string
          _longitude: number | null
          _nome: string | null
          _numero: string | null
          _pais: string
          _principal: boolean
          _tipo: string
          _uf: string
        }
        Returns: Json
      }
      consultar_dashboard_financeiro: {
        Args: { _fim: string; _inicio: string; _setor: string }
        Returns: Json
      }
      consultar_diretorio_caixas_fechados: {
        Args: {
          _busca?: string | null
          _diferenca?: string
          _fim_exclusivo: string
          _inicio: string
          _pagina?: number
          _tamanho_pagina?: number
        }
        Returns: Json
      }
      consultar_clientes_similares: {
        Args: {
          _classificacao: string
          _cliente_id: string | null
          _cpf_cnpj: string | null
          _email: string | null
          _razao_social: string
          _telefone: string | null
          _telefone2: string | null
        }
        Returns: Json
      }
      consultar_ficha_cliente: {
        Args: { _cliente_id: string }
        Returns: Json
      }
      consultar_diretorio_insumos: {
        Args: {
          _busca?: string | null
          _categoria?: string | null
          _pagina?: number
          _situacao?: string
          _tamanho?: number
        }
        Returns: Json
      }
      consultar_diretorio_locais_estoque: {
        Args: {
          _busca?: string | null
          _pagina?: number
          _situacao?: string
          _tamanho?: number
        }
        Returns: Json
      }
      consultar_diretorio_movimentacoes_estoque: {
        Args: {
          _busca?: string | null
          _pagina?: number
          _tamanho?: number
          _tipo?: string
        }
        Returns: Json
      }
      consultar_diretorio_pedidos_compra: {
        Args: {
          _busca?: string | null
          _pagina?: number
          _situacao?: string
          _tamanho?: number
        }
        Returns: Json
      }
      consultar_pedido_compra_detalhes: {
        Args: { _pedido_id: string }
        Returns: Json
      }
      consultar_saldos_local_estoque: {
        Args: {
          _busca?: string | null
          _estoque_local_id: string
          _pagina?: number
          _situacao?: string
          _tamanho?: number
        }
        Returns: Json
      }
      consultar_diretorio_contas_pagar: {
        Args: {
          _busca?: string | null
          _data_fim?: string | null
          _data_inicio?: string | null
          _pagina?: number
          _situacao?: string
          _tamanho_pagina?: number
        }
        Returns: Json
      }
      consultar_diretorio_contas_receber: {
        Args: {
          _busca?: string | null
          _data_fim?: string | null
          _data_inicio?: string | null
          _origem?: string
          _pagina?: number
          _situacao?: string
          _tamanho_pagina?: number
        }
        Returns: Json
      }
      consultar_diretorio_lancamentos: {
        Args: {
          _area: string
          _busca?: string | null
          _cliente_id?: string | null
          _data_fim?: string | null
          _data_inicio?: string | null
          _pagina?: number
          _situacao?: string
          _tamanho_pagina?: number
        }
        Returns: Json
      }
      consultar_fila_lancamentos_pendentes: {
        Args: {
          _area: string
          _busca?: string | null
          _ciclo?: string | null
          _cliente_id?: string | null
          _data_fim?: string | null
          _data_inicio?: string | null
          _etapa?: string | null
          _pagina?: number
          _tamanho?: number
        }
        Returns: Json
      }
      consultar_lancamentos_para_faturamento: {
        Args: { _area: string; _ids: string[] }
        Returns: Json
      }
      consultar_capacidade_pdv: {
        Args: { _area: string; _data: string; _tenant_id: string }
        Returns: Json
      }
      consultar_resumo_folha_pagamento: {
        Args: { _competencia: string }
        Returns: Json
      }
      definir_beneficio_folha: {
        Args: {
          _beneficio_id: string
          _folha_id: string
          _idempotency_key: string
          _valor: number
          _versao_folha_observada: number
        }
        Returns: Json
      }
      fechar_folha_competencia: {
        Args: {
          _competencia: string
          _idempotency_key: string
          _vencimento: string
        }
        Returns: Json
      }
      gerar_folha_competencia: {
        Args: { _competencia: string; _idempotency_key: string }
        Returns: Json
      }
      criar_fatura_com_lancamentos: {
        Args: {
          _cliente_id: string
          _idempotency_key: string
          _itens_snapshot: Json
          _lancamento_ids: string[]
          _observacao_fatura: string | null
          _periodo_fim: string
          _periodo_inicio: string
          _tipo_relatorio: string
          _valor_total: number
        }
        Returns: Json
      }
      criar_lancamento_manual: {
        Args: {
          _cliente_id: string
          _data_entrega: string | null
          _data_lancamento: string
          _idempotency_key: string
          _itens: Json
          _observacao: string | null
        }
        Returns: Json
      }
      criar_rota_planejada: {
        Args: {
          _data: string
          _idempotency_key: string
          _km_inicial: number | null
          _motorista_id: string | null
          _observacoes: string | null
          _veiculo_id: string | null
        }
        Returns: Json
      }
      criar_venda_pdv: {
        Args: {
          _caixa_id: string
          _cliente_id: string
          _criado_por: string
          _data_previsao_entrega: string
          _idempotency_key: string
          _itens: Json
          _motorista_id: string | null
          _pagamento: Json | null
          _percentual_urgencia: number
          _urgente: boolean
          _valor_desconto: number
          _veiculo_id: string | null
        }
        Returns: Json
      }
      criar_pedido_atendimento: {
        Args: {
          _caixa_id: string | null
          _cliente_id: string
          _criado_por: string
          _data_previsao_entrega: string
          _data_retirada: string | null
          _endereco_snapshot: Json
          _entrega_modalidade: string
          _idempotency_key: string
          _itens: Json
          _motorista_id: string | null
          _observacoes: string | null
          _pagamento: Json | null
          _permitir_excecao_capacidade?: boolean
          _percentual_urgencia: number
          _recebimento_modalidade: string
          _urgente: boolean
          _valor_desconto: number
          _veiculo_id: string | null
        }
        Returns: Json
      }
      editar_lancamento_pendente: {
        Args: {
          _data_entrega: string | null
          _data_lancamento: string
          _idempotency_key: string
          _itens: Json
          _lancamento_id: string
          _observacao: string | null
          _updated_at_observado: string
        }
        Returns: Json
      }
      encerrar_contrato_industrial: {
        Args: {
          _contrato_id: string
          _idempotency_key: string
          _motivo: string
          _versao_esperada: number
        }
        Returns: Json
      }
      fechar_caixa: {
        Args: {
          _caixa_id: string
          _idempotency_key: string
          _observacoes: string | null
          _valor_conferido_cartao_credito: number
          _valor_conferido_cartao_debito: number
          _valor_conferido_pix: number
          _valor_contado_dinheiro: number
        }
        Returns: Json
      }
      finalizar_rota_planejada: {
        Args: {
          _idempotency_key: string
          _km_final: number
          _rota_id: string
        }
        Returns: Json
      }
      get_employee_email_by_login: {
        Args: { p_login: string }
        Returns: {
          ativo: boolean
          email: string
        }[]
      }
      get_funcionario_for_user: { Args: { _user_id: string }; Returns: string }
      get_fiscal_configs_for_operations: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_my_access_context: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_my_tenant_context: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_my_security_context: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      has_area_access: {
        Args: { _area: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      iniciar_rota_planejada: {
        Args: {
          _idempotency_key: string
          _km_inicial: number
          _rota_id: string
        }
        Returns: Json
      }
      listar_fechamentos_industriais: {
        Args: { _dias_antecedencia?: number }
        Returns: Json
      }
      listar_capacidades_pdv: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      obter_resumo_caixa: {
        Args: { _caixa_id: string }
        Returns: Json
      }
      obter_demonstrativo_industrial: {
        Args: {
          _cliente_id: string
          _fatura_id?: string | null
          _periodo_fim: string
          _periodo_inicio: string
        }
        Returns: Json
      }
      obter_previa_refaturamento_industrial: {
        Args: { _fatura_id: string }
        Returns: Json
      }
      processar_fila_producao: {
        Args: {
          _etapa_esperada: string
          _funcionario_id: string | null
          _idempotency_key: string
          _nova_previsao: string | null
          _ocorrencia: string | null
          _ordens: Json
          _proxima_etapa: string
          _recurso: string | null
        }
        Returns: Json
      }
      reconciliar_pagamento_pdv: {
        Args: {
          _asaas_charge_id: string
          _confirmado_em: string | null
          _evento: string
          _status_provedor: string
        }
        Returns: Json
      }
      reconciliar_pagamento_fatura_asaas: {
        Args: {
          _asaas_charge_id: string
          _data_evento: string | null
          _evento: string
          _status_provedor: string
          _tenant_id: string
        }
        Returns: Json
      }
      registrar_intencao_pix_pdv: {
        Args: {
          _asaas_charge_id: string
          _caixa_id: string
          _criado_por: string
          _idempotency_key: string
          _momento: string
          _ordem_servico_id: string
          _provedor_pagamento_id: string
          _status_provedor: string
        }
        Returns: Json
      }
      registrar_anexo_ordem: {
        Args: {
          _categoria: string
          _descricao: string | null
          _nome_arquivo: string
          _object_path: string
          _ordem_servico_id: string
        }
        Returns: Json
      }
      registrar_entrega_parcial_pedido: {
        Args: {
          _autorizar_com_saldo: boolean
          _documento_recebedor: string | null
          _funcionario_id: string | null
          _idempotency_key: string
          _itens: Json
          _motivo_autorizacao_saldo: string | null
          _nome_recebedor: string
          _observacoes: string | null
          _ordem_servico_id: string
        }
        Returns: Json
      }
      registrar_evento_parada_rota: {
        Args: {
          _assinatura_url: string | null
          _endereco_corrigido: Json | null
          _entrega_id: string | null
          _expected_version: number
          _foto_comprovante_url: string | null
          _idempotency_key: string
          _motivo: string | null
          _parada_id: string
          _reagendada_para: string | null
          _recebedor_documento: string | null
          _recebedor_nome: string | null
          _tipo: string
        }
        Returns: Json
      }
      registrar_movimentacao_estoque: {
        Args: {
          _custo_unitario?: number | null
          _estoque_produto_id: string
          _fornecedor_id?: string | null
          _idempotency_key?: string | null
          _motivo?: string | null
          _quantidade: number
          _tipo: string
        }
        Returns: Json
      }
      registrar_movimentacao_caixa: {
        Args: {
          _caixa_id: string
          _descricao: string
          _idempotency_key: string
          _tipo: string
          _valor: number
        }
        Returns: Json
      }
      registrar_ocorrencia_producao: {
        Args: {
          _etapa_esperada: string
          _funcionario_id: string | null
          _idempotency_key: string
          _nova_previsao: string | null
          _ocorrencia: string
          _ordem_ids: string[]
        }
        Returns: Json
      }
      registrar_pagamento_conta_pagar: {
        Args: {
          _conta_id: string
          _data_pagamento: string
          _forma_pagamento: string
          _idempotency_key: string
          _observacoes: string | null
          _referencia: string | null
          _valor: number
          _versao_esperada: number
        }
        Returns: Json
      }
      registrar_pagamento_fatura: {
        Args: {
          _data_pagamento: string
          _fatura_id: string
          _forma_pagamento: string
          _idempotency_key: string
          _observacoes: string | null
          _referencia: string | null
          _valor: number
          _versao_esperada: number
        }
        Returns: Json
      }
      refaturar_fatura_industrial: {
        Args: {
          _ajustes: Json
          _fatura_cancelada_id: string
          _idempotency_key: string
          _motivo: string
        }
        Returns: Json
      }
      regenerar_agendamentos_recorrentes: {
        Args: {
          _agendamentos: Json
          _cliente_id: string
          _idempotency_key: string
        }
        Returns: Json
      }
      registrar_pagamento_pdv: {
        Args: {
          _bandeira: string | null
          _caixa_id: string
          _codigo_autorizacao: string | null
          _criado_por: string
          _idempotency_key: string
          _metodo: string
          _momento: string
          _nsu: string | null
          _ordem_servico_id: string
          _parcelas: number
          _valor: number
          _valor_recebido: number | null
        }
        Returns: Json
      }
      registrar_posicao_item_rol: {
        Args: {
          _item_id: string
          _posicao_prateleira: string | null
        }
        Returns: Json
      }
      salvar_conta_pagar: {
        Args: {
          _categoria: string | null
          _categoria_id: string | null
          _centro_custo_id: string | null
          _conta_id: string | null
          _descricao: string
          _fornecedor: string | null
          _fornecedor_id: string | null
          _idempotency_key: string
          _observacoes: string | null
          _valor: number
          _vencimento: string
          _versao_esperada: number | null
        }
        Returns: Json
      }
      salvar_cliente: {
        Args: {
          _classificacao: string
          _cliente_id: string | null
          _contato: string | null
          _cpf_cnpj: string | null
          _email: string | null
          _inscricao_estadual: string | null
          _inscricao_municipal: string | null
          _nome_fantasia: string | null
          _observacoes: string | null
          _razao_social: string
          _regime_tributario: string | null
          _telefone: string | null
          _telefone2: string | null
          _tipo_pessoa: string
        }
        Returns: Json
      }
      salvar_beneficio_catalogo: {
        Args: {
          _ativo: boolean
          _beneficio_id: string | undefined
          _cor: string
          _idempotency_key: string
          _nome: string
          _ordem: number
          _versao_observada: number | undefined
        }
        Returns: Json
      }
      salvar_contrato_industrial: {
        Args: {
          _autoriza_faturamento: boolean
          _cliente_id: string
          _contrato_id: string | null
          _data_fim: string | null
          _data_inicio: string
          _descricao: string
          _dia_fechamento: number | null
          _dia_vencimento: number
          _forma_pagamento: string | null
          _idempotency_key: string
          _itens: Json
          _observacoes: string | null
          _periodicidade_fechamento: string
          _regras_comerciais: string | null
          _valor_servico: number
          _versao_esperada: number | null
        }
        Returns: Json
      }
      registrar_qualidade_pedido: {
        Args: {
          _funcionario_id: string | null
          _idempotency_key: string
          _movimentos: Json
          _nova_previsao: string | null
          _observacoes: string | null
          _ordem_servico_id: string
        }
        Returns: Json
      }
      reordenar_paradas_rota: {
        Args: {
          _idempotency_key: string
          _parada_ids: Json
          _rota_id: string
        }
        Returns: Json
      }
      switch_active_tenant: {
        Args: { _tenant_id: string }
        Returns: Json
      }
      set_admin_mfa_requirement: {
        Args: { _enabled: boolean }
        Returns: Json
      }
      atualizar_etapa_lancamento_pendente: {
        Args: {
          _etapa: string
          _idempotency_key: string
          _lancamento_id: string
          _updated_at_observado: string
        }
        Returns: Json
      }
      vincular_lancamentos_fatura: {
        Args: { _fatura_id: string; _lancamento_ids: string[] }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "producao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operador", "producao"],
    },
  },
} as const
