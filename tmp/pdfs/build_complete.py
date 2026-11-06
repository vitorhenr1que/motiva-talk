from analyze import rows, groups, exits, P
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from xml.sax.saxutils import escape
import collections, json, pathlib
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='Arial-Bold',italic='Arial',boldItalic='Arial-Bold')
NAVY=colors.HexColor('#123047'); TEAL=colors.HexColor('#087E8B'); GREY=colors.HexColor('#526472'); PALE=colors.HexColor('#EDF4F7')
styles=getSampleStyleSheet()
for name in ['Normal','BodyText']:styles[name].fontName='Arial';styles[name].fontSize=9.5;styles[name].leading=13;styles[name].textColor=NAVY
styles.add(ParagraphStyle(name='Title2',fontName='Arial-Bold',fontSize=27,leading=30,textColor=NAVY,spaceAfter=12))
styles.add(ParagraphStyle(name='Sub',fontName='Arial-Bold',fontSize=15,leading=19,textColor=NAVY,spaceBefore=10,spaceAfter=7,keepWithNext=True))
styles.add(ParagraphStyle(name='Kicker',fontName='Arial-Bold',fontSize=9,leading=13,textColor=TEAL,spaceAfter=10))
styles.add(ParagraphStyle(name='Small2',fontName='Arial',fontSize=8,leading=11,textColor=GREY))
styles.add(ParagraphStyle(name='Cell2',fontName='Arial',fontSize=9,leading=12,textColor=NAVY))
story=[]
def p(s,style='BodyText'):return Paragraph(s,styles[style])
def add(s,style='BodyText'):story.append(p(s,style));story.append(Spacer(1,5))
def title(k,t):add(k,'Kicker');add(t,'Title2')
def sub(s):add(s,'Sub')
def table(headers, data, widths, compact=False):
 cell='Small2' if compact else 'Cell2'
 vals=[[p(escape(str(v)),cell) for v in headers]]+[[p(escape(str(v)),cell) for v in row] for row in data]
 t=Table(vals,colWidths=widths,repeatRows=1,hAlign='LEFT')
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),PALE),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),1,TEAL),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#DDE5EA')),('TOPPADDING',(0,0),(-1,-1),2.3 if compact else 6),('BOTTOMPADDING',(0,0),(-1,-1),2.3 if compact else 6),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8)]))
 story.append(t);story.append(Spacer(1,10))
def refs(ns):return ', '.join('O%03d'%n for n in ns)
periods=['2025.1','2025.2','2026.1','2026.2']
raw=json.loads((P/'ouvidoria_raw.json').read_text(encoding='utf-8'))
dups=json.loads((P/'duplicates.json').read_text(encoding='utf-8'))
def subset(per):return [r for r in rows if r['period']==per]
def count(label,per):return sum(label in r['topics'] for r in subset(per))
def pct(n,d):return f'{100*n/d:.1f}%'.replace('.',',')
title('FAZAG  /  OUVIDORIA  /  ANÁLISE DE CONTEÚDO','O que os relatos<br/>realmente apontam')
add('Recorrência de demandas e motivos declarados de trancamento/cancelamento | 2025.1 a 2026.2','Sub')
add('Extração em 06/11/2026. Último registro disponível: 05/11/2026, 14:03 (horário armazenado no banco). O semestre 2026.2 está incompleto.','Small2')
table(['Textos únicos analisados'],[['201']],[495])
sub('Principais resultados')
add('<b>2025.1:</b> entre os problemas específicos, há empate: notas ausentes no portal, climatização/ruído e organização da grade, com <b>3 textos cada</b>. Os 24 pedidos de saída não sustentam uma causa específica recorrente: 19 não declaram motivo e 2 dizem apenas motivos pessoais/imprevistos.')
add('<b>2025.2:</b> a falta de retorno ou de solução lidera com <b>6 textos</b>, seguida de notas ausentes, com <b>4</b>. Entre 21 pedidos de saída, 20 não explicam a causa; o único motivo concreto é estudar em instituição mais próxima da residência.')
add('<b>2026.1:</b> falta de retorno/solução aparece em <b>15 textos</b>; conduta docente, constrangimento ou avaliação contestada em <b>8</b>; atraso/impedimento de diploma ou conclusão em <b>7</b>. Nos pedidos de saída, trabalho/horários e desorganização com insatisfação pedagógica empatam em <b>3 textos cada</b>.')
add('<b>2026.2, parcial:</b> certificados e horas de eventos somam <b>7 textos</b>: 3 sobre ausência/retorno e 4 sobre emissão/consulta. Há 2 relatos sobre calor/climatização. O único pedido de trancamento não informa motivo.')
sub('A conclusão sobre os trancamentos')
add('O banco permite contar intenções de saída, mas a maioria não registra a causa. <b>Não é possível afirmar que calor, mau atendimento ou qualquer outro problema seja a principal causa geral de trancamento.</b> Esses vínculos só são contados quando o próprio texto os declara.')
add('Leitura assistida e classificação temática de todos os 201 textos únicos. Não se trata de pesquisa representativa de todos os alunos, nem de comprovação dos fatos narrados.','Small2')
story.append(PageBreak())
title('01  /  MÉTODO E COBERTURA','Como os números<br/>foram construídos')
table(['Semestre','Período','Textos únicos'],[['2025.1','01/01 a 30/06/2025',53],['2025.2','01/07 a 31/12/2025',39],['2026.1','01/01 a 30/06/2026',89],['2026.2','01/07 a 05/11/2026*',20],['TOTAL','',201]],[85,300,110])
add('* Janela prevista até 31/12/2026; dados disponíveis somente até 05/11. Ausência de registros posteriores não significa ausência de demandas.','Small2')
sub('Fonte e seleção')
add('Fonte: tabela <b>Ouvidoria</b>, banco <b>fazag_web</b>. A análise foi feita pela leitura integral do campo <b>text</b>; o campo <b>data</b> foi usado para organizar as submissões por semestre. Seleção: data ≥ 01/01/2025 e data &lt; 01/01/2027. O semestre foi definido pela data de submissão, e não por datas ou semestres mencionados no relato. Datas foram usadas como armazenadas; a sessão do servidor estava em horário local UTC-3 na extração.')
sub('Classificação e denominadores')
add('A classificação temática e a identificação dos motivos de trancamento/cancelamento foram baseadas no conteúdo do campo <b>text</b>. As contagens representam textos únicos, e não pessoas ou processos concluídos. Um relato pode receber vários temas; percentuais temáticos usam os textos únicos do semestre e não devem ser somados. Motivos de saída recebem uma única causa principal declarada, preservando causas vagas em categorias próprias.')
add('Pedidos de reverter trancamento e retorno ao curso não foram contados como saída. Ameaça condicional de trancamento também foi excluída desse subtotal. Reclamações são relatos dos remetentes, sem verificação factual. Não houve consulta a outras tabelas para confirmar matrícula, evasão ou resolução.')
story.append(PageBreak())

selected={
'2025.1':[('Notas ou disciplinas ausentes/incorretas no sistema',3,[2,8,47]),('Calor, climatização insuficiente ou ruído do ar',3,[12,13,16]),('Grade ou calendário sem organização/comunicação adequada',3,[10,17,18]),('Histórico, ementas e comprovantes: pedido de emissão',3,[4,6,9]),('Falta de retorno, demora ou encaminhamentos sem solução',2,[9,10]),('Documentos acadêmicos: atraso ou falta de atendimento',2,[9,11]),('Equipamentos, mobiliário ou estrutura para aula/prática',2,[27,37]),('Plataforma: acesso, atividades ou cadastro/eventos',2,[1,44])],
'2025.2':[('Falta de retorno, demora ou encaminhamentos sem solução',6,[58,59,84,86,88,90]),('Notas ou disciplinas ausentes/incorretas no sistema',4,[54,85,90,92]),('Diploma/certificado de conclusão: pedido ou orientação',3,[59,83,91]),('Certificados de eventos: atraso, ausência ou falta de retorno',2,[84,86]),('Metodologia, preparo docente ou aulas práticas insuficientes',2,[66,72]),('Conduta docente, constrangimento ou avaliação contestada',2,[66,72])],
'2026.1':[('Falta de retorno, demora ou encaminhamentos sem solução',15,[94,95,96,98,99,101,110,119,120,130,142,165,169,176,181]),('Conduta docente, constrangimento ou avaliação contestada',8,[146,147,151,162,165,166,177,178]),('Diploma/conclusão: atraso ou impedimento relatado',7,[94,96,98,99,130,175,176]),('Matrícula/rematrícula: dificuldade, negativa ou regularização',6,[95,101,119,120,154,162]),('Notas ou disciplinas ausentes/incorretas no sistema',5,[98,99,131,174,178]),('Metodologia, preparo docente ou aulas práticas insuficientes',5,[151,165,166,170,178]),('Desorganização institucional explicitamente criticada',4,[123,165,166,170])],
'2026.2':[('Certificados e horas de eventos: emissão ou consulta',4,[183,187,191,195]),('Certificados de eventos: atraso, ausência ou falta de retorno',3,[185,197,200]),('Falta de retorno, demora ou encaminhamentos sem solução',3,[182,192,197]),('Calor, climatização insuficiente ou ruído do ar',2,[190,198]),('Equipamentos, mobiliário ou estrutura para aula/prática',2,[190,193]),('Pouco apoio, eventos ou coordenação para o curso',2,[190,196]),('Plataforma: acesso, atividades ou cadastro/eventos',2,[186,199])]
}
interpret={
'2025.1':'O problema de climatização contém 2 textos sobre calor/refrigeração insuficiente e 2 sobre ruído do ar; um dos relatos reúne ambos. Na grade, 2 textos descrevem deslocamentos para aulas em dias divergentes e outro cita desorganização de matérias. Informações sobre ingresso/preço/oferta aparecem em 4 textos, mas não são uma queixa operacional homogênea.',
'2025.2':'A falta de retorno aparece em canais digitais, na conclusão da pós-graduação, na emissão de certificados e na disponibilidade da coordenação. Um relato descreve encaminhamento entre setores sem solução e outro relata certificados não disponibilizados. Os 2 textos sobre metodologia também abordam conduta/avaliação: são 2 relatos com temas sobrepostos.',
'2026.1':'Além das queixas, há 7 pedidos de rematrícula/retorno sem reclamação explícita, fora do ranking de problemas. Os 7 relatos sobre diploma/conclusão incluem 2 textos sobre pendências acadêmicas contestadas. Há 3 reclamações de demora em outros documentos. Um texto relata ensino/avaliação e ameaça saída, mas não solicita trancamento; outro pede desconsiderar uma mensagem anterior sem identificar o registro, impedindo a vinculação segura.',
'2026.2':'Os 7 textos sobre certificados/horas de eventos equivalem a 35,0% do semestre e não se sobrepõem entre as duas linhas. Somente 3 descrevem ausência de certificado ou de retorno; os outros 4 são pedidos ou consultas. Há 2 relatos sobre calor/climatização: um cita falta de climatização e condições inadequadas de sala; outro descreve calor excessivo com ventilação insuficiente.'}
for per in periods:
 title('02  /  ANÁLISE POR SEMESTRE',per+(' | parcial' if per=='2026.2' else ''))
 subrows=subset(per); ec=collections.Counter(r['exit_reason'] for r in subrows if r['exit_reason']); total=sum(ec.values())
 add(f'<b>{len(subrows)} textos únicos</b> | <b>{total} pedidos de trancamento/cancelamento</b> ({pct(total,len(subrows))} dos textos).')
 table(['Demanda ou problema específico','Textos','% do semestre'],[(label,n,pct(n,len(subrows))) for label,n,ns in selected[per]],[355,55,85])
 add(interpret[per])
 sub('O que motivou os pedidos de saída')
 if per=='2026.1':
  table(['Causa declarada ou grau de informação','Textos'],[['Sem motivo declarado',22],['Motivos pessoais/força maior, sem detalhar',4],['Trabalho/horários; desorganização e insatisfação pedagógica','3 cada'],['Mudança de cidade, sem outra causa detalhada',2],['Outras 10 causas específicas, uma ocorrência por causa',10]],[410,85])
  add('Entre as causas concretas, <b>trabalho/horários</b> e <b>desorganização com insatisfação pedagógica</b> empatam com 3 textos, ou 6,8% dos 44 pedidos cada. Não há uma causa isolada predominante entre as justificativas concretas declaradas.')
 elif per=='2025.1':
  table(['Causa declarada ou grau de informação','Textos'],[['Sem motivo declarado',19],['Pessoais/imprevistos, sem detalhar',2],['Trabalho/horários',1],['Financeiro',1],['Falha de comunicação na matrícula',1]],[410,85])
  add('<b>Não há causa concreta repetida.</b> 79,2% dos pedidos não informam motivo; 8,3% apresentam justificativa vaga. A falha de comunicação é causa explícita de saída em um pedido; as reclamações de calor não declaram intenção de sair.')
 elif per=='2025.2':
  table(['Causa declarada ou grau de informação','Textos'],[['Sem motivo declarado',20],['Matrícula em instituição mais próxima da residência',1]],[410,85])
  add('<b>Não há causa concreta recorrente.</b> 95,2% dos pedidos não explicam a saída. O único pedido com causa concreta informa outra instituição mais próxima da cidade de residência. As 6 queixas de retorno não podem ser atribuídas aos pedidos de saída sem motivo.')
 else:
  table(['Causa declarada ou grau de informação','Textos'],[['Sem motivo declarado',1]],[410,85])
  add('<b>Não há motivo de saída identificável.</b> O único pedido é genérico. A queda do volume de pedidos não demonstra redução da evasão: o período é parcial e os registros analisados não comprovam a efetivação das saídas.')
 story.append(PageBreak())

title('03  /  COMPARAÇÃO POR TEMA','O que merece<br/>atenção primeiro')
table(['Tema comparável','25.1','25.2','26.1','26.2*'],[
['Sem retorno/solução',2,6,15,3],['Notas/disciplinas ausentes ou incorretas',3,4,5,0],['Diploma/conclusão: atraso ou impedimento',0,0,7,1],['Certificados de eventos: atraso/ausência/retorno',0,2,1,3],['Calor, climatização ou ruído do ar',3,0,1,2],['Metodologia/preparo/aulas práticas',0,2,5,1],['Pedidos de saída',24,21,44,1],['Saída sem motivo declarado',19,20,22,1]],[295,50,50,50,50])
add('* 2026.2 parcial. Zero significa nenhum texto classificado no tema, não inexistência do problema. Os temas se sobrepõem.','Small2')

sector_groups={
'Secretaria / Secretaria Acadêmica':[9,84,86,119,120,169,181,182,192],
'Coordenação de curso':[84,88,192],
'Gestão institucional':[165],
'Suporte ao aluno':[101],
'Docente de Saúde Coletiva (sem nome)':[90],
'NUPEX':[169],
'Setor/destinatário da falta de retorno não identificado':[10,58,59,94,95,96,98,99,110,130,142,176,197]
}
case_details={
9:('Secretaria','Sem nome','Solicitação de histórico por WhatsApp sem resposta.'),
10:('Não identificado para o canal sem resposta','Sem nome','Secretaria é citada no envio da grade; WhatsApp/telefone sem destinatário identificado.'),
58:('Não identificado','Sem nome','E-mails e WhatsApp sem resposta.'),
59:('Não identificado','Sem nome','Retorno sobre notas e certificado de pós-graduação.'),
84:('Secretaria e Coordenação','Sem nome','Encaminhamento entre setores sem solução para certificado FAZAÇÃO.'),
86:('Secretaria; demais setores não nomeados','Sem nome','Certificados FAZAÇÃO indisponíveis e sem retorno concreto.'),
88:('Coordenação de curso','Joserval','Falta de resposta e indisponibilidade do coordenador citado.'),
90:('Docente de Saúde Coletiva','Nome não informado','Mensagem sobre nota não lançada sem retorno.'),
94:('Atendimento; setor não identificado','Atendentes sem nome','Promessa de envio de diploma, sem entrega ou resposta posterior.'),
95:('Atendimento; setor não identificado','Sem nome','Espera por retorno sobre boleto e matrícula/estágio.'),
96:('Não identificado','Sem nome','Solicitação urgente de diploma sem resposta.'),
98:('Instituição; setor não identificado','Sem nome','Tentativas de resolver conclusão/certificado sem êxito.'),
99:('Instituição; setor não identificado','Sem nome para a falta de retorno','E-mails sem resposta e pendências contestadas na conclusão do curso.'),
101:('Suporte ao aluno','Sem nome','Ausência de suporte/retorno para realizar matrícula.'),
110:('WhatsApp institucional; setor não identificado','Sem nome','Dúvida enviada há cerca de um mês sem resposta.'),
119:('Secretaria','Sem nome','Rematrícula sem retorno após contato com a secretaria.'),
120:('Secretaria','Sem nome','Tentativa de rematrícula e pedido de retorno.'),
130:('Não identificado nos contatos anteriores','Sem nome','Contatos por WhatsApp/e-mail sem retorno resolutivo sobre diploma.'),
142:('Não identificado','Sem nome','Prazo de documentos para transferência excedido; mensagens sem resposta.'),
165:('Gestão institucional','Sem nome para a falta de contato','Falta de contato da gestão com o aluno, junto a insatisfação pedagógica.'),
169:('Secretaria e NUPEX','Ioná Manuela','Contatos com os setores e com a responsável citada; certificados sem solução.'),
176:('Vários setores, não nomeados','Sem nome','Solicitação urgente de diploma sem resposta dos setores procurados.'),
181:('Secretaria','Sem nome','Histórico/ementa sem atendimento concluído após orientação da secretaria.'),
182:('Secretaria','Sem nome','Mensagem sobre documento urgente visualizada sem resposta.'),
192:('Secretaria Acadêmica e Coordenação','Mirlane (Secretaria)','Pedido de regularização de matrícula; relato de transferência de responsabilidade entre setores.'),
197:('Não identificado','Sem nome','Sem retorno sobre certificados de 2026.1.')
}
add('Na linha de falta de retorno/solução, os setores e nomes citados estão discriminados a seguir. As demais linhas mantêm os temas da análise semestral.','Small2')
story.append(PageBreak())
title('04  /  ATENDIMENTO','Sem retorno/solução:<br/>setores e responsáveis')
add('Foram identificados 26 textos nesse tema. A atribuição abaixo reproduz somente setores e responsáveis associados à demanda no campo <b>text</b>. Citação não comprova responsabilidade pelo fato nem identifica quem respondeu a cada contato.')
table(['Setor citado na demanda','25.1','25.2','26.1','26.2*'],[(label,*[sum(rows[n-1]['period']==per for n in ns) for per in periods]) for label,ns in sector_groups.items()],[295,50,50,50,50])
add('Um texto pode citar mais de um setor: Secretaria e Coordenação em O084/O192; Secretaria e NUPEX em O169. Por isso, não se somam as linhas como se fossem demandas independentes. Sem identificação do destinatário, o relato permanece na última linha.','Small2')
sub('Responsáveis identificados nominalmente')
table(['Nome citado','Semestre / setor','Textos','Referência'],[['Joserval','2025.2 / Coordenação de curso',1,'O088'],['Ioná Manuela','2026.1 / contatos com Secretaria e NUPEX',1,'O169'],['Mirlane','2026.2 / Secretaria Acadêmica',1,'O192']],[100,245,50,100])
add('Outros nomes presentes nos relatos não foram atribuídos à falta de retorno quando a menção dizia respeito a outro assunto, como orientação de TCC ou experiência em aula. Em O010, a Secretaria aparece na grade, mas o destinatário do canal sem resposta não é identificado.','Small2')
story.append(PageBreak())
title('04  /  ATENDIMENTO','Referências por demanda')
add('Síntese dos 26 relatos classificados em falta de retorno/solução. Não são transcrições integrais; os nomes dos remetentes e seus dados de contato não são apresentados.','Small2')
for per in periods:
 sub(per)
 table(['Ref.','Setor / responsável citado','Demanda relatada'],[['O%03d'%n,sec+' | '+name,desc] for n,(sec,name,desc) in case_details.items() if rows[n-1]['period']==per],[48,217,230])
story.append(PageBreak())
title('05  /  RASTREABILIDADE','Referências dos<br/>números apresentados')
add('Cada referência representa um texto único, e não uma pessoa. As linhas abaixo permitem conferir a composição das contagens sem reproduzir relatos com dados pessoais. Os ids originais constam no índice ao final.','Small2')
for per in periods:
 sub(per)
 for label,n,ns in selected[per]:
  assert n==count(label,per),(label,per,n,count(label,per))
  add(f'<b>{escape(label)} ({n}):</b> {refs(ns)}','Small2')
sub('Motivos de saída: todos os pedidos')
for per in periods:
 add('<b>'+per+'</b>')
 for reason,ns in exits.items():
  use=[n for n in ns if rows[n-1]['period']==per]
  if use:add(f'<b>{escape(reason)} ({len(use)}):</b> {refs(use)}','Small2')
story.append(PageBreak())
title('06  /  ÍNDICE DE AUDITORIA','Registros de origem')
add('Identificação técnica para conferência na tabela Ouvidoria. Sem transcrição dos textos e sem identificação nominal dos remetentes. Datas correspondem à submissão; referências em ordem cronológica dos textos analisados.','Small2')
table(['Referência','Data','id na tabela Ouvidoria'],[['O%03d'%r['n'],r['data'][:10],r['id']] for r in rows],[68,85,342],compact=True)
def footer(canvas,doc):
 canvas.setStrokeColor(TEAL);canvas.setLineWidth(.7);canvas.line(50,42,545,42)
 canvas.setFont('Arial',8);canvas.setFillColor(GREY);canvas.drawString(50,29,'FAZAG | Ouvidoria | 2025-2026 | Extração: 06/11/2026');canvas.drawRightString(545,29,str(doc.page))
out=pathlib.Path('output/pdf/relatorio_ouvidoria_2025_2026_completo.pdf')
doc=SimpleDocTemplate(str(out),pagesize=(595.28,841.89),rightMargin=50,leftMargin=50,topMargin=48,bottomMargin=57,title='Ouvidoria FAZAG - Recorrência por semestre 2025-2026',author='Análise da Ouvidoria FAZAG')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print('PDF:',out.resolve())
