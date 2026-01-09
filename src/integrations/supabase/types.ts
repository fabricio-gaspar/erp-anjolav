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
