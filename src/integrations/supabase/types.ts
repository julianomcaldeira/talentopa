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
      avaliacoes: {
        Row: {
          avaliado_user_id: string
          avaliador_user_id: string
          comentario: string | null
          created_at: string
          id: string
          nota: number
          projeto_id: string
          recomendacao: boolean | null
        }
        Insert: {
          avaliado_user_id: string
          avaliador_user_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          projeto_id: string
          recomendacao?: boolean | null
        }
        Update: {
          avaliado_user_id?: string
          avaliador_user_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          projeto_id?: string
          recomendacao?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_habilidades: {
        Row: {
          created_at: string
          funcionalidade_id: string | null
          id: string
          modulo_id: string | null
          nivel: Database["public"]["Enums"]["nivel_senioridade"]
          software_id: string
          user_id: string
          valor_hora: number | null
        }
        Insert: {
          created_at?: string
          funcionalidade_id?: string | null
          id?: string
          modulo_id?: string | null
          nivel?: Database["public"]["Enums"]["nivel_senioridade"]
          software_id: string
          user_id: string
          valor_hora?: number | null
        }
        Update: {
          created_at?: string
          funcionalidade_id?: string | null
          id?: string
          modulo_id?: string | null
          nivel?: Database["public"]["Enums"]["nivel_senioridade"]
          software_id?: string
          user_id?: string
          valor_hora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultor_habilidades_funcionalidade_id_fkey"
            columns: ["funcionalidade_id"]
            isOneToOne: false
            referencedRelation: "funcionalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultor_habilidades_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultor_habilidades_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "softwares"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_perfil: {
        Row: {
          bio_profissional: string | null
          created_at: string
          curriculo_url: string | null
          id: string
          linkedin: string | null
          plano: Database["public"]["Enums"]["plano_assinatura"]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_profissional?: string | null
          created_at?: string
          curriculo_url?: string | null
          id?: string
          linkedin?: string | null
          plano?: Database["public"]["Enums"]["plano_assinatura"]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_profissional?: string | null
          created_at?: string
          curriculo_url?: string | null
          id?: string
          linkedin?: string | null
          plano?: Database["public"]["Enums"]["plano_assinatura"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      empresa_perfil: {
        Row: {
          cnpj: string | null
          created_at: string
          dados_emissao_nf: Json | null
          dados_faturamento: Json | null
          endereco: string | null
          id: string
          inscricao_estadual: string | null
          nome_fantasia: string | null
          numero_funcionarios: number | null
          razao_social: string
          segmento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          dados_emissao_nf?: Json | null
          dados_faturamento?: Json | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          numero_funcionarios?: number | null
          razao_social: string
          segmento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          dados_emissao_nf?: Json | null
          dados_faturamento?: Json | null
          endereco?: string | null
          id?: string
          inscricao_estadual?: string | null
          nome_fantasia?: string | null
          numero_funcionarios?: number | null
          razao_social?: string
          segmento?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      funcionalidades: {
        Row: {
          created_at: string
          descricao: string | null
          horas_media_estimadas: number | null
          id: string
          modulo_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          horas_media_estimadas?: number | null
          id?: string
          modulo_id: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          horas_media_estimadas?: number | null
          id?: string
          modulo_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionalidades_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          software_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          software_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          software_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "softwares"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cidade: string | null
          created_at: string
          email: string
          estado: string | null
          id: string
          nome: string
          status: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cidade?: string | null
          created_at?: string
          email: string
          estado?: string | null
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cidade?: string | null
          created_at?: string
          email?: string
          estado?: string | null
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projeto_fases: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          prazo: string | null
          projeto_id: string
          status: Database["public"]["Enums"]["status_fase"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          prazo?: string | null
          projeto_id: string
          status?: Database["public"]["Enums"]["status_fase"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          prazo?: string | null
          projeto_id?: string
          status?: Database["public"]["Enums"]["status_fase"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_fases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_funcionalidades: {
        Row: {
          funcionalidade_id: string
          id: string
          prazo_dias: number | null
          projeto_id: string
        }
        Insert: {
          funcionalidade_id: string
          id?: string
          prazo_dias?: number | null
          projeto_id: string
        }
        Update: {
          funcionalidade_id?: string
          id?: string
          prazo_dias?: number | null
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_funcionalidades_funcionalidade_id_fkey"
            columns: ["funcionalidade_id"]
            isOneToOne: false
            referencedRelation: "funcionalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_funcionalidades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_modulos: {
        Row: {
          id: string
          modulo_id: string
          prazo_dias: number | null
          projeto_id: string
        }
        Insert: {
          id?: string
          modulo_id: string
          prazo_dias?: number | null
          projeto_id: string
        }
        Update: {
          id?: string
          modulo_id?: string
          prazo_dias?: number | null
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_modulos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_modulos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_user_id: string
          id: string
          nome: string
          objetivo: string | null
          observacoes: string | null
          prazo_estimado: string | null
          problema_atual: string | null
          protocolo: string | null
          software_id: string | null
          status: Database["public"]["Enums"]["status_projeto"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_user_id: string
          id?: string
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          prazo_estimado?: string | null
          problema_atual?: string | null
          protocolo?: string | null
          software_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_user_id?: string
          id?: string
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          prazo_estimado?: string | null
          problema_atual?: string | null
          protocolo?: string | null
          software_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "softwares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      propostas: {
        Row: {
          comentarios: string | null
          consultor_user_id: string
          created_at: string
          estimativa_horas: number | null
          id: string
          projeto_id: string
          status: Database["public"]["Enums"]["status_proposta"]
          updated_at: string
          valor_proposta: number | null
        }
        Insert: {
          comentarios?: string | null
          consultor_user_id: string
          created_at?: string
          estimativa_horas?: number | null
          id?: string
          projeto_id: string
          status?: Database["public"]["Enums"]["status_proposta"]
          updated_at?: string
          valor_proposta?: number | null
        }
        Update: {
          comentarios?: string | null
          consultor_user_id?: string
          created_at?: string
          estimativa_horas?: number | null
          id?: string
          projeto_id?: string
          status?: Database["public"]["Enums"]["status_proposta"]
          updated_at?: string
          valor_proposta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      softwares: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_desenvolvedora: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_desenvolvedora?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_desenvolvedora?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_funcionalidades: {
        Row: {
          funcionalidade_id: string
          id: string
          template_id: string
        }
        Insert: {
          funcionalidade_id: string
          id?: string
          template_id: string
        }
        Update: {
          funcionalidade_id?: string
          id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_funcionalidades_funcionalidade_id_fkey"
            columns: ["funcionalidade_id"]
            isOneToOne: false
            referencedRelation: "funcionalidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_funcionalidades_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
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
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "consultor" | "empresa"
      nivel_senioridade: "junior" | "pleno" | "senior" | "especialista"
      plano_assinatura: "standard" | "premium"
      status_fase:
        | "pendente"
        | "em_andamento"
        | "aguardando_aprovacao"
        | "aprovada"
        | "reprovada"
        | "em_mediacao"
      status_projeto:
        | "rascunho"
        | "publicado"
        | "em_selecao"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      status_proposta: "enviada" | "aceita" | "recusada"
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
      app_role: ["admin", "consultor", "empresa"],
      nivel_senioridade: ["junior", "pleno", "senior", "especialista"],
      plano_assinatura: ["standard", "premium"],
      status_fase: [
        "pendente",
        "em_andamento",
        "aguardando_aprovacao",
        "aprovada",
        "reprovada",
        "em_mediacao",
      ],
      status_projeto: [
        "rascunho",
        "publicado",
        "em_selecao",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      status_proposta: ["enviada", "aceita", "recusada"],
    },
  },
} as const
