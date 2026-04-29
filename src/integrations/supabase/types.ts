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
          created_at: string
          descricao: string | null
          horas_estimadas: number | null
          horas_executadas: number | null
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
          horas_estimadas?: number | null
          horas_executadas?: number | null
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
          horas_estimadas?: number | null
          horas_executadas?: number | null
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
      projetos: {
        Row: {
          classificacao_ia: Json | null
          created_at: string
          descricao: string | null
          empresa_user_id: string
          escopo_ia: string | null
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
          software_id: string | null
          status: Database["public"]["Enums"]["status_projeto"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          classificacao_ia?: Json | null
          created_at?: string
          descricao?: string | null
          empresa_user_id: string
          escopo_ia?: string | null
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
          software_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          classificacao_ia?: Json | null
          created_at?: string
          descricao?: string | null
          empresa_user_id?: string
          escopo_ia?: string | null
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
          visualizada_empresa_em: string | null
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
          visualizada_empresa_em?: string | null
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
      [_ in never]: never
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
      concluir_projeto: { Args: { p_projeto_id: string }; Returns: Json }
      consultor_confirmar_inicio: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      consultor_recusar_inicio: {
        Args: { p_proposta_id: string }
        Returns: Json
      }
      empresa_aceitar_proposta: {
        Args: { p_proposta_id: string }
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
      get_admin_advanced_metrics: { Args: never; Returns: Json }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_empresa_team_member: {
        Args: { _empresa_user_id: string; _user_id: string }
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
      marcar_propostas_visualizadas_empresa: {
        Args: { p_projeto_id: string }
        Returns: number
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
    }
    Enums: {
      app_role: "admin" | "consultor" | "empresa"
      modelo_contratacao: "presencial" | "hibrido" | "remoto"
      nivel_senioridade: "junior" | "pleno" | "senior" | "especialista"
      papel_empresa_usuario: "responsavel" | "financeiro" | "operacional"
      plano_assinatura: "standard" | "premium"
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
      app_role: ["admin", "consultor", "empresa"],
      modelo_contratacao: ["presencial", "hibrido", "remoto"],
      nivel_senioridade: ["junior", "pleno", "senior", "especialista"],
      papel_empresa_usuario: ["responsavel", "financeiro", "operacional"],
      plano_assinatura: ["standard", "premium"],
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
      ],
      tipo_fatura: ["empresa", "consultor", "plataforma"],
    },
  },
} as const
