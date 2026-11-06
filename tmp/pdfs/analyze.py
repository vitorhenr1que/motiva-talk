import json, pathlib, collections
P=pathlib.Path(__file__).parent
rows=json.loads((P/'unique.json').read_text(encoding='utf-8'))
groups={
'Notas ou disciplinas ausentes/incorretas no sistema':[2,8,47,54,85,90,92,98,99,131,174,178],
'Falta de retorno, demora ou encaminhamentos sem solução':[9,10,58,59,84,86,88,90,94,95,96,98,99,101,110,119,120,130,142,165,169,176,181,182,192,197],
'Histórico, ementas e comprovantes: pedido de emissão':[4,6,9,73,162,172,180,189],
'Documentos acadêmicos: atraso ou falta de atendimento':[9,11,142,144,181,182],
'Diploma/certificado de conclusão: pedido ou orientação':[25,59,83,91,184],
'Diploma/conclusão: atraso ou impedimento relatado':[94,96,98,99,130,175,176,194],
'Certificados de eventos: atraso, ausência ou falta de retorno':[84,86,169,185,197,200],
'Certificados e horas de eventos: emissão ou consulta':[183,187,191,195],
'Calor, climatização insuficiente ou ruído do ar':[12,13,16,151,190,198],
'Grade ou calendário sem organização/comunicação adequada':[10,17,18,77],
'Metodologia, preparo docente ou aulas práticas insuficientes':[66,72,151,165,166,170,178,193],
'Conduta docente, constrangimento ou avaliação contestada':[66,72,146,147,151,162,165,166,177,178,188],
'Ausência, adiamento ou carga horária de aulas não cumprida':[106,193],
'Desorganização institucional explicitamente criticada':[123,165,166,170],
'Matrícula/rematrícula: dificuldade, negativa ou regularização':[95,101,119,120,154,162,192],
'Rematrícula ou retorno: pedido/orientação sem reclamação':[100,102,103,104,105,114,135],
'Equipamentos, mobiliário ou estrutura para aula/prática':[27,37,71,151,190,193],
'Água, banheiros ou higiene do ambiente':[18,156,190],
'Superlotação ou conversas que prejudicam a aula':[13,151],
'Plataforma: acesso, atividades ou cadastro/eventos':[1,44,149,173,174,186,199],
'Bolsa, cobrança ou pendência financeira':[15,61,95,162,174,184],
'Pouco apoio, eventos ou coordenação para o curso':[88,190,196],
'Ingresso, preço, bolsas ou oferta de curso: informação':[5,7,31,36,61,107],
'Transporte ou deslocamento: dúvida/problema':[113,167],
'Biblioteca: informação sobre acesso':[33],
'Envio da lista de formandos ao conselho profissional':[126],
'Aproveitamento de estudos anteriores':[132],
'Troca de curso: solicitação pouco detalhada':[52],
'Elogio':[38,112],
'Retratação ou desistência de trancamento':[26,82,108,179],
'Texto sem conteúdo interpretável':[41,49,150],
}
# Cada pedido de saída recebe uma única causa principal explícita.
exits={
'Sem motivo declarado':[3,14,19,20,21,22,23,24,28,29,30,39,40,43,45,46,50,51,53,55,56,60,62,63,64,65,67,68,69,70,74,75,76,78,79,80,81,87,89,111,117,118,122,125,127,129,133,134,137,139,140,141,143,148,155,157,158,160,161,163,168,201],
'Motivo pessoal/força maior sem detalhamento':[34,48,109,115,145,153],
'Trabalho ou incompatibilidade de horários':[32,93,128,136],
'Dificuldade financeira explicitamente declarada':[35,97],
'Falha de comunicação na matrícula':[42],
'Outra instituição mais próxima da residência':[57],
'Aulas de pós-graduação suspensas/adiadas':[106],
'Mudança de cidade por doença':[116],
'Cuidado com bebê doente':[121],
'Insatisfação com a escolha do curso':[124],
'Saúde mental':[138],
'Luto e dificuldade de realizar o TCC':[152],
'Mudança de curso e tentativa de ingresso em rede pública':[159],
'Impasse de matrícula/pendência financeira e tratamento relatado':[162],
'Mudança de cidade, sem outra causa detalhada':[164,171],
'Desorganização e insatisfação pedagógica':[165,166,170],
'Transferência institucional, sem causa detalhada':[172],
}
tags=collections.defaultdict(list)
for label,ns in groups.items():
 for n in ns: tags[n].append(label)
reasons={}
for label,ns in exits.items():
 for n in ns:
  assert n not in reasons,n
  reasons[n]=label
for r in rows:
 r['topics']=tags[r['n']];r['exit_reason']=reasons.get(r['n'])
 assert r['topics'] or r['exit_reason'],r['n']
assert len(rows)==201
(P/'classified.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
for period in ['2025.1','2025.2','2026.1','2026.2']:
 sub=[r for r in rows if r['period']==period]; c=collections.Counter(r['exit_reason'] for r in sub if r['exit_reason'])
 print(period,'total',len(sub),'saida',sum(c.values()),dict(c))
 print('TOPICOS',[(label,len([n for n in ns if rows[n-1]['period']==period])) for label,ns in groups.items() if any(rows[n-1]['period']==period for n in ns)])
