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
    PostgrestVersion: "14.1"
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
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_charges: {
        Row: {
          asaas_id: string | null
          bank_slip_url: string | null
          billing_type: string
          created_at: string
          customer_cpf_cnpj: string | null
          customer_email: string | null
          customer_name: string
          description: string
          due_date: string
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
          created_at?: string
          customer_cpf_cnpj?: string | null
          customer_email?: string | null
          customer_name: string
          description: string
          due_date: string
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
          created_at?: string
          customer_cpf_cnpj?: string | null
          customer_email?: string | null
          customer_name?: string
          description?: string
          due_date?: string
          id?: string
          invoice_url?: string | null
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          charge_id: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string
        }
        Insert: {
          charge_id?: string | null
          event_type: string
          id?: string
          payload: Json
          payment_id?: string | null
          processed_at?: string
        }
        Update: {
          charge_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string
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
      caixa_movimentacoes: {
        Row: {
          caixa_id: string
          created_at: string
          descricao: string | null
          forma_pagamento: string | null
          id: string
          tipo: string
          valor: number
        }
        Insert: {
          caixa_id: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          tipo: string
          valor: number
        }
        Update: {
          caixa_id?: string
          created_at?: string
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
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
        ]
      }
      caixas: {
        Row: {
          created_at: string
          data_abertura: string
          data_fechamento: string | null
          diferenca: number | null
          id: string
          observacoes: string | null
          operador: string
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
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          diferenca?: number | null
          id?: string
          observacoes?: string | null
          operador: string
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
          created_at?: string
          data_abertura?: string
          data_fechamento?: string | null
          diferenca?: number | null
          id?: string
          observacoes?: string | null
          operador?: string
          status?: string
          updated_at?: string
          valor_abertura?: number
          valor_contado?: number | null
          valor_esperado?: number
          valor_reforcos?: number
          valor_sangrias?: number
          valor_vendas?: number
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
          telefone: string | null
          telefone2: string | null
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
          telefone?: string | null
          telefone2?: string | null
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
          telefone?: string | null
          telefone2?: string | null
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_cliente_cliente_id_fkey"
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
          codigo_servico: string | null
          created_at: string
          csc_dados: Json | null
          endereco: Json | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome: string
          razao_social: string | null
          regime_tributario: string | null
          series_numeracao: Json | null
          updated_at: string
          urls_webservice: Json | null
          validade_certificado: string | null
        }
        Insert: {
          aliquota_iss?: number | null
          ambiente?: string | null
          ativo?: boolean
          certificado_url?: string | null
          cnpj?: string | null
          codigo_servico?: string | null
          created_at?: string
          csc_dados?: Json | null
          endereco?: Json | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome: string
          razao_social?: string | null
          regime_tributario?: string | null
          series_numeracao?: Json | null
          updated_at?: string
          urls_webservice?: Json | null
          validade_certificado?: string | null
        }
        Update: {
          aliquota_iss?: number | null
          ambiente?: string | null
          ativo?: boolean
          certificado_url?: string | null
          cnpj?: string | null
          codigo_servico?: string | null
          created_at?: string
          csc_dados?: Json | null
          endereco?: Json | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome?: string
          razao_social?: string | null
          regime_tributario?: string | null
          series_numeracao?: Json | null
          updated_at?: string
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
          condicao_pagamento: string | null
          created_at: string
          dia_vencimento: number | null
          forma_pagamento: string | null
          id: string
          tipo_faturamento: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          condicao_pagamento?: string | null
          created_at?: string
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          id?: string
          tipo_faturamento?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          condicao_pagamento?: string | null
          created_at?: string
          dia_vencimento?: number | null
          forma_pagamento?: string | null
          id?: string
          tipo_faturamento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_pagamento_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar: {
        Row: {
          categoria: string | null
          created_at: string
          data_pagamento: string | null
          descricao: string
          fornecedor: string | null
          id: string
          observacoes: string | null
          status: string
          updated_at: string
          valor: number
          vencimento: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor: number
          vencimento: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_pagamento?: string | null
          descricao?: string
          fornecedor?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          valor?: number
          vencimento?: string
        }
        Relationships: []
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
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente_id: string
          complemento: string | null
          created_at: string
          id: string
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          numero: string | null
          pais: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id: string
          complemento?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          numero?: string | null
          pais?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente_id?: string
          complemento?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          numero?: string | null
          pais?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enderecos_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
      faturas: {
        Row: {
          asaas_charge_id: string | null
          cliente_id: string
          created_at: string
          id: string
          numero_nf: string | null
          periodo_fim: string
          periodo_inicio: string
          status: string
          updated_at: string
          valor_total: number
        }
        Insert: {
          asaas_charge_id?: string | null
          cliente_id: string
          created_at?: string
          id?: string
          numero_nf?: string | null
          periodo_fim: string
          periodo_inicio: string
          status?: string
          updated_at?: string
          valor_total?: number
        }
        Update: {
          asaas_charge_id?: string | null
          cliente_id?: string
          created_at?: string
          id?: string
          numero_nf?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          updated_at?: string
          valor_total?: number
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
            foreignKeyName: "faturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          ativo: boolean
          cargo: string
          cpf: string | null
          created_at: string
          departamento: string | null
          email: string | null
          id: string
          login: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cargo: string
          cpf?: string | null
          created_at?: string
          departamento?: string | null
          email?: string | null
          id?: string
          login: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string
          cpf?: string | null
          created_at?: string
          departamento?: string | null
          email?: string | null
          id?: string
          login?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      historico_producao: {
        Row: {
          created_at: string
          dados_formulario: Json | null
          etapa_anterior: string | null
          etapa_nova: string
          funcionario_id: string | null
          id: string
          observacoes: string | null
          ordem_servico_id: string
          tempo_na_etapa_anterior: unknown
        }
        Insert: {
          created_at?: string
          dados_formulario?: Json | null
          etapa_anterior?: string | null
          etapa_nova: string
          funcionario_id?: string | null
          id?: string
          observacoes?: string | null
          ordem_servico_id: string
          tempo_na_etapa_anterior?: unknown
        }
        Update: {
          created_at?: string
          dados_formulario?: Json | null
          etapa_anterior?: string | null
          etapa_nova?: string
          funcionario_id?: string | null
          id?: string
          observacoes?: string | null
          ordem_servico_id?: string
          tempo_na_etapa_anterior?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "historico_producao_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_producao_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      itens_ordem_servico: {
        Row: {
          created_at: string
          id: string
          observacoes: string | null
          ordem_servico_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
          subtotal: number
        }
        Insert: {
          created_at?: string
          id?: string
          observacoes?: string | null
          ordem_servico_id: string
          preco_unitario: number
          produto_id: string
          quantidade?: number
          subtotal: number
        }
        Update: {
          created_at?: string
          id?: string
          observacoes?: string | null
          ordem_servico_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_ordem_servico_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_ordem_servico_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      modulo_permissoes: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          modulo_key: string
          tem_acesso: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          modulo_key: string
          tem_acesso?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          modulo_key?: string
          tem_acesso?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulo_permissoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      motoristas: {
        Row: {
          ativo: boolean
          cnh: string | null
          cnh_validade: string | null
          created_at: string
          email: string | null
          funcionario_id: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnh?: string | null
          cnh_validade?: string | null
          created_at?: string
          email?: string | null
          funcionario_id?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnh?: string | null
          cnh_validade?: string | null
          created_at?: string
          email?: string | null
          funcionario_id?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          cliente_id: string
          created_at: string
          data_entrega: string | null
          data_previsao_entrega: string | null
          data_retirada: string
          id: string
          motorista_id: string | null
          numero: string
          observacoes: string | null
          prioridade: string | null
          status: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_entrega?: string | null
          data_previsao_entrega?: string | null
          data_retirada?: string
          id?: string
          motorista_id?: string | null
          numero: string
          observacoes?: string | null
          prioridade?: string | null
          status?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_entrega?: string | null
          data_previsao_entrega?: string | null
          data_retirada?: string
          id?: string
          motorista_id?: string | null
          numero?: string
          observacoes?: string | null
          prioridade?: string | null
          status?: string
          updated_at?: string
          veiculo_id?: string | null
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
            foreignKeyName: "precos_especiais_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precos_especiais_produto_id_fkey"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
