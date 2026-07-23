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
      ai_context_config: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          contexto: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          contexto: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          contexto?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      alocacoes: {
        Row: {
          aprovado_por: string | null
          canal_id: string
          consultor_user_id: string
          created_at: string
          data_aprovacao: string | null
          id: string
          motivo_recusa: string | null
          prazo_estimado: string | null
          projeto_id: string
          proposta_id: string | null
          solicitado_por: string | null
          status: Database["public"]["Enums"]["status_alocacao_canal"]
          updated_at: string
          valor: number | null
        }
        Insert: {
          aprovado_por?: string | null
          canal_id: string
          consultor_user_id: string
          created_at?: string
          data_aprovacao?: string | null
          id?: string
          motivo_recusa?: string | null
          prazo_estimado?: string | null
          projeto_id: string
          proposta_id?: string | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["status_alocacao_canal"]
          updated_at?: string
          valor?: number | null
        }
        Update: {
          aprovado_por?: string | null
          canal_id?: string
          consultor_user_id?: string
          created_at?: string
          data_aprovacao?: string | null
          id?: string
          motivo_recusa?: string | null
          prazo_estimado?: string | null
          projeto_id?: string
          proposta_id?: string | null
          solicitado_por?: string | null
          status?: Database["public"]["Enums"]["status_alocacao_canal"]
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          actor_nome: string | null
          actor_role: string | null
          actor_user_id: string | null
          categoria: string
          created_at: string
          dados_antigos: Json | null
          dados_novos: Json | null
          descricao: string | null
          entidade: string | null
          entidade_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          severidade: string
        }
        Insert: {
          acao: string
          actor_nome?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          categoria: string
          created_at?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severidade?: string
        }
        Update: {
          acao?: string
          actor_nome?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          categoria?: string
          created_at?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          entidade?: string | null
          entidade_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severidade?: string
        }
        Relationships: []
      }
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
      canais: {
        Row: {
          cnpj: string | null
          created_at: string
          email_contato: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_nome: string | null
          status: Database["public"]["Enums"]["status_canal"]
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["status_canal"]
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email_contato?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_nome?: string | null
          status?: Database["public"]["Enums"]["status_canal"]
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      canal_consultores: {
        Row: {
          canal_id: string
          consultor_user_id: string
          convidado_por: string | null
          convite_email: string | null
          convite_id: string | null
          created_at: string
          data_resposta: string | null
          data_vinculo: string | null
          id: string
          motivo_desvinculo: string | null
          status: Database["public"]["Enums"]["status_canal_consultor"]
          updated_at: string
        }
        Insert: {
          canal_id: string
          consultor_user_id: string
          convidado_por?: string | null
          convite_email?: string | null
          convite_id?: string | null
          created_at?: string
          data_resposta?: string | null
          data_vinculo?: string | null
          id?: string
          motivo_desvinculo?: string | null
          status?: Database["public"]["Enums"]["status_canal_consultor"]
          updated_at?: string
        }
        Update: {
          canal_id?: string
          consultor_user_id?: string
          convidado_por?: string | null
          convite_email?: string | null
          convite_id?: string | null
          created_at?: string
          data_resposta?: string | null
          data_vinculo?: string | null
          id?: string
          motivo_desvinculo?: string | null
          status?: Database["public"]["Enums"]["status_canal_consultor"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canal_consultores_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_consultores_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_consultores_convite_id_fkey"
            columns: ["convite_id"]
            isOneToOne: false
            referencedRelation: "canal_convites"
            referencedColumns: ["id"]
          },
        ]
      }
      canal_convites: {
        Row: {
          canal_id: string
          consultor_user_id: string | null
          convidado_por: string | null
          created_at: string
          data_resposta: string | null
          email: string
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["status_canal_convite"]
          token: string
          updated_at: string
        }
        Insert: {
          canal_id: string
          consultor_user_id?: string | null
          convidado_por?: string | null
          created_at?: string
          data_resposta?: string | null
          email: string
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["status_canal_convite"]
          token?: string
          updated_at?: string
        }
        Update: {
          canal_id?: string
          consultor_user_id?: string | null
          convidado_por?: string | null
          created_at?: string
          data_resposta?: string | null
          email?: string
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["status_canal_convite"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canal_convites_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canal_convites_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_agenda: {
        Row: {
          consultor_user_id: string
          created_at: string
          descricao: string | null
          fim: string
          id: string
          inicio: string
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_agenda_consultor"]
          titulo: string
          updated_at: string
        }
        Insert: {
          consultor_user_id: string
          created_at?: string
          descricao?: string | null
          fim: string
          id?: string
          inicio: string
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_agenda_consultor"]
          titulo: string
          updated_at?: string
        }
        Update: {
          consultor_user_id?: string
          created_at?: string
          descricao?: string | null
          fim?: string
          id?: string
          inicio?: string
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_agenda_consultor"]
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      consultor_agenda_dias: {
        Row: {
          canal_id: string
          consultor_user_id: string
          created_at: string
          dia: string
          estado: string
          id: string
          jornada_horas: number
          projeto_id: string | null
          updated_at: string
        }
        Insert: {
          canal_id: string
          consultor_user_id: string
          created_at?: string
          dia: string
          estado: string
          id?: string
          jornada_horas?: number
          projeto_id?: string | null
          updated_at?: string
        }
        Update: {
          canal_id?: string
          consultor_user_id?: string
          created_at?: string
          dia?: string
          estado?: string
          id?: string
          jornada_horas?: number
          projeto_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultor_agenda_dias_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultor_agenda_dias_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultor_agenda_dias_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      consultor_assinatura: {
        Row: {
          created_at: string
          plano: Database["public"]["Enums"]["plano_assinatura"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          plano?: Database["public"]["Enums"]["plano_assinatura"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          plano?: Database["public"]["Enums"]["plano_assinatura"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consultor_buscas_favoritas: {
        Row: {
          created_at: string
          filtros: Json
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filtros?: Json
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          created_at?: string
          filtros?: Json
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
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
          dias_semana_disponiveis: number[] | null
          id: string
          jornada_diaria_horas: number | null
          linkedin: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_profissional?: string | null
          created_at?: string
          curriculo_url?: string | null
          dias_semana_disponiveis?: number[] | null
          id?: string
          jornada_diaria_horas?: number | null
          linkedin?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_profissional?: string | null
          created_at?: string
          curriculo_url?: string | null
          dias_semana_disponiveis?: number[] | null
          id?: string
          jornada_diaria_horas?: number | null
          linkedin?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consultor_respostas: {
        Row: {
          consultor_user_id: string
          created_at: string
          id: string
          pergunta_id: string
          resposta: string
        }
        Insert: {
          consultor_user_id: string
          created_at?: string
          id?: string
          pergunta_id: string
          resposta: string
        }
        Update: {
          consultor_user_id?: string
          created_at?: string
          id?: string
          pergunta_id?: string
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultor_respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "projeto_perguntas"
            referencedColumns: ["id"]
          },
        ]
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
      empresa_usuarios: {
        Row: {
          created_at: string
          empresa_user_id: string
          id: string
          observacoes: string | null
          papel: Database["public"]["Enums"]["papel_empresa_usuario"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_user_id: string
          id?: string
          observacoes?: string | null
          papel?: Database["public"]["Enums"]["papel_empresa_usuario"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_user_id?: string
          id?: string
          observacoes?: string | null
          papel?: Database["public"]["Enums"]["papel_empresa_usuario"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      faturas: {
        Row: {
          consultor_user_id: string | null
          created_at: string
          emitida_em: string | null
          empresa_user_id: string | null
          id: string
          numero_fatura: string
          pagamento_id: string
          pdf_url: string | null
          status: Database["public"]["Enums"]["status_fatura"]
          tipo: Database["public"]["Enums"]["tipo_fatura"]
          updated_at: string
          valor: number
        }
        Insert: {
          consultor_user_id?: string | null
          created_at?: string
          emitida_em?: string | null
          empresa_user_id?: string | null
          id?: string
          numero_fatura: string
          pagamento_id: string
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["status_fatura"]
          tipo: Database["public"]["Enums"]["tipo_fatura"]
          updated_at?: string
          valor?: number
        }
        Update: {
          consultor_user_id?: string | null
          created_at?: string
          emitida_em?: string | null
          empresa_user_id?: string | null
          id?: string
          numero_fatura?: string
          pagamento_id?: string
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["status_fatura"]
          tipo?: Database["public"]["Enums"]["tipo_fatura"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
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
      mensagem_tentativas_bloqueadas: {
        Row: {
          created_at: string
          escopo: string
          id: string
          motivo: string
          observacao_revisao: string | null
          projeto_id: string
          recipient_user_id: string | null
          revisado_em: string | null
          revisado_por: string | null
          sender_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          escopo?: string
          id?: string
          motivo: string
          observacao_revisao?: string | null
          projeto_id: string
          recipient_user_id?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          sender_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          escopo?: string
          id?: string
          motivo?: string
          observacao_revisao?: string | null
          projeto_id?: string
          recipient_user_id?: string | null
          revisado_em?: string | null
          revisado_por?: string | null
          sender_user_id?: string
          status?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          bloqueado: boolean
          conteudo: string
          created_at: string
          escopo: string
          id: string
          mencionados: string[]
          moderado: boolean
          motivo_bloqueio: string | null
          projeto_id: string
          recipient_user_id: string | null
          sender_user_id: string
          tipo: string
        }
        Insert: {
          bloqueado?: boolean
          conteudo: string
          created_at?: string
          escopo?: string
          id?: string
          mencionados?: string[]
          moderado?: boolean
          motivo_bloqueio?: string | null
          projeto_id: string
          recipient_user_id?: string | null
          sender_user_id: string
          tipo?: string
        }
        Update: {
          bloqueado?: boolean
          conteudo?: string
          created_at?: string
          escopo?: string
          id?: string
          mencionados?: string[]
          moderado?: boolean
          motivo_bloqueio?: string | null
          projeto_id?: string
          recipient_user_id?: string | null
          sender_user_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
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
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          comissao_plataforma: number
          consultor_user_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          empresa_user_id: string
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          projeto_id: string
          proposta_id: string
          status: Database["public"]["Enums"]["status_pagamento"]
          updated_at: string
          valor_consultor: number
          valor_total: number
        }
        Insert: {
          comissao_plataforma?: number
          consultor_user_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_user_id: string
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          projeto_id: string
          proposta_id: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor_consultor?: number
          valor_total?: number
        }
        Update: {
          comissao_plataforma?: number
          consultor_user_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          empresa_user_id?: string
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          projeto_id?: string
          proposta_id?: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          valor_consultor?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_indicacoes: {
        Row: {
          canal_id: string
          consultor_user_id: string
          created_at: string
          id: string
          observacao: string | null
          resposta_id: string
          status: string
          valor_proposto: number | null
        }
        Insert: {
          canal_id: string
          consultor_user_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          resposta_id: string
          status?: string
          valor_proposto?: number | null
        }
        Update: {
          canal_id?: string
          consultor_user_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          resposta_id?: string
          status?: string
          valor_proposto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_indicacoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_indicacoes_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_indicacoes_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "parceiro_respostas"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_respostas: {
        Row: {
          canal_id: string
          comentarios: string | null
          created_at: string
          id: string
          projeto_id: string
          respondido_por: string | null
          status: string
          updated_at: string
        }
        Insert: {
          canal_id: string
          comentarios?: string | null
          created_at?: string
          id?: string
          projeto_id: string
          respondido_por?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          canal_id?: string
          comentarios?: string | null
          created_at?: string
          id?: string
          projeto_id?: string
          respondido_por?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_respostas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_respostas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_respostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_cases: {
        Row: {
          consultor_user_id: string
          created_at: string
          depoimento_empresa: string | null
          descricao: string | null
          horas_trabalhadas: number | null
          id: string
          modulos_implementados: string[] | null
          nota_recebida: number | null
          projeto_id: string
          publicado: boolean
          software_nome: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          consultor_user_id: string
          created_at?: string
          depoimento_empresa?: string | null
          descricao?: string | null
          horas_trabalhadas?: number | null
          id?: string
          modulos_implementados?: string[] | null
          nota_recebida?: number | null
          projeto_id: string
          publicado?: boolean
          software_nome?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          consultor_user_id?: string
          created_at?: string
          depoimento_empresa?: string | null
          descricao?: string | null
          horas_trabalhadas?: number | null
          id?: string
          modulos_implementados?: string[] | null
          nota_recebida?: number | null
          projeto_id?: string
          publicado?: boolean
          software_nome?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_cases_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cidade: string | null
          created_at: string
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      projeto_alertas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          projeto_id: string
          resolved_at: string | null
          resolvido: boolean | null
          severidade: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          projeto_id: string
          resolved_at?: string | null
          resolvido?: boolean | null
          severidade?: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          projeto_id?: string
          resolved_at?: string | null
          resolvido?: boolean | null
          severidade?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_alertas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_alteracoes_historico: {
        Row: {
          alterado_por: string
          campos_alterados: string[]
          consultores_notificados: Json
          created_at: string
          dados_anteriores: Json
          dados_novos: Json
          descricao: string | null
          id: string
          mensagem_notificacao: string | null
          notificado_em: string | null
          notificar_consultores: boolean
          projeto_id: string
          tipo_alteracao: string
        }
        Insert: {
          alterado_por: string
          campos_alterados?: string[]
          consultores_notificados?: Json
          created_at?: string
          dados_anteriores?: Json
          dados_novos?: Json
          descricao?: string | null
          id?: string
          mensagem_notificacao?: string | null
          notificado_em?: string | null
          notificar_consultores?: boolean
          projeto_id: string
          tipo_alteracao?: string
        }
        Update: {
          alterado_por?: string
          campos_alterados?: string[]
          consultores_notificados?: Json
          created_at?: string
          dados_anteriores?: Json
          dados_novos?: Json
          descricao?: string | null
          id?: string
          mensagem_notificacao?: string | null
          notificado_em?: string | null
          notificar_consultores?: boolean
          projeto_id?: string
          tipo_alteracao?: string
        }
        Relationships: []
      }
      projeto_anexo_eventos: {
        Row: {
          actor_user_id: string
          anexo_id: string | null
          created_at: string
          evento: string
          id: string
          mensagem_id: string | null
          metadata: Json
          mime_type: string | null
          nome_arquivo: string | null
          projeto_id: string
        }
        Insert: {
          actor_user_id: string
          anexo_id?: string | null
          created_at?: string
          evento: string
          id?: string
          mensagem_id?: string | null
          metadata?: Json
          mime_type?: string | null
          nome_arquivo?: string | null
          projeto_id: string
        }
        Update: {
          actor_user_id?: string
          anexo_id?: string | null
          created_at?: string
          evento?: string
          id?: string
          mensagem_id?: string | null
          metadata?: Json
          mime_type?: string | null
          nome_arquivo?: string | null
          projeto_id?: string
        }
        Relationships: []
      }
      projeto_anexos: {
        Row: {
          arquivo_url: string
          created_at: string
          escopo: string
          id: string
          mime_type: string | null
          nome: string
          origem: string
          projeto_id: string
          recipient_user_id: string | null
          tamanho_bytes: number | null
          uploader_user_id: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          escopo?: string
          id?: string
          mime_type?: string | null
          nome: string
          origem?: string
          projeto_id: string
          recipient_user_id?: string | null
          tamanho_bytes?: number | null
          uploader_user_id: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          escopo?: string
          id?: string
          mime_type?: string | null
          nome?: string
          origem?: string
          projeto_id?: string
          recipient_user_id?: string | null
          tamanho_bytes?: number | null
          uploader_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_anexos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_aprendizados: {
        Row: {
          created_at: string
          created_by: string | null
          dificuldades: string | null
          erp_utilizado: string | null
          horas_estimadas: number | null
          horas_reais: number | null
          id: string
          licoes_aprendidas: string | null
          modulos_implementados: string[] | null
          projeto_id: string
          recomendacoes: string | null
          tags: string[] | null
          tempo_estimado_dias: number | null
          tempo_real_dias: number | null
          tipo_projeto: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dificuldades?: string | null
          erp_utilizado?: string | null
          horas_estimadas?: number | null
          horas_reais?: number | null
          id?: string
          licoes_aprendidas?: string | null
          modulos_implementados?: string[] | null
          projeto_id: string
          recomendacoes?: string | null
          tags?: string[] | null
          tempo_estimado_dias?: number | null
          tempo_real_dias?: number | null
          tipo_projeto?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dificuldades?: string | null
          erp_utilizado?: string | null
          horas_estimadas?: number | null
          horas_reais?: number | null
          id?: string
          licoes_aprendidas?: string | null
          modulos_implementados?: string[] | null
          projeto_id?: string
          recomendacoes?: string | null
          tags?: string[] | null
          tempo_estimado_dias?: number | null
          tempo_real_dias?: number | null
          tipo_projeto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_aprendizados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_entregaveis: {
        Row: {
          aprovado: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          arquivo_url: string | null
          created_at: string
          descricao: string | null
          fase_id: string | null
          id: string
          link_url: string | null
          nome: string
          projeto_id: string
          tipo: string
          uploader_user_id: string
        }
        Insert: {
          aprovado?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          fase_id?: string | null
          id?: string
          link_url?: string | null
          nome: string
          projeto_id: string
          tipo?: string
          uploader_user_id: string
        }
        Update: {
          aprovado?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          arquivo_url?: string | null
          created_at?: string
          descricao?: string | null
          fase_id?: string | null
          id?: string
          link_url?: string | null
          nome?: string
          projeto_id?: string
          tipo?: string
          uploader_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_entregaveis_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "projeto_fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_entregaveis_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_fases: {
        Row: {
          co_validada_em: string | null
          co_validada_por: string | null
          created_at: string
          descricao: string | null
          documento_encerramento_nome: string | null
          documento_encerramento_url: string | null
          encerrada_em: string | null
          encerrada_por: string | null
          horas_estimadas: number | null
          horas_executadas: number | null
          id: string
          nome: string
          ordem: number
          prazo: string | null
          projeto_id: string
          rmo_validada_em: string | null
          rmo_validada_por: string | null
          status: Database["public"]["Enums"]["status_fase"]
          updated_at: string
          validacao_observacao: string | null
          valor: number | null
        }
        Insert: {
          co_validada_em?: string | null
          co_validada_por?: string | null
          created_at?: string
          descricao?: string | null
          documento_encerramento_nome?: string | null
          documento_encerramento_url?: string | null
          encerrada_em?: string | null
          encerrada_por?: string | null
          horas_estimadas?: number | null
          horas_executadas?: number | null
          id?: string
          nome: string
          ordem?: number
          prazo?: string | null
          projeto_id: string
          rmo_validada_em?: string | null
          rmo_validada_por?: string | null
          status?: Database["public"]["Enums"]["status_fase"]
          updated_at?: string
          validacao_observacao?: string | null
          valor?: number | null
        }
        Update: {
          co_validada_em?: string | null
          co_validada_por?: string | null
          created_at?: string
          descricao?: string | null
          documento_encerramento_nome?: string | null
          documento_encerramento_url?: string | null
          encerrada_em?: string | null
          encerrada_por?: string | null
          horas_estimadas?: number | null
          horas_executadas?: number | null
          id?: string
          nome?: string
          ordem?: number
          prazo?: string | null
          projeto_id?: string
          rmo_validada_em?: string | null
          rmo_validada_por?: string | null
          status?: Database["public"]["Enums"]["status_fase"]
          updated_at?: string
          validacao_observacao?: string | null
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
      projeto_horas_lancadas: {
        Row: {
          aprovado: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          consultor_user_id: string
          created_at: string
          data_execucao: string
          descricao: string | null
          fase_id: string | null
          horas: number
          id: string
          projeto_id: string
          updated_at: string
        }
        Insert: {
          aprovado?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          consultor_user_id: string
          created_at?: string
          data_execucao: string
          descricao?: string | null
          fase_id?: string | null
          horas: number
          id?: string
          projeto_id: string
          updated_at?: string
        }
        Update: {
          aprovado?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          consultor_user_id?: string
          created_at?: string
          data_execucao?: string
          descricao?: string | null
          fase_id?: string | null
          horas?: number
          id?: string
          projeto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_horas_lancadas_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "projeto_fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_horas_lancadas_projeto_id_fkey"
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
      projeto_perguntas: {
        Row: {
          created_at: string
          id: string
          obrigatoria: boolean
          ordem: number
          pergunta: string
          projeto_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
          pergunta: string
          projeto_id: string
        }
        Update: {
          created_at?: string
          id?: string
          obrigatoria?: boolean
          ordem?: number
          pergunta?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_perguntas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_reunioes: {
        Row: {
          ata: string | null
          created_at: string
          criado_por: string
          data_reuniao: string
          duracao_min: number | null
          id: string
          link: string | null
          participantes: string[]
          pauta: string | null
          projeto_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ata?: string | null
          created_at?: string
          criado_por: string
          data_reuniao: string
          duracao_min?: number | null
          id?: string
          link?: string | null
          participantes?: string[]
          pauta?: string | null
          projeto_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ata?: string | null
          created_at?: string
          criado_por?: string
          data_reuniao?: string
          duracao_min?: number | null
          id?: string
          link?: string | null
          participantes?: string[]
          pauta?: string | null
          projeto_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_reunioes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_shortlist: {
        Row: {
          adicionada_em: string
          adicionada_por: string
          created_at: string
          id: string
          observacao: string | null
          projeto_id: string
          proposta_id: string
          status: Database["public"]["Enums"]["status_shortlist_item"]
          updated_at: string
        }
        Insert: {
          adicionada_em?: string
          adicionada_por: string
          created_at?: string
          id?: string
          observacao?: string | null
          projeto_id: string
          proposta_id: string
          status?: Database["public"]["Enums"]["status_shortlist_item"]
          updated_at?: string
        }
        Update: {
          adicionada_em?: string
          adicionada_por?: string
          created_at?: string
          id?: string
          observacao?: string | null
          projeto_id?: string
          proposta_id?: string
          status?: Database["public"]["Enums"]["status_shortlist_item"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_shortlist_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_shortlist_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "propostas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_shortlist_pareceres: {
        Row: {
          aprovado: boolean
          comentario: string | null
          coordenador_user_id: string
          created_at: string
          id: string
          shortlist_id: string
        }
        Insert: {
          aprovado: boolean
          comentario?: string | null
          coordenador_user_id: string
          created_at?: string
          id?: string
          shortlist_id: string
        }
        Update: {
          aprovado?: boolean
          comentario?: string | null
          coordenador_user_id?: string
          created_at?: string
          id?: string
          shortlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_shortlist_pareceres_shortlist_id_fkey"
            columns: ["shortlist_id"]
            isOneToOne: false
            referencedRelation: "projeto_shortlist"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          canal_id: string | null
          classificacao_ia: Json | null
          coordenador_user_id: string | null
          created_at: string
          criado_por_tipo: string
          descricao: string | null
          empresa_user_id: string
          escopo_ia: string | null
          horas_estimadas: number | null
          id: string
          modelo_contratacao:
            | Database["public"]["Enums"]["modelo_contratacao"]
            | null
          nome: string
          objetivo: string | null
          observacoes: string | null
          prazo_estimado: string | null
          prazo_propostas: string | null
          problema_atual: string | null
          protocolo: string | null
          roteamento_v2: boolean
          software_id: string | null
          status: Database["public"]["Enums"]["status_projeto"]
          template_id: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          canal_id?: string | null
          classificacao_ia?: Json | null
          coordenador_user_id?: string | null
          created_at?: string
          criado_por_tipo?: string
          descricao?: string | null
          empresa_user_id: string
          escopo_ia?: string | null
          horas_estimadas?: number | null
          id?: string
          modelo_contratacao?:
            | Database["public"]["Enums"]["modelo_contratacao"]
            | null
          nome: string
          objetivo?: string | null
          observacoes?: string | null
          prazo_estimado?: string | null
          prazo_propostas?: string | null
          problema_atual?: string | null
          protocolo?: string | null
          roteamento_v2?: boolean
          software_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          template_id?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          canal_id?: string | null
          classificacao_ia?: Json | null
          coordenador_user_id?: string | null
          created_at?: string
          criado_por_tipo?: string
          descricao?: string | null
          empresa_user_id?: string
          escopo_ia?: string | null
          horas_estimadas?: number | null
          id?: string
          modelo_contratacao?:
            | Database["public"]["Enums"]["modelo_contratacao"]
            | null
          nome?: string
          objetivo?: string | null
          observacoes?: string | null
          prazo_estimado?: string | null
          prazo_propostas?: string | null
          problema_atual?: string | null
          protocolo?: string | null
          roteamento_v2?: boolean
          software_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          template_id?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_public"
            referencedColumns: ["id"]
          },
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
      proposta_visualizacoes_historico: {
        Row: {
          created_at: string
          id: string
          projeto_id: string
          proposta_id: string
          visualizado_em: string
          visualizado_por: string
        }
        Insert: {
          created_at?: string
          id?: string
          projeto_id: string
          proposta_id: string
          visualizado_em?: string
          visualizado_por: string
        }
        Update: {
          created_at?: string
          id?: string
          projeto_id?: string
          proposta_id?: string
          visualizado_em?: string
          visualizado_por?: string
        }
        Relationships: []
      }
      propostas: {
        Row: {
          comentarios: string | null
          consultor_user_id: string
          created_at: string
          estimativa_horas: number | null
          id: string
          prazo_entrega_dias: number | null
          projeto_id: string
          status: Database["public"]["Enums"]["status_proposta"]
          updated_at: string
          valor_proposta: number | null
          visualizada_empresa_em: string | null
        }
        Insert: {
          comentarios?: string | null
          consultor_user_id: string
          created_at?: string
          estimativa_horas?: number | null
          id?: string
          prazo_entrega_dias?: number | null
          projeto_id: string
          status?: Database["public"]["Enums"]["status_proposta"]
          updated_at?: string
          valor_proposta?: number | null
          visualizada_empresa_em?: string | null
        }
        Update: {
          comentarios?: string | null
          consultor_user_id?: string
          created_at?: string
          estimativa_horas?: number | null
          id?: string
          prazo_entrega_dias?: number | null
          projeto_id?: string
          status?: Database["public"]["Enums"]["status_proposta"]
          updated_at?: string
          valor_proposta?: number | null
          visualizada_empresa_em?: string | null
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
      score_config: {
        Row: {
          id: string
          match_funcionalidades: number
          match_modulos: number
          match_senioridade: number
          match_software: number
          perf_nota_media: number
          perf_pontualidade: number
          perf_projetos_concluidos: number
          perf_recomendacoes: number
          perf_taxa_aceitacao: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          match_funcionalidades?: number
          match_modulos?: number
          match_senioridade?: number
          match_software?: number
          perf_nota_media?: number
          perf_pontualidade?: number
          perf_projetos_concluidos?: number
          perf_recomendacoes?: number
          perf_taxa_aceitacao?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          match_funcionalidades?: number
          match_modulos?: number
          match_senioridade?: number
          match_software?: number
          perf_nota_media?: number
          perf_pontualidade?: number
          perf_projetos_concluidos?: number
          perf_recomendacoes?: number
          perf_taxa_aceitacao?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      score_config_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          changes: Json
          id: string
          new_values: Json
          old_values: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changes: Json
          id?: string
          new_values: Json
          old_values: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changes?: Json
          id?: string
          new_values?: Json
          old_values?: Json
        }
        Relationships: []
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
      canais_public: {
        Row: {
          created_at: string | null
          id: string | null
          nome: string | null
          status: Database["public"]["Enums"]["status_canal"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          nome?: string | null
          status?: Database["public"]["Enums"]["status_canal"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          nome?: string | null
          status?: Database["public"]["Enums"]["status_canal"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      empresa_perfil_public: {
        Row: {
          created_at: string | null
          id: string | null
          nome_fantasia: string | null
          numero_funcionarios: number | null
          razao_social: string | null
          segmento: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          nome_fantasia?: string | null
          numero_funcionarios?: number | null
          razao_social?: string | null
          segmento?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          nome_fantasia?: string | null
          numero_funcionarios?: number | null
          razao_social?: string | null
          segmento?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          cidade: string | null
          created_at: string | null
          estado: string | null
          id: string | null
          nome: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          cidade?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          cidade?: string | null
          created_at?: string | null
          estado?: string | null
          id?: string | null
          nome?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      aceitar_proposta: { Args: { p_proposta_id: string }; Returns: Json }
      admin_aprovar_tentativa_mensagem_bloqueada: {
        Args: { p_observacao?: string; p_tentativa_id: string }
        Returns: Json
      }
      atualizar_fase: {
        Args: {
          p_fase_id: string
          p_horas_executadas?: number
          p_status?: Database["public"]["Enums"]["status_fase"]
        }
        Returns: Json
      }
      can_manage_user: {
        Args: { _actor?: string; _target: string }
        Returns: boolean
      }
      can_user_message_project: {
        Args: { p_escopo?: string; p_projeto_id: string; p_user_id?: string }
        Returns: boolean
      }
      can_user_send_project_message: {
        Args: {
          p_escopo?: string
          p_projeto_id: string
          p_recipient_user_id?: string
          p_sender_user_id?: string
        }
        Returns: boolean
      }
      canal_can_view_projeto: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      canal_convidar_consultor: { Args: { p_email: string }; Returns: string }
      concluir_projeto: { Args: { p_projeto_id: string }; Returns: Json }
      consultor_ajustar_proposta:
        | {
            Args: {
              p_horas?: number
              p_motivo?: string
              p_proposta_id: string
              p_valor: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_horas?: number
              p_motivo?: string
              p_prazo_dias?: number
              p_proposta_id: string
              p_valor: number
            }
            Returns: Json
          }
      consultor_confirmar_inicio: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      consultor_encerrar_fase: {
        Args: {
          p_documento_nome?: string
          p_documento_url: string
          p_fase_id: string
        }
        Returns: Json
      }
      consultor_enviar_contraproposta:
        | {
            Args: {
              p_horas?: number
              p_justificativa?: string
              p_proposta_id: string
              p_valor: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_horas?: number
              p_justificativa?: string
              p_prazo_dias?: number
              p_proposta_id: string
              p_valor: number
            }
            Returns: Json
          }
      consultor_recusar_inicio: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      consultor_tem_vinculo_ativo: {
        Args: { p_consultor: string }
        Returns: string
      }
      coordenador_co_validar_fase: {
        Args: { p_fase_id: string }
        Returns: Json
      }
      coordenador_emitir_parecer: {
        Args: {
          p_aprovado: boolean
          p_comentario?: string
          p_shortlist_id: string
        }
        Returns: Json
      }
      coordenador_invalidar_fase: {
        Args: { p_fase_id: string; p_motivo: string }
        Returns: Json
      }
      coordenador_solicitar_ajustes_fase: {
        Args: { p_fase_id: string; p_motivo: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_mensagem: string
          p_referencia_id?: string
          p_referencia_tipo?: string
          p_tipo: string
          p_titulo: string
          p_user_id: string
        }
        Returns: string
      }
      empresa_aceitar_proposta: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      empresa_indicar_coordenador: {
        Args: { p_coordenador_user_id: string; p_projeto_id: string }
        Returns: Json
      }
      empresa_pre_aprovar_consultor: {
        Args: { p_consultor_user_id: string; p_projeto_id: string }
        Returns: Json
      }
      empresa_pre_aprovar_proposta: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      empresa_recusar_proposta: {
        Args: { p_motivo?: string; p_proposta_id: string }
        Returns: Json
      }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_admin_advanced_metrics: { Args: never; Returns: Json }
      get_canal_dashboard_metrics: {
        Args: { p_canal_id?: string }
        Returns: Json
      }
      get_monthly_project_stats: {
        Args: never
        Returns: {
          concluidos: number
          criados: number
          mes: string
        }[]
      }
      get_platform_metrics: { Args: never; Returns: Json }
      get_projects_by_software: {
        Args: never
        Returns: {
          count: number
          software_nome: string
        }[]
      }
      get_projects_by_status: {
        Args: never
        Returns: {
          count: number
          status: string
        }[]
      }
      get_top_consultants: {
        Args: { p_limit?: number }
        Returns: {
          consultor_user_id: string
          nome: string
          nota_media: number
          total_projetos: number
          valor_total: number
        }[]
      }
      get_user_audit_logs: {
        Args: { _target: string }
        Returns: {
          acao: string
          actor_nome: string
          actor_role: string
          actor_user_id: string
          categoria: string
          created_at: string
          dados_novos: Json
          descricao: string
          entidade: string
          id: string
          severidade: string
        }[]
      }
      get_user_canal_id: { Args: { _user_id?: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_canal_owner: {
        Args: { _canal_id: string; _user_id: string }
        Returns: boolean
      }
      is_consultor_do_canal: {
        Args: { _canal_id: string; _user_id: string }
        Returns: boolean
      }
      is_empresa_rmo: {
        Args: { _empresa_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_empresa_team_member: {
        Args: { _empresa_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_projeto_coordenador: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      is_projeto_party: {
        Args: { _projeto_id: string; _user_id: string }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_acao: string
          p_categoria: string
          p_dados_antigos?: Json
          p_dados_novos?: Json
          p_descricao: string
          p_entidade: string
          p_entidade_id: string
          p_severidade?: string
        }
        Returns: undefined
      }
      manage_user_set_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: Json
      }
      manage_user_update: {
        Args: {
          _cidade?: string
          _empresa_papel?: string
          _empresa_user_id?: string
          _estado?: string
          _nome?: string
          _status?: string
          _target: string
          _telefone?: string
        }
        Returns: Json
      }
      marcar_propostas_visualizadas_empresa: {
        Args: { p_projeto_id: string }
        Returns: number
      }
      notificar_envolvidos_fase: {
        Args: {
          p_excluir?: string
          p_fase_nome: string
          p_mensagem: string
          p_projeto_id: string
          p_tipo?: string
          p_titulo: string
        }
        Returns: undefined
      }
      notify_empresa_por_papel: {
        Args: {
          p_empresa_user_id: string
          p_mensagem: string
          p_papel: Database["public"]["Enums"]["papel_empresa_usuario"]
          p_referencia_id: string
          p_referencia_tipo: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      notify_project_linked_consultants: {
        Args: { p_mensagem: string; p_projeto_id: string }
        Returns: Json
      }
      registrar_mensagem_bloqueada_pre_aprovacao: {
        Args: {
          p_escopo?: string
          p_motivo?: string
          p_projeto_id: string
          p_recipient_user_id?: string
        }
        Returns: string
      }
      registrar_projeto_alteracao: {
        Args: {
          p_campos_alterados: string[]
          p_dados_anteriores: Json
          p_dados_novos: Json
          p_descricao: string
          p_mensagem: string
          p_notificar_consultores: boolean
          p_projeto_id: string
          p_tipo_alteracao: string
        }
        Returns: string
      }
      responder_alocacao_canal: {
        Args: {
          p_alocacao_id: string
          p_aprovar: boolean
          p_justificativa?: string
        }
        Returns: Json
      }
      responder_convite_canal: {
        Args: { p_aceitar: boolean; p_token: string }
        Returns: Json
      }
      rmo_aprovacao_final: { Args: { p_shortlist_id: string }; Returns: Json }
      rmo_invalidar_fase: {
        Args: { p_fase_id: string; p_motivo: string }
        Returns: Json
      }
      rmo_montar_shortlist: {
        Args: { p_projeto_id: string; p_proposta_ids: string[] }
        Returns: Json
      }
      rmo_solicitar_ajustes_fase: {
        Args: { p_fase_id: string; p_motivo: string }
        Returns: Json
      }
      rmo_validar_fase: { Args: { p_fase_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "consultor" | "empresa" | "canal"
      modelo_contratacao: "presencial" | "hibrido" | "remoto"
      nivel_senioridade: "junior" | "pleno" | "senior" | "especialista"
      papel_empresa_usuario:
        | "responsavel"
        | "financeiro"
        | "operacional"
        | "coordenador"
        | "rmo"
      plano_assinatura: "standard" | "premium"
      status_agenda_consultor: "agendado" | "bloqueado" | "vago"
      status_alocacao_canal:
        | "pendente_aprovacao"
        | "aprovada"
        | "recusada"
        | "cancelada"
      status_canal: "pendente" | "ativo" | "suspenso" | "inativo"
      status_canal_consultor: "pendente" | "ativo" | "recusado" | "desvinculado"
      status_canal_convite:
        | "pendente"
        | "aceito"
        | "recusado"
        | "expirado"
        | "cancelado"
      status_fase:
        | "pendente"
        | "em_andamento"
        | "aguardando_aprovacao"
        | "aprovada"
        | "reprovada"
        | "em_mediacao"
      status_fatura: "rascunho" | "emitida" | "paga" | "cancelada"
      status_pagamento: "pendente" | "pago" | "atrasado" | "cancelado"
      status_projeto:
        | "rascunho"
        | "publicado"
        | "em_selecao"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      status_proposta:
        | "enviada"
        | "aceita"
        | "recusada"
        | "aguardando_consultor"
        | "pre_aprovada"
        | "pendente_aprovacao_canal"
        | "contraproposta_consultor"
      status_shortlist_item:
        | "na_shortlist"
        | "em_entrevista"
        | "aprovada_coordenador"
        | "reprovada_coordenador"
        | "selecionada_rmo"
      tipo_fatura: "empresa" | "consultor" | "plataforma"
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
      app_role: ["admin", "consultor", "empresa", "canal"],
      modelo_contratacao: ["presencial", "hibrido", "remoto"],
      nivel_senioridade: ["junior", "pleno", "senior", "especialista"],
      papel_empresa_usuario: [
        "responsavel",
        "financeiro",
        "operacional",
        "coordenador",
        "rmo",
      ],
      plano_assinatura: ["standard", "premium"],
      status_agenda_consultor: ["agendado", "bloqueado", "vago"],
      status_alocacao_canal: [
        "pendente_aprovacao",
        "aprovada",
        "recusada",
        "cancelada",
      ],
      status_canal: ["pendente", "ativo", "suspenso", "inativo"],
      status_canal_consultor: ["pendente", "ativo", "recusado", "desvinculado"],
      status_canal_convite: [
        "pendente",
        "aceito",
        "recusado",
        "expirado",
        "cancelado",
      ],
      status_fase: [
        "pendente",
        "em_andamento",
        "aguardando_aprovacao",
        "aprovada",
        "reprovada",
        "em_mediacao",
      ],
      status_fatura: ["rascunho", "emitida", "paga", "cancelada"],
      status_pagamento: ["pendente", "pago", "atrasado", "cancelado"],
      status_projeto: [
        "rascunho",
        "publicado",
        "em_selecao",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      status_proposta: [
        "enviada",
        "aceita",
        "recusada",
        "aguardando_consultor",
        "pre_aprovada",
        "pendente_aprovacao_canal",
        "contraproposta_consultor",
      ],
      status_shortlist_item: [
        "na_shortlist",
        "em_entrevista",
        "aprovada_coordenador",
        "reprovada_coordenador",
        "selecionada_rmo",
      ],
      tipo_fatura: ["empresa", "consultor", "plataforma"],
    },
  },
} as const
