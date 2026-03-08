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
      ativos: {
        Row: {
          created_at: string
          id: string
          local_atual: string | null
          nome: string
          obra_id: string
          status: string
          tenant_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          local_atual?: string | null
          nome: string
          obra_id: string
          status?: string
          tenant_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          local_atual?: string | null
          nome?: string
          obra_id?: string
          status?: string
          tenant_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ativos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ativos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      compras_emergenciais: {
        Row: {
          created_at: string
          data: string
          id: string
          material: string
          motivo: string | null
          obra_id: string
          qtd: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          material: string
          motivo?: string | null
          obra_id: string
          qtd?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          material?: string
          motivo?: string | null
          obra_id?: string
          qtd?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compras_emergenciais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_emergenciais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      consumo_materiais: {
        Row: {
          created_at: string
          data_registro: string
          id: string
          material: string
          obra_id: string
          previsto: number
          real_consumo: number
          tenant_id: string
          unidade: string
        }
        Insert: {
          created_at?: string
          data_registro?: string
          id?: string
          material: string
          obra_id: string
          previsto?: number
          real_consumo?: number
          tenant_id: string
          unidade?: string
        }
        Update: {
          created_at?: string
          data_registro?: string
          id?: string
          material?: string
          obra_id?: string
          previsto?: number
          real_consumo?: number
          tenant_id?: string
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumo_materiais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumo_materiais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes_seguranca: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          obra_id: string
          severidade: string
          status: string
          tenant_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          obra_id: string
          severidade?: string
          status?: string
          tenant_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          obra_id?: string
          severidade?: string
          status?: string
          tenant_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_seguranca_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidentes_seguranca_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token?: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_financeiros: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          fornecedor: string | null
          id: string
          obra_id: string
          status_pagamento: string
          tenant_id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          obra_id: string
          status_pagamento?: string
          tenant_id: string
          tipo?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          obra_id?: string
          status_pagamento?: string
          tenant_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          created_at: string
          data_inicio: string | null
          data_previsao: string | null
          endereco: string | null
          id: string
          nome: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_inicio?: string | null
          data_previsao?: string | null
          endereco?: string | null
          id?: string
          nome: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_inicio?: string | null
          data_previsao?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_diarios: {
        Row: {
          atividade: string | null
          created_at: string
          data_registro: string
          entrada: string | null
          id: string
          nome: string
          obra_id: string
          producao: string | null
          saida: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          atividade?: string | null
          created_at?: string
          data_registro?: string
          entrada?: string | null
          id?: string
          nome: string
          obra_id: string
          producao?: string | null
          saida?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          atividade?: string | null
          created_at?: string
          data_registro?: string
          entrada?: string | null
          id?: string
          nome?: string
          obra_id?: string
          producao?: string | null
          saida?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_diarios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_diarios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      retrabalhos: {
        Row: {
          created_at: string
          data_registro: string
          descricao: string | null
          etapa: string
          id: string
          obra_id: string
          quantidade: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          data_registro?: string
          descricao?: string | null
          etapa: string
          id?: string
          obra_id: string
          quantidade?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          data_registro?: string
          descricao?: string | null
          etapa?: string
          id?: string
          obra_id?: string
          quantidade?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retrabalhos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retrabalhos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      riscos: {
        Row: {
          created_at: string
          id: string
          impacto: string | null
          obra_id: string
          prazo: string | null
          risco: string
          severidade: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impacto?: string | null
          obra_id: string
          prazo?: string | null
          risco: string
          severidade?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impacto?: string | null
          obra_id?: string
          prazo?: string | null
          risco?: string
          severidade?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "riscos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "riscos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sequenciamento_equipes: {
        Row: {
          created_at: string
          equipe: string
          id: string
          obra_id: string
          semana_fim: number
          semana_inicio: number
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          equipe: string
          id?: string
          obra_id: string
          semana_fim: number
          semana_inicio: number
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          equipe?: string
          id?: string
          obra_id?: string
          semana_fim?: number
          semana_inicio?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequenciamento_equipes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequenciamento_equipes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "operacional" | "visualizador"
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
    Enums: {
      app_role: ["admin", "gestor", "operacional", "visualizador"],
    },
  },
} as const
