
-- Fases dos projetos
INSERT INTO projeto_fases (projeto_id, nome, descricao, ordem, status, horas_estimadas, horas_executadas, prazo) VALUES
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', 'Levantamento de Requisitos', 'Mapeamento de processos comerciais', 1, 'aprovada', 40, 38, '2026-04-15'),
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', 'Configuração CRM', 'Setup do ambiente e customizações', 2, 'em_andamento', 80, 45, '2026-06-30'),
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', 'Treinamento e Go-Live', 'Capacitação dos usuários', 3, 'pendente', 30, 0, '2026-09-30'),
('92685bce-4d3d-4766-8f04-0e5c13075a3c', 'Análise Gap', 'Análise de gap entre sistema atual e TOTVS', 1, 'pendente', 60, 0, '2026-05-30'),
('92685bce-4d3d-4766-8f04-0e5c13075a3c', 'Parametrização', 'Configuração dos módulos financeiro e fiscal', 2, 'pendente', 120, 0, '2026-09-30'),
('3d0b3b61-a23f-41ec-a637-64c47d3e6d29', 'Discovery', 'Análise de processos logísticos', 1, 'aprovada', 30, 28, '2026-04-20'),
('3d0b3b61-a23f-41ec-a637-64c47d3e6d29', 'Implantação', 'Configuração e testes do módulo', 2, 'pendente', 90, 0, '2026-07-30'),
('bb1da751-2e6e-4e34-b11d-86dcb915d041', 'Mapeamento de Processos', 'Desenho dos fluxos de aprovação', 1, 'aprovada', 20, 18, '2025-08-30'),
('bb1da751-2e6e-4e34-b11d-86dcb915d041', 'Desenvolvimento Workflows', 'Criação dos workflows no Fluig', 2, 'aprovada', 60, 55, '2025-10-15'),
('bb1da751-2e6e-4e34-b11d-86dcb915d041', 'Homologação', 'Testes e validação com usuários', 3, 'aprovada', 15, 14, '2025-11-30');

-- Propostas
INSERT INTO propostas (projeto_id, consultor_user_id, valor_proposta, estimativa_horas, status, comentarios) VALUES
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', '00889a04-c4d9-4a76-9806-ed9068063711', 45000, 150, 'aceita', 'Experiência de 8 anos com Salesforce. Certificação Admin e Developer.'),
('92685bce-4d3d-4766-8f04-0e5c13075a3c', '00889a04-c4d9-4a76-9806-ed9068063711', 65000, 200, 'enviada', 'Especialista TOTVS Protheus com 12 projetos concluídos.'),
('92685bce-4d3d-4766-8f04-0e5c13075a3c', '03788c50-8da4-4205-9405-eafd6cae5dcd', 58000, 180, 'enviada', 'Consultor sênior TOTVS com foco em migração de sistemas legados.'),
('3d0b3b61-a23f-41ec-a637-64c47d3e6d29', '16f30f21-0557-4808-889c-b89198998214', 38000, 120, 'enviada', 'Certificado SAP Business One com experiência em logística.'),
('3d0b3b61-a23f-41ec-a637-64c47d3e6d29', '00889a04-c4d9-4a76-9806-ed9068063711', 42000, 130, 'enviada', 'Ampla experiência em SAP B1 para controle de estoque.'),
('bb1da751-2e6e-4e34-b11d-86dcb915d041', '03788c50-8da4-4205-9405-eafd6cae5dcd', 25000, 95, 'aceita', 'Especialista em Fluig BPM com mais de 50 workflows implementados.');

-- Mensagens
INSERT INTO mensagens (projeto_id, sender_user_id, conteudo, tipo) VALUES
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', '76f46286-4584-4462-b632-9429a97fe8e0', 'Olá! Como está o andamento da configuração do CRM?', 'mensagem'),
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', '00889a04-c4d9-4a76-9806-ed9068063711', 'Estamos na fase de customização dos dashboards de vendas. Previsão de 2 semanas.', 'mensagem'),
('2c6d9165-a981-4fa4-9987-b9a2993f44e6', '76f46286-4584-4462-b632-9429a97fe8e0', 'Ótimo! Precisamos incluir um relatório de forecast mensal também.', 'mensagem');

-- Avaliação do projeto concluído
INSERT INTO avaliacoes (projeto_id, avaliador_user_id, avaliado_user_id, nota, comentario, recomendacao) VALUES
('bb1da751-2e6e-4e34-b11d-86dcb915d041', '76f46286-4584-4462-b632-9429a97fe8e0', '03788c50-8da4-4205-9405-eafd6cae5dcd', 5, 'Excelente trabalho! Entregou antes do prazo e com qualidade superior.', true);
