INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'ANA CLAUDIA SANCHES', 'ANJ002', 'DIRETOR ADM. FINANCEIRO', '123110', '2', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2005-07-01', 1621.0, 'PRO-LABORE', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='2');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'JESSICA SILVA DE MENEZES', 'ANJ010', 'AUXILIAR DE LAVANDERIA', '516345', '10', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2013-09-12', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='10');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'ANA FLAVIA DE ARRUDA ROSA', 'ANJ012', 'ALIMENTADOR DE LINHA PRODUCAO', '784205', '12', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2014-03-01', 3500.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='12');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'RAQUEL VIEIRA SILVA', 'ANJ052', 'AUXILIAR DE LAVANDERIA', '516345', '52', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2022-07-01', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='52');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'DAVI DE MORAES', 'ANJ061', 'MOTORISTA', '782310', '61', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2022-12-26', 2651.63, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='61');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'ADEMIR APARECIDO DOS SANTOS', 'ANJ072', 'ENCARREGADO GERAL LAVANDERIA', '510205', '72', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2023-07-14', 3500.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='72');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'FERNANDA DA SILVA SANTOS', 'ANJ104', 'AUXILIAR DE LAVANDERIA', '516345', '104', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-01-14', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='104');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'ALESSANDRA RIBEIRO DOS SANTOS', 'ANJ106', 'AUXILIAR DE LAVANDERIA', '516345', '106', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-01-29', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='106');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'ELISANGELA DA COSTA VICENCOTTO', 'ANJ109', 'AUXILIAR DE LAVANDERIA', '516345', '109', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='109');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'RENATA DOS SANTOS SAVIOLI', 'ANJ113', 'AUXILIAR DE LAVANDERIA', '516345', '113', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-05-14', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='113');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'ELISANGELA DA SILVA EPIFANIO', 'ANJ114', 'AUXILIAR DE LAVANDERIA', '516345', '114', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-05-22', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='114');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'MARIA DE FATIMA SEBASTIAO RIGOLINO', 'ANJ120', 'AUXILIAR DE LAVANDERIA', '516345', '120', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-06-24', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='120');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'LUZIANE DA CRUZ FRANCA', 'ANJ123', 'AUXILIAR DE LAVANDERIA', '516345', '123', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-07-03', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='123');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'KELLY CRISTINA DA SILVA GOMES', 'ANJ125', 'AUXILIAR DE LAVANDERIA', '516345', '125', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2025-07-15', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='125');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'DAIANE PLACEDINO DE OLIVEIRA DUARTE', 'ANJ130', 'AUXILIAR DE LAVANDERIA', '516345', '130', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='130');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'FABRICIO GASPAR', 'ANJ137', 'GERENTE', '142105', '137', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', 3000.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='137');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'VANESSA MARILIA GOMES MALPERA', 'ANJ141', 'AUXILIAR DE LAVANDERIA', '516345', '141', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2026-02-12', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='141');

INSERT INTO funcionarios (nome, login, cargo, cbo, codigo_externo, empregador_cnpj, empregador_nome, data_admissao, salario_base, tipo_contrato, regime_jornada, centro_custo, filial, desconto_vt_percentual, ativo)
SELECT 'MARIA LACERDA DO AMARAL', 'ANJ145', 'AUXILIAR DE LAVANDERIA', '516345', '145', '07.528.955/0001-65', 'ANJOLAV SERVICOS DE LAVANDERIA LTDA', '2026-04-07', 1900.0, 'CLT', 'mensalista', 'GERAL', '1', 4, true
WHERE NOT EXISTS (SELECT 1 FROM funcionarios WHERE empregador_cnpj='07.528.955/0001-65' AND codigo_externo='145');


INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1621.0, 0, 0, 0, 0, 0, 0, 0.24, 0.93, 178.31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1013.8, 0, 1621.0, 30, 1621.24, 179.24, 1442.0, 2204.8, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 2'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='2'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 253.39, 157.06, 374.82, 0, 0.74, 0.16, 217.35, 0, 76.0, 0.5, 38.0, 760.0, 0, 0, 2685.27, 214.82, 2078.07, 0.0, 2685.27, 30, 2686.01, 1092.01, 1594.0, 3370.01, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 10'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='10'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 3500.0, 381.82, 523.87, 454.05, 339.94, 0, 0, 0.2, 0.42, 529.45, 71.51, 140.0, 0.5, 70.0, 1400.0, 0, 0, 5199.68, 415.97, 4592.48, 22.5, 5199.68, 30, 5199.88, 2211.88, 2988.0, 6459.88, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 12'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='12'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 126.61, 128.45, 387.21, 0, 0.12, 0.41, 204.48, 0, 76.0, 0.5, 38.0, 760.0, 0, 0, 2542.27, 203.38, 1935.07, 0.0, 2542.27, 30, 2542.39, 1079.39, 1463.0, 3226.39, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 52'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='52'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 2651.63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2651.63, 0, 0, 0, 0, 0, 30, 2651.63, 2651.63, 0.0, 3606.21, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 61 - Afastado INSS por doenca'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='61'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 3500.0, 107.39, 0, 594.05, 175.36, 0, 0, 0.39, 0.44, 414.25, 0, 140.0, 0.5, 70.0, 1400.0, 0, 0, 4376.8, 350.14, 3769.6, 22.5, 4376.8, 30, 4377.19, 2025.19, 2352.0, 5637.19, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 72'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='72'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 155.45, 29.36, 648.07, 208.22, 0, 190.87, 0.46, 0.24, 241.52, 0, 76.0, 0.5, 38.0, 760.0, 477.17, 0, 2941.1, 235.28, 2333.9, 0.0, 2941.1, 30, 3132.43, 1593.43, 1539.0, 3816.43, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 104'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='104'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 12.95, 0, 251.84, 72.22, 0, 0, 0.61, 0.11, 177.01, 0, 76.0, 0.5, 38.0, 760.0, 0, 0, 2237.01, 178.96, 1629.81, 0.0, 2237.01, 30, 2237.01, 1051.01, 1186.0, 2921.01, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 106'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='106'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 245.79, 61.90, 1.79, 0, 0.98, 0.83, 140.33, 0, 60.8, 0.5, 38.0, 760.0, 0, 380.0, 1829.48, 146.35, 1222.28, 0.0, 1829.48, 30, 2210.46, 1380.46, 830.0, 2894.46, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 109'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='109'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 0, 0, 123.01, 0, 0.57, 0.93, 157.75, 0, 11.4, 0.5, 38.0, 760.0, 0, 0, 2023.01, 161.84, 1415.81, 0.0, 2023.01, 30, 2023.58, 968.58, 1055.0, 2707.58, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 113 - Salario maternidade'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='113'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 437.52, 224.42, 347.93, 140.0, 0.03, 0.63, 237.77, 0, 76.0, 0.5, 38.0, 760.0, 350.0, 0, 2909.87, 232.78, 2302.67, 0.0, 2909.87, 30, 3049.9, 1462.9, 1587.0, 3733.9, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 114'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='114'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 257.71, 64.43, 0, 188.02, 0.86, 0.79, 175.67, 0, 76.0, 0.5, 38.0, 760.0, 470.06, 0, 2222.14, 177.77, 1614.94, 0.0, 2222.14, 30, 2411.02, 1521.02, 890.0, 3095.02, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 120'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='120'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 131.79, 32.95, 0, 0, 0.65, 0.39, 161.5, 0, 76.0, 0.5, 38.0, 760.0, 0, 0, 2064.74, 165.17, 1457.54, 0.0, 2064.74, 30, 2065.39, 1036.39, 1029.0, 2749.39, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 123'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='123'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 25.91, 0, 250.45, 163.07, 375.92, 191.6, 0.64, 0.03, 220.06, 0, 76.0, 0.5, 38.0, 760.0, 479.0, 0, 2715.35, 217.22, 1926.52, 0.0, 2715.35, 30, 2907.59, 1573.59, 1334.0, 3591.59, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 125'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='125'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 126.61, 33.84, 8.77, 0, 0.49, 0.31, 161.9, 0, 76.0, 0.5, 38.0, 760.0, 0, 0, 2069.22, 165.53, 1338.55, 0.0, 2069.22, 30, 2069.71, 1036.71, 1033.0, 2753.71, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 130'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='130'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 3000.0, 0, 0, 0, 0, 1200.0, 0, 0.32, 0.24, 392.58, 0, 0, 0.5, 60.0, 1200.0, 0, 0, 4200.0, 336.0, 3592.8, 15.0, 4200.0, 30, 4200.32, 1653.32, 2547.0, 5280.32, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 137'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='137'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1900.0, 0, 0, 253.05, 166.33, 412.28, 0, 0.65, 0.29, 221.52, 0, 76.0, 0.5, 38.0, 760.0, 0, 0, 2731.66, 218.53, 2124.46, 0.0, 2731.66, 30, 2732.31, 1096.31, 1636.0, 3416.31, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 141'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='141'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');

INSERT INTO folha_pagamento (funcionario_id, competencia, salario_base, horas_extras_50, horas_extras_70, horas_extras_100, reflexo_dsr, gratificacao, estorno_provisao, troco_mes, troco_mes_anterior, desconto_inss, desconto_irrf, desconto_vt, desconto_cesta_basica, contribuicao_assistencial, adiantamento_salarial, desconto_emprestimo, outros_descontos, base_fgts, valor_fgts, base_irrf, faixa_irrf, salario_contrib_inss, dias_trabalhados, total_proventos, total_descontos, liquido, custo_total_empresa, status, observacoes)
SELECT f.id, '2026-04-01', 1520.0, 0, 0, 253.39, 52.28, 7.98, 0, 0.75, 0, 140.7, 0, 91.2, 0.5, 38.0, 608.0, 0, 0, 1833.65, 146.69, 1226.45, 0.0, 1833.65, 30, 1834.4, 878.4, 956.0, 2381.6, 'aberto', 'Importado holerite ANJOLAV Abr/2026 - Cod 145'
FROM funcionarios f WHERE f.empregador_cnpj='07.528.955/0001-65' AND f.codigo_externo='145'
AND NOT EXISTS (SELECT 1 FROM folha_pagamento fp WHERE fp.funcionario_id=f.id AND fp.competencia='2026-04-01');