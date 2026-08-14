import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area, Sector
} from 'recharts';

// ====================================================================
// Painel RPD - Rendas Petroliferas em Dados (acao 19.1 Planeja+)
// Dados: public/data/dados.json (gerado pela ETL).
// ====================================================================

const FONT = "'Lato', system-ui, sans-serif";
function useLato() {
  useEffect(() => {
    const id = 'lato-font-link';
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400;1,700&display=swap';
    document.head.appendChild(l);
  }, []);
}

const C = {
  sidebar: '#0C3A2B', sidebarHover: '#12503B', deep: '#0F3D2E',
  primary: '#1F7A5A', mid: '#2E9E74', soft: '#57B98C', pale: '#8FC9A9',
  mist: '#C7E3D4', lime: '#7BC043',
  bg: '#EEF3F0', panel: '#FFFFFF', ink: '#12211B', sub: '#5B6E64', line: '#D8E5DD',
};
const AREA_LABEL = { territorio: 'Território', educacao: 'Educação', saude: 'Saúde', outras: 'Outras' };
const AREA_COR = { territorio: C.primary, educacao: C.soft, outras: C.pale, saude: '#B9D9C7' };
const FONTE_LABEL = { petroleo: 'Petróleo', outros: 'Outros', nao_informado: 'Não informado' };

// Caminhos das logos (arquivos em public/logos/). BASE_URL cobre deploy em subpasta.
const LOGO = {
  planejaBranca: `${import.meta.env.BASE_URL}logos/logo_planeja_branca.png`,
  planejaCor: `${import.meta.env.BASE_URL}logos/logo_planeja_color.png`,
  reguaBranca: `${import.meta.env.BASE_URL}logos/regua_planejamais_branco.png`,
  reguaCor: `${import.meta.env.BASE_URL}logos/regua_planejamais_color.png`,
  pgp: `${import.meta.env.BASE_URL}logos/PGP_1.png`,
};

const fmtMi = (v) => v >= 1e9 ? `R$ ${(v/1e9).toFixed(2).replace('.',',')} bi`
  : v >= 1e6 ? `R$ ${(v/1e6).toFixed(0)} mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(0)} mil` : `R$ ${v.toFixed(0)}`;
const fmtFull = (v) => (v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });

function useCount(target, ms=1200) {
  const [v,setV]=useState(0);
  useEffect(()=>{let raf,t0;const tk=(t)=>{if(!t0)t0=t;const p=Math.min((t-t0)/ms,1);setV(target*(1-Math.pow(1-p,3)));if(p<1)raf=requestAnimationFrame(tk);};raf=requestAnimationFrame(tk);return()=>cancelAnimationFrame(raf);},[target,ms]);
  return v;
}

function Tip({active,payload,label}) {
  if(!active||!payload||!payload.length)return null;
  return <div style={{background:C.deep,color:'#fff',padding:'8px 12px',fontSize:12.5,border:`1px solid ${C.mid}`}}>
    <div style={{fontWeight:700,marginBottom:3}}>{label||payload[0].name}</div>
    {payload.map((p,i)=><div key={i} style={{color:'#DDEDE4'}}>{p.dataKey&&p.name?`${p.name}: `:''}{fmtFull(p.value)}</div>)}
  </div>;
}

const Ico = {
  home:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg>,
  grid:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z"/></svg>,
  city:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M3 21V9l6-3v3l6-3v4h6v11zM6 18h2v-3H6zm5 0h2v-3h-2zm5 0h2v-3h-2z"/></svg>,
  flow:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M4 4h4v4H4zm12 0h4v4h-4zM4 16h4v4H4zm12 0h4v4h-4zM8 6h8v2H8zM6 8v8h2V8zm10 0v8h2V8z"/></svg>,
  book:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M5 3h12a2 2 0 012 2v16l-4-2-4 2-4-2V5a2 2 0 012-2z"/></svg>,
  back:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M15 5l-7 7 7 7 1.4-1.4L11 12l5.4-5.6z"/></svg>,
  exit:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h5v-2H5V5h5zm7.5 4l-1.4 1.4L18.2 11H9v2h9.2l-2.1 2.6L17.5 17 22 12z"/></svg>,
};

function Sidebar({ page, setPage, onSair }) {
  const items=[['panorama','Panorama',Ico.home],['area','Por área',Ico.grid],['municipio','Municípios',Ico.city],['execucao','Execução',Ico.flow],['glossario','Glossário',Ico.book]];
  return <aside style={{width:92,background:C.sidebar,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:18,flexShrink:0}}>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:1}}>
      {items.map(([id,label,I])=>{
        const on=page===id;
        return <button key={id} onClick={()=>setPage(id)} title={label} style={{width:76,height:56,border:'none',background:on?C.sidebarHover:'transparent',color:on?'#fff':'#8FBBA8',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,cursor:'pointer',borderLeft:on?`3px solid ${C.lime}`:'3px solid transparent',transition:'.15s'}}>
          <I width={22} height={22}/><span style={{fontSize:9,letterSpacing:0.2}}>{label}</span>
        </button>;
      })}
    </div>
    <button onClick={onSair} title="Voltar à tela inicial" style={{width:76,height:48,border:'none',background:'transparent',color:'#6E9483',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',transition:'.15s'}}
      onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='#6E9483'}>
      <Ico.exit width={18} height={18}/><span style={{fontSize:9,letterSpacing:0.2}}>Sair</span>
    </button>
    <img src={LOGO.pgp} alt="PGP - Projeto Gestão e Pesquisa" style={{width:100,height:'auto',maxHeight:100,objectFit:'contain',opacity:0.95,margin:'10px 0 18px'}}
      onError={(e)=>{e.currentTarget.style.display='none';}}/>
  </aside>;
}

function TopBar({ title, sub, kpis }) {
  const val=useCount(kpis.total_petroleo_liquidado);
  return <div style={{background:C.panel,borderBottom:`1px solid ${C.line}`,padding:'14px 26px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
    <div style={{display:'flex',alignItems:'center',gap:16}}>
      <img src={LOGO.planejaCor} alt="Planeja+" style={{height:64,width:'auto'}}
        onError={(e)=>{e.currentTarget.style.display='none';}}/>
      <div style={{borderLeft:`1px solid ${C.line}`,paddingLeft:16}}>
        <div style={{fontSize:11,letterSpacing:1.5,textTransform:'uppercase',color:C.mid,fontWeight:700}}>Rendas Petrolíferas em Dados · RPD</div>
        <div style={{fontSize:20,fontWeight:800,color:C.ink,letterSpacing:-0.4,marginTop:2}}>{title}</div>
        <div style={{fontSize:12,color:C.sub}}>{sub}</div>
      </div>
    </div>
    <div style={{textAlign:'right'}}>
      <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:600}}>Renda petrolífera liquidada · {kpis.ano_inicio}–{kpis.ano_fim}</div>
      <div style={{fontSize:30,fontWeight:800,color:C.primary,letterSpacing:-1,fontVariantNumeric:'tabular-nums',lineHeight:1.1}}>{fmtFull(val)}</div>
    </div>
  </div>;
}

function Panel({ title, hint, children, style, clickHint }) {
  return <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px',...style}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
      <div style={{fontSize:13.5,fontWeight:700,color:C.ink,borderLeft:`3px solid ${C.mid}`,paddingLeft:8,marginBottom:hint?2:12}}>{title}</div>
      {clickHint&&<span style={{fontSize:10.5,color:C.mid,fontWeight:600}}>clique para detalhar</span>}
    </div>
    {hint&&<div style={{fontSize:11.5,color:C.sub,marginBottom:10,paddingLeft:11}}>{hint}</div>}
    {children}
  </div>;
}

function renderActive(p){
  const {cx,cy,innerRadius,outerRadius,startAngle,endAngle,fill}=p;
  return <g><Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius+6} startAngle={startAngle} endAngle={endAngle} fill={fill}/></g>;
}
function DonutArea({ porArea, onClickArea }) {
  const [idx,setIdx]=useState(0);
  const ordem=['territorio','educacao','outras','saude'];
  const mapa=Object.fromEntries(porArea.map(a=>[a.area,a.liquidado]));
  const full=ordem.map(a=>({area:a,valor:mapa[a]||0}));
  const data=full.filter(d=>d.valor>0);
  const tot=data.reduce((s,d)=>s+d.valor,0);
  return <div>
    <ResponsiveContainer width="100%" height={210}>
      <PieChart>
        <Pie data={data} dataKey="valor" nameKey="area" cx="50%" cy="50%" innerRadius={58} outerRadius={82}
          activeIndex={idx} activeShape={renderActive} onMouseEnter={(_,i)=>setIdx(i)}
          onClick={(_,i)=>onClickArea&&onClickArea(data[i].area)} paddingAngle={2} stroke="none"
          style={{cursor:onClickArea?'pointer':'default'}}>
          {data.map((d,i)=><Cell key={i} fill={AREA_COR[d.area]}/>)}
        </Pie>
        <text x="50%" y="47%" textAnchor="middle" style={{fontSize:20,fontWeight:800,fill:C.ink}}>{data.length?((data[idx].valor/tot)*100).toFixed(0):0}%</text>
        <text x="50%" y="58%" textAnchor="middle" style={{fontSize:11,fill:C.sub}}>{data.length?AREA_LABEL[data[idx].area]:''}</text>
      </PieChart>
    </ResponsiveContainer>
    <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:4}}>
      {full.map((d)=>{
        const on=data[idx]&&data[idx].area===d.area;
        return <div key={d.area} onMouseEnter={()=>d.valor>0&&setIdx(data.findIndex(x=>x.area===d.area))}
          onClick={()=>d.valor>0&&onClickArea&&onClickArea(d.area)}
          style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,padding:'3px 6px',background:on?C.mist:'transparent',cursor:(d.valor&&onClickArea)?'pointer':'default'}}>
          <span style={{display:'flex',alignItems:'center',gap:7}}><span style={{width:10,height:10,background:AREA_COR[d.area]}}/>{AREA_LABEL[d.area]}</span>
          <span style={{fontWeight:600,color:d.valor?C.ink:C.sub}}>{d.valor?fmtMi(d.valor):'sem dados'}</span>
        </div>;
      })}
    </div>
  </div>;
}

function MapaPlaceholder({ kpis }) {
  return <div style={{background:`linear-gradient(160deg, ${C.deep} 0%, ${C.primary} 100%)`,color:'#fff',padding:'18px 20px',position:'relative',overflow:'hidden',minHeight:150,height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',boxSizing:'border-box'}}>
    <div style={{position:'absolute',right:-30,bottom:-30,width:150,height:150,borderRadius:'50%',background:'rgba(123,192,67,0.15)'}}/>
    <div>
      <div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',opacity:0.8,fontWeight:700}}>Cobertura territorial</div>
      <div style={{fontSize:34,fontWeight:800,letterSpacing:-1,marginTop:4}}>{kpis.municipios_cobertos}<span style={{fontSize:18,opacity:0.7}}> de {kpis.municipios_totais}</span></div>
      <div style={{fontSize:12,opacity:0.9}}>municípios com dados · demais em coleta</div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,zIndex:1}}>
      <span style={{fontSize:22}}>🗺️</span>
      <span style={{fontSize:11.5,opacity:0.92,lineHeight:1.4}}>Mapa interativo por região <strong>em desenvolvimento</strong>, entra na próxima versão.</span>
    </div>
  </div>;
}

function Panorama({ dados, irParaMunicipio, irParaArea }) {
  const { kpis, agregados } = dados;
  const porAno = agregados.por_ano.map(x=>({ano:String(x.ano),valor:x.liquidado}));
  const muns = agregados.por_municipio_area.slice(0,8).map(m=>({
    nome: m.municipio,
    'Território': m.territorio||0, 'Educação': m.educacao||0, 'Outras': m.outras||0,
  }));
  const ciclo = [
    {etapa:'Empenhado',valor:agregados.ciclo.empenhado},
    {etapa:'Liquidado',valor:agregados.ciclo.liquidado},
    {etapa:'Pago',valor:agregados.ciclo.pago},
  ];
  return <div style={{padding:20,display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:14}}>
    <div style={{gridColumn:'span 3',background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px',display:'flex',flexDirection:'column',justifyContent:'center'}}>
      <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Total de gastos registrados</div>
      <div style={{fontSize:28,fontWeight:800,color:C.ink,letterSpacing:-1}}>{fmtMi(kpis.total_geral_liquidado)}</div>
      <div style={{fontSize:11.5,color:C.sub,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.line}`}}>Período coberto</div>
      <div style={{fontSize:18,fontWeight:800,color:C.mid}}>{kpis.ano_inicio}–{kpis.ano_fim}</div>
    </div>
    <div style={{gridColumn:'span 3'}}>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px',height:'100%',boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Renda petrolífera liquidada</div>
        <div style={{fontSize:26,fontWeight:800,color:C.primary,letterSpacing:-1}}>{fmtMi(kpis.total_petroleo_liquidado)}</div>
        <div style={{fontSize:11.5,color:C.sub}}>paga com recursos do petróleo</div>
      </div>
    </div>
    <div style={{gridColumn:'span 6'}}><MapaPlaceholder kpis={kpis}/></div>

    <div style={{gridColumn:'span 5'}}>
      <Panel title="Distribuição por área de política" hint="Passe o mouse. Clique numa área para ver os gastos. Saúde aguarda coleta." clickHint>
        <DonutArea porArea={agregados.por_area} onClickArea={(a)=>irParaArea(a)}/>
      </Panel>
    </div>
    <div style={{gridColumn:'span 7'}}>
      <Panel title="Evolução ano a ano" hint="Clique num ano para ver o ranking de municípios daquele ano." clickHint>
        <ResponsiveContainer width="100%" height={252}>
          <AreaChart data={porAno} margin={{left:0,right:10,top:10}}
            onClick={(e)=>e&&e.activeLabel&&irParaArea(null,Number(e.activeLabel))}>
            <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mid} stopOpacity={0.45}/><stop offset="100%" stopColor={C.mid} stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="ano" tick={{fontSize:12,fill:C.sub}}/>
            <YAxis tickFormatter={fmtMi} tick={{fontSize:10.5,fill:C.sub}} width={58}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="valor" name="Liquidado" stroke={C.primary} strokeWidth={2.5} fill="url(#ga)" dot={{r:3.5,fill:C.primary}} activeDot={{r:6,style:{cursor:'pointer'}}} animationDuration={1000}/>
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>

    <div style={{gridColumn:'span 7'}}>
      <Panel title="Municípios que mais aplicaram" hint="Clique numa barra para abrir o detalhe do município." clickHint>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={muns} margin={{left:6,right:16,bottom:40}}
            onClick={(e)=>e&&e.activeLabel&&irParaMunicipio(e.activeLabel)}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="nome" tick={{fontSize:10,fill:C.sub}} angle={-30} textAnchor="end" interval={0} height={54}/>
            <YAxis tickFormatter={fmtMi} tick={{fontSize:10.5,fill:C.sub}} width={58}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="Território" stackId="a" fill={C.primary} animationDuration={800} style={{cursor:'pointer'}}/>
            <Bar dataKey="Educação" stackId="a" fill={C.soft} animationDuration={800} style={{cursor:'pointer'}}/>
            <Bar dataKey="Outras" stackId="a" fill={C.pale} animationDuration={800} style={{cursor:'pointer'}}/>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
    <div style={{gridColumn:'span 5'}}>
      <Panel title="Ciclo do gasto" hint="Do reservado ao que saiu do caixa.">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ciclo} margin={{left:6,right:16}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="etapa" tick={{fontSize:12,fill:C.ink,fontWeight:600}}/>
            <YAxis tickFormatter={fmtMi} tick={{fontSize:10.5,fill:C.sub}} width={58}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Valor" animationDuration={800}>
              <Cell fill={C.pale}/><Cell fill={C.mid}/><Cell fill={C.primary}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>

    <div style={{gridColumn:'span 12',fontSize:11,color:C.sub,padding:'8px 4px',borderTop:`1px solid ${C.line}`,marginTop:2}}>
      Fonte: monitoramento do orçamento público municipal · período {kpis.ano_inicio}–{kpis.ano_fim} · valores de despesa liquidada.
    </div>
  </div>;
}

function ListaMunicipios({ dados, irParaMunicipio }) {
  // total por municipio (com dado)
  const totais = Object.fromEntries(dados.agregados.por_municipio_area.map(m=>[
    m.municipio, (m.territorio||0)+(m.educacao||0)+(m.saude||0)+(m.outras||0)
  ]));
  // todos os 26, agrupados por UF
  const UFS = [['ES','Espírito Santo'],['RJ','Rio de Janeiro'],['SP','São Paulo']];
  const porUF = Object.fromEntries(UFS.map(([uf])=>[uf, dados.municipios.filter(m=>m.uf===uf)]));

  return <div style={{padding:20}}>
    <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px',marginBottom:16}}>
      <div style={{fontSize:13.5,fontWeight:700,color:C.ink,borderLeft:`3px solid ${C.mid}`,paddingLeft:8,lineHeight:1.5}}>
        O Programa Planeja+ da Petrobras está organizado em 7 núcleos regionais e cobre 26 municípios nos estados do Espírito Santo, Rio de Janeiro e São Paulo.
      </div>
      <div style={{fontSize:12,color:C.sub,marginTop:8,paddingLeft:11}}>Clique num município para ver o detalhe completo.</div>
    </div>

    {UFS.map(([uf,nome])=>(
      <div key={uf} style={{marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:800,color:C.deep,marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:C.primary,color:'#fff',padding:'2px 10px',fontSize:12,fontWeight:700}}>{uf}</span>
          {nome}
          <span style={{fontSize:11.5,color:C.sub,fontWeight:400}}>· {porUF[uf].length} municípios</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:12}}>
          {porUF[uf].sort((a,b)=>(totais[b.nome]||0)-(totais[a.nome]||0)).map(m=>{
            const temDado=m.tem_dado && totais[m.nome]!==undefined;
            return <button key={m.canonico} onClick={()=>temDado&&irParaMunicipio(m.nome)} disabled={!temDado} style={{
              textAlign:'left',background:temDado?C.bg:'#F7F7F7',border:`1px solid ${C.line}`,padding:'14px 16px',
              cursor:temDado?'pointer':'default',display:'flex',flexDirection:'column',gap:4,opacity:temDado?1:0.72}}
              onMouseEnter={e=>temDado&&(e.currentTarget.style.borderColor=C.mid)}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.line}>
              <span style={{fontWeight:700,color:C.ink,fontSize:14}}>{m.nome}</span>
              {temDado? <>
                <span style={{fontSize:18,fontWeight:800,color:C.primary}}>{fmtMi(totais[m.nome])}</span>
                <span style={{fontSize:11,color:C.sub}}>renda petrolífera liquidada →</span>
              </> : <>
                <span style={{fontSize:14,fontWeight:700,color:C.sub}}>dados em coleta</span>
                <span style={{fontSize:11,color:C.sub}}>Região {m.regiao} do Planeja+</span>
              </>}
            </button>;
          })}
        </div>
      </div>
    ))}
  </div>;
}

function DetalheMunicipio({ dados, municipio, filtroInicial, voltar }) {
  const [fAno, setFAno] = useState(filtroInicial?.ano ? String(filtroInicial.ano) : 'todos');
  const [fArea, setFArea] = useState(filtroInicial?.area || 'todos');

  const info = dados.municipios.find(m=>m.nome===municipio) || {};
  const regs = useMemo(()=>dados.registros.filter(r=>r.municipio===municipio), [dados, municipio]);
  const petRegs = regs.filter(r=>r.fonte_classe==='petroleo');

  const totalPet = petRegs.reduce((s,r)=>s+r.liquidado,0);
  const anos = [...new Set(regs.map(r=>r.ano))].sort();
  const areasDisp = [...new Set(regs.map(r=>r.area))];

  const porArea = Object.entries(petRegs.reduce((acc,r)=>{acc[r.area]=(acc[r.area]||0)+r.liquidado;return acc;},{}))
    .map(([area,liquidado])=>({area,liquidado}));
  const porAno = anos.map(a=>({ano:String(a),valor:petRegs.filter(r=>r.ano===a).reduce((s,r)=>s+r.liquidado,0)}));
  const ciclo = [
    {etapa:'Empenhado',valor:petRegs.reduce((s,r)=>s+r.empenhado,0)},
    {etapa:'Liquidado',valor:petRegs.reduce((s,r)=>s+r.liquidado,0)},
    {etapa:'Pago',valor:petRegs.reduce((s,r)=>s+r.pago,0)},
  ];

  const listaFiltrada = regs.filter(r=>
    (fAno==='todos'||r.ano===Number(fAno)) &&
    (fArea==='todos'||r.area===fArea)
  ).sort((a,b)=>b.liquidado-a.liquidado);

  const btnStyle = (on)=>({padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${on?C.primary:C.line}`,background:on?C.primary:C.panel,color:on?'#fff':C.sub});

  return <div style={{padding:20}}>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
      <button onClick={voltar} style={{display:'flex',alignItems:'center',gap:4,background:C.panel,border:`1px solid ${C.line}`,padding:'8px 12px',cursor:'pointer',color:C.sub,fontSize:13,fontWeight:600}}>
        <Ico.back width={16} height={16}/> Voltar
      </button>
      <div>
        <div style={{fontSize:24,fontWeight:800,color:C.ink,letterSpacing:-0.5}}>{municipio}</div>
        <div style={{fontSize:12.5,color:C.sub}}>{info.uf} · Região {info.regiao} do Planeja+</div>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
      <div style={{background:`linear-gradient(135deg,${C.deep},${C.primary})`,color:'#fff',padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',opacity:0.85,fontWeight:700}}>Renda petrolífera liquidada</div>
        <div style={{fontSize:26,fontWeight:800,letterSpacing:-0.5}}>{fmtFull(totalPet)}</div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Registros</div>
        <div style={{fontSize:26,fontWeight:800,color:C.ink}}>{regs.length}</div>
        <div style={{fontSize:11,color:C.sub}}>lançamentos na planilha</div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Anos com dados</div>
        <div style={{fontSize:22,fontWeight:800,color:C.ink}}>{anos.join(', ')}</div>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
      <Panel title="Por área">
        {porArea.length? <DonutArea porArea={porArea}/> : <div style={{color:C.sub,fontSize:12,padding:20}}>Sem dados de petróleo.</div>}
      </Panel>
      <Panel title="Evolução anual">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={porAno} margin={{left:0,right:8}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="ano" tick={{fontSize:11,fill:C.sub}}/>
            <YAxis tickFormatter={fmtMi} tick={{fontSize:10,fill:C.sub}} width={54}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Liquidado" fill={C.mid} animationDuration={700}/>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Ciclo do gasto">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={ciclo} margin={{left:0,right:8}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="etapa" tick={{fontSize:10.5,fill:C.ink,fontWeight:600}}/>
            <YAxis tickFormatter={fmtMi} tick={{fontSize:10,fill:C.sub}} width={54}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Valor" animationDuration={700}>
              <Cell fill={C.pale}/><Cell fill={C.mid}/><Cell fill={C.primary}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>

    <Panel title={`Gastos detalhados · ${listaFiltrada.length} registros`} hint="Cada linha é um lançamento real consultado nas fontes oficiais dos dados.">
      <div style={{display:'flex',gap:16,marginBottom:12,flexWrap:'wrap',paddingLeft:11}}>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11.5,color:C.sub,fontWeight:600}}>Ano:</span>
          <button style={btnStyle(fAno==='todos')} onClick={()=>setFAno('todos')}>Todos</button>
          {anos.map(a=><button key={a} style={btnStyle(fAno===String(a))} onClick={()=>setFAno(String(a))}>{a}</button>)}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:11.5,color:C.sub,fontWeight:600}}>Área:</span>
          <button style={btnStyle(fArea==='todos')} onClick={()=>setFArea('todos')}>Todas</button>
          {areasDisp.map(a=><button key={a} style={btnStyle(fArea===a)} onClick={()=>setFArea(a)}>{AREA_LABEL[a]}</button>)}
        </div>
      </div>
      <div style={{maxHeight:420,overflow:'auto',border:`1px solid ${C.line}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:C.deep,color:'#fff'}}>
            <tr>
              {['Ano','Área','O que foi feito','Fonte','Liquidado'].map(h=>
                <th key={h} style={{textAlign:h==='Liquidado'?'right':'left',padding:'9px 10px',fontWeight:700,fontSize:11}}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((r,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C.line}`,background:i%2?C.bg:'#fff'}}>
                <td style={{padding:'8px 10px',color:C.sub}}>{r.ano}</td>
                <td style={{padding:'8px 10px'}}><span style={{display:'inline-block',width:8,height:8,background:AREA_COR[r.area],marginRight:5}}/>{AREA_LABEL[r.area]}</td>
                <td style={{padding:'8px 10px',maxWidth:360}}>
                  <div style={{fontWeight:600,color:C.ink}}>{r.acao||'—'}</div>
                  {r.historico&&<div style={{fontSize:11,color:C.sub,marginTop:2,lineHeight:1.4}}>{r.historico.length>150?r.historico.slice(0,150)+'…':r.historico}</div>}
                </td>
                <td style={{padding:'8px 10px'}}>
                  <span style={{fontSize:10.5,padding:'2px 7px',background:r.fonte_classe==='petroleo'?C.mist:C.line,color:C.deep,fontWeight:600}}>{FONTE_LABEL[r.fonte_classe]}</span>
                </td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:C.ink,whiteSpace:'nowrap'}}>{fmtFull(r.liquidado)}</td>
              </tr>
            ))}
            {listaFiltrada.length===0&&<tr><td colSpan={5} style={{padding:24,textAlign:'center',color:C.sub}}>Nenhum registro para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  </div>;
}

function AreaPage({ dados, irParaArea }) {
  const terr = dados.agregados.territorio_detalhe.map(t=>({nome:t.funcao,valor:t.liquidado}));
  return <div style={{padding:20,display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:14}}>
    <div style={{gridColumn:'span 5'}}><Panel title="Participação de cada área" hint="Clique numa área para ver os gastos." clickHint><DonutArea porArea={dados.agregados.por_area} onClickArea={(a)=>irParaArea(a)}/></Panel></div>
    <div style={{gridColumn:'span 7'}}>
      <Panel title="Território por dentro" hint="Subfunções que compõem o território.">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={terr} layout="vertical" margin={{left:10,right:30}}>
            <CartesianGrid horizontal={false} stroke={C.line}/>
            <XAxis type="number" tickFormatter={fmtMi} tick={{fontSize:10.5,fill:C.sub}}/>
            <YAxis type="category" dataKey="nome" tick={{fontSize:12,fill:C.ink,fontWeight:600}} width={120}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Liquidado" radius={[0,4,4,0]} animationDuration={800}>
              {terr.map((_,i)=><Cell key={i} fill={`rgba(31,122,90,${1-i*0.13})`}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
    <div style={{gridColumn:'span 12'}}>
      <Panel title="Saúde">
        <div style={{padding:'24px',textAlign:'center',color:C.sub,fontSize:13,background:C.bg,border:`1px dashed ${C.pale}`}}>
          Sem dados de saúde nesta versão. A coleta desta área será incorporada quando os dados estiverem disponíveis, conforme previsto no plano de trabalho.
        </div>
      </Panel>
    </div>
  </div>;
}

// Detalhe por AREA ou por ANO: lista de gastos daquela area/ano em todos os municipios
function DetalheFiltro({ dados, area, ano, voltar, irParaMunicipio }) {
  const titulo = area ? `Área: ${AREA_LABEL[area]}` : `Ano: ${ano}`;
  const regs = dados.registros.filter(r=>
    (area? r.area===area : true) && (ano? r.ano===ano : true) && r.fonte_classe==='petroleo'
  );
  // agrega por municipio
  const porMun = Object.entries(regs.reduce((acc,r)=>{acc[r.municipio]=(acc[r.municipio]||0)+r.liquidado;return acc;},{}))
    .map(([municipio,valor])=>({municipio,valor})).sort((a,b)=>b.valor-a.valor);
  const total = regs.reduce((s,r)=>s+r.liquidado,0);
  return <div style={{padding:20}}>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
      <button onClick={voltar} style={{display:'flex',alignItems:'center',gap:4,background:C.panel,border:`1px solid ${C.line}`,padding:'8px 12px',cursor:'pointer',color:C.sub,fontSize:13,fontWeight:600}}>
        <Ico.back width={16} height={16}/> Voltar
      </button>
      <div>
        <div style={{fontSize:22,fontWeight:800,color:C.ink,letterSpacing:-0.5}}>{titulo}</div>
        <div style={{fontSize:12.5,color:C.sub}}>{fmtFull(total)} em renda petrolífera liquidada · {porMun.length} municípios</div>
      </div>
    </div>
    <Panel title="Ranking de municípios" hint="Clique num município para ver o detalhe completo dele.">
      <ResponsiveContainer width="100%" height={Math.max(220, porMun.length*34)}>
        <BarChart data={porMun} layout="vertical" margin={{left:10,right:40}} onClick={(e)=>e&&e.activeLabel&&irParaMunicipio(e.activeLabel)}>
          <CartesianGrid horizontal={false} stroke={C.line}/>
          <XAxis type="number" tickFormatter={fmtMi} tick={{fontSize:10.5,fill:C.sub}}/>
          <YAxis type="category" dataKey="municipio" tick={{fontSize:11.5,fill:C.ink,fontWeight:600}} width={150}/>
          <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
          <Bar dataKey="valor" name="Liquidado" radius={[0,4,4,0]} animationDuration={700} style={{cursor:'pointer'}}>
            {porMun.map((_,i)=><Cell key={i} fill={`rgba(31,122,90,${1-i*0.045})`}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  </div>;
}

function Simple({title,txt}) {
  return <div style={{padding:20}}><Panel title={title}><div style={{padding:'30px',textAlign:'center',color:C.sub,fontSize:13}}>{txt}</div></Panel></div>;
}

function Glossario() {
  const termos = [
    ['Royalties', 'Valor que o município recebe como compensação pela exploração de petróleo e gás no seu território ou próximo a ele. É a principal renda petrolífera.'],
    ['Participação especial', 'Uma compensação financeira extra, paga quando um campo de petróleo tem produção muito alta. Vai para municípios, estados e União.'],
    ['Participações na exploração', 'Nome que aparece em alguns registros para as transferências ligadas à exploração de petróleo e gás. Conta como renda petrolífera.'],
    ['Compensação financeira', 'Pagamento que o município recebe pela exploração de recursos naturais, como petróleo, gás ou minerais, no seu território.'],
    ['Cessão onerosa e pré-sal', 'Tipos de contrato de exploração de petróleo e gás, principalmente na camada do pré-sal. Geram receita para os municípios.'],
    ['Despesa empenhada', 'O primeiro passo do gasto público: o valor que a prefeitura reserva no orçamento para pagar algo. Ainda não saiu do caixa.'],
    ['Despesa liquidada', 'A etapa em que o serviço ou a obra foi entregue e conferido, e a prefeitura reconhece que deve pagar. É o valor principal deste painel.'],
    ['Despesa paga', 'O valor que efetivamente saiu do caixa da prefeitura e foi pago ao fornecedor.'],
    ['Função', 'A grande área em que o governo gasta o dinheiro. Exemplos: saúde, educação, urbanismo, saneamento.'],
    ['Território', 'Neste painel, agrupa as funções ligadas ao espaço urbano e ambiental: urbanismo, saneamento, gestão ambiental, transporte, habitação e conservação.'],
    ['Fonte de recursos', 'De onde veio o dinheiro que pagou um gasto. É por aqui que se identifica se a despesa foi paga com recursos do petróleo.'],
    ['Natureza da despesa', 'O tipo do gasto: se é obra, compra de material, pagamento de pessoal, serviço, e assim por diante.'],
  ];
  return <div style={{padding:20}}>
    <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
      <div style={{fontSize:13.5,fontWeight:700,color:C.ink,borderLeft:`3px solid ${C.mid}`,paddingLeft:8,marginBottom:4}}>Glossário</div>
      <div style={{fontSize:11.5,color:C.sub,marginBottom:14,paddingLeft:11}}>Termos do orçamento público explicados em linguagem simples.</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:12}}>
        {termos.map(([t,d])=>(
          <div key={t} style={{background:C.bg,border:`1px solid ${C.line}`,padding:'12px 14px'}}>
            <div style={{fontWeight:700,color:C.deep,fontSize:13.5,marginBottom:4}}>{t}</div>
            <div style={{fontSize:12.5,color:C.sub,lineHeight:1.5}}>{d}</div>
          </div>
        ))}
      </div>
    </div>
  </div>;
}

// Formas geometricas do Planeja+ (quadrados de cantos arredondados, 3 tons de verde),
// agrupadas em clusters como no material grafico do programa.
function FormasPlaneja() {
  // cores da paleta Planeja+
  const VD = '#2E8B4A';   // verde escuro
  const VM = '#5FBB57';   // verde medio
  const VL = '#8CC63F';   // verde claro/lima
  const TQ = '#3AA99A';   // turquesa (apoio)
  // cada forma: x,y em %, tamanho em unidades, rotacao, cor, opacidade
  const formas = [
    // cluster superior direito
    { x: 84, y: 6,  s: 5.5, rot: -8, cor: VM, op: 0.30 },
    { x: 92, y: 12, s: 6.5, rot: 6,  cor: VL, op: 0.26 },
    { x: 88, y: 20, s: 5,   rot: -4, cor: VD, op: 0.28 },
    { x: 95, y: 24, s: 4.5, rot: 10, cor: TQ, op: 0.24 },
    // cluster meio direito
    { x: 90, y: 46, s: 6,   rot: 4,  cor: VL, op: 0.22 },
    { x: 96, y: 54, s: 5,   rot: -6, cor: VM, op: 0.24 },
    // cluster inferior direito
    { x: 86, y: 76, s: 6.5, rot: 8,  cor: VD, op: 0.26 },
    { x: 93, y: 82, s: 5.5, rot: -5, cor: VL, op: 0.24 },
    { x: 90, y: 90, s: 5,   rot: 6,  cor: TQ, op: 0.22 },
    // cluster inferior esquerdo (discreto)
    { x: 4,  y: 84, s: 6,   rot: -6, cor: VM, op: 0.16 },
    { x: 9,  y: 92, s: 5,   rot: 8,  cor: VL, op: 0.15 },
  ];
  return <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
    {formas.map((f,i)=>{
      const half=f.s/2;
      return <rect key={i} x={f.x-half} y={f.y-half} width={f.s} height={f.s} rx={f.s*0.28} ry={f.s*0.28}
        fill={f.cor} opacity={f.op} transform={`rotate(${f.rot} ${f.x} ${f.y})`}/>;
    })}
  </svg>;
}

function Home({ onEnter, kpis }) {
  const stats = [
    [fmtMi(kpis.total_petroleo_liquidado),'renda petrolífera liquidada'],
    [`${kpis.municipios_cobertos} municípios`,'com dados disponíveis'],
    [`${kpis.ano_inicio}–${kpis.ano_fim}`,'período coberto'],
  ];
  return <div style={{minHeight:'100%',height:'100%',overflowY:'auto',background:`linear-gradient(150deg, ${C.deep} 0%, ${C.primary} 55%, ${C.mid} 100%)`,color:'#fff',display:'flex',flexDirection:'column',position:'relative',boxSizing:'border-box'}}>
    <FormasPlaneja/>

    {/* topo: logo + titulo ao lado */}
    <div style={{padding:'30px 40px 16px',display:'flex',alignItems:'center',gap:24,zIndex:1,flexWrap:'wrap'}}>
      <img src={LOGO.planejaBranca} alt="Planeja+" style={{height:160,width:'auto',maxWidth:'90%',objectFit:'contain'}}
        onError={(e)=>{e.currentTarget.style.display='none';}}/>
      <div style={{borderLeft:'2px solid rgba(255,255,255,0.25)',paddingLeft:24}}>
        <div style={{fontSize:26,fontWeight:800,letterSpacing:-0.5,lineHeight:1.15}}>Rendas Petrolíferas em Dados</div>
        <div style={{fontSize:20,fontWeight:700,color:C.lime,letterSpacing:-0.2}}>Painel RPD Planeja+</div>
        <div style={{fontSize:13.5,opacity:0.85,marginTop:6,maxWidth:360,lineHeight:1.4}}>Monitoramento Participativo do Orçamento Público</div>
      </div>
    </div>

    {/* meio: pergunta-titulo + texto */}
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'6px 40px',maxWidth:980,zIndex:1}}>
      <h1 style={{fontSize:32,fontWeight:800,letterSpacing:-0.8,lineHeight:1.1,margin:'0 0 12px'}}>Para onde vai o dinheiro do petróleo?</h1>
      <p style={{fontSize:15.5,lineHeight:1.6,opacity:0.94,maxWidth:640,margin:'0 0 26px'}}>
        Este painel acompanha como os 26 municípios do Planeja+ aplicam as rendas petrolíferas nas
        políticas públicas de saúde, educação e território. Os valores mostram o que foi
        efetivamente executado, com os dados atuais entre {kpis.ano_inicio} e {kpis.ano_fim}.
      </p>
      {/* botao + numeros lado a lado */}
      <div style={{display:'flex',alignItems:'center',gap:24}}>
        <button onClick={onEnter} style={{background:C.lime,color:C.deep,border:'none',padding:'16px 30px',fontSize:15,fontWeight:800,cursor:'pointer',letterSpacing:0.3,whiteSpace:'nowrap',flexShrink:0}}>Entrar no painel →</button>
        <div style={{display:'flex',gap:24,borderLeft:'2px solid rgba(255,255,255,0.2)',paddingLeft:24,flexShrink:0}}>
          {stats.map(([v,l])=>(
            <div key={l}><div style={{fontSize:22,fontWeight:800,whiteSpace:'nowrap'}}>{v}</div><div style={{fontSize:12,opacity:0.8,whiteSpace:'nowrap'}}>{l}</div></div>
          ))}
        </div>
      </div>
    </div>

    {/* rodape: regua centralizada */}
    <div style={{padding:'18px 40px 24px',zIndex:1,display:'flex',justifyContent:'center',borderTop:'1px solid rgba(255,255,255,0.15)'}}>
      <img src={LOGO.reguaBranca} alt="Associação Raízes · Petrobras · IBAMA" style={{height:100,width:'auto',maxWidth:'100%',objectFit:'contain'}}
        onError={(e)=>{e.currentTarget.style.display='none';}}/>
    </div>
  </div>;
}

export default function App() {
  useLato();
  const [dados,setDados]=useState(null);
  const [erro,setErro]=useState(null);
  const [entered,setEntered]=useState(false);
  const [page,setPage]=useState('panorama');
  const [munSel,setMunSel]=useState(null);
  const [filtroDet,setFiltroDet]=useState(null);
  const [detFiltro,setDetFiltro]=useState(null); // {area} ou {ano} para a tela DetalheFiltro

  useEffect(()=>{
    fetch(`${import.meta.env.BASE_URL}data/dados.json`)
      .then(r=>{ if(!r.ok) throw new Error('Falha ao carregar dados.json'); return r.json(); })
      .then(setDados).catch(e=>setErro(e.message));
  },[]);

  function irParaMunicipio(nome, filtro){
    setMunSel(nome); setFiltroDet(filtro||null); setDetFiltro(null); setPage('municipio');
  }
  function irParaArea(area, ano){
    setDetFiltro({area:area||null, ano:ano||null}); setMunSel(null); setPage('detfiltro');
  }

  if(erro) return <div style={{fontFamily:FONT,padding:40,color:C.deep}}>
    <h2>Não foi possível carregar os dados</h2>
    <p>Verifique se o arquivo <code>public/data/dados.json</code> existe. Detalhe: {erro}</p>
  </div>;

  if(!dados) return <div style={{fontFamily:FONT,height:'100vh',display:'grid',placeItems:'center',background:C.bg,color:C.sub}}>
    <div>Carregando dados do painel…</div>
  </div>;

  const titles={
    panorama:['Panorama geral','Visão consolidada das rendas petrolíferas'],
    area:['Por área de política','Saúde, educação e território'],
    municipio:[munSel?munSel:'Municípios','Detalhe dos gastos por município'],
    detfiltro:['Detalhamento','Gastos por município'],
    execucao:['Execução orçamentária','Do previsto ao pago'],
    glossario:['Glossário','Termos do orçamento público'],
  };

  if(!entered) return <div style={{fontFamily:FONT,height:'100vh'}}><Home onEnter={()=>setEntered(true)} kpis={dados.kpis}/></div>;

  function navSidebar(p){ setPage(p); setMunSel(null); setFiltroDet(null); setDetFiltro(null); }

  return <div style={{fontFamily:FONT,display:'flex',height:'100vh',background:C.bg,color:C.ink}}>
    <Sidebar page={page==='detfiltro'?'panorama':page} setPage={navSidebar} onSair={()=>{setEntered(false);navSidebar('panorama');}}/>
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <TopBar title={titles[page][0]} sub={titles[page][1]} kpis={dados.kpis}/>
      <div style={{flex:1,overflow:'auto'}}>
        {page==='panorama'&&<Panorama dados={dados} irParaMunicipio={irParaMunicipio} irParaArea={irParaArea}/>}
        {page==='area'&&<AreaPage dados={dados} irParaArea={irParaArea}/>}
        {page==='municipio'&&munSel&&<DetalheMunicipio dados={dados} municipio={munSel} filtroInicial={filtroDet} voltar={()=>{setMunSel(null);setFiltroDet(null);}}/>}
        {page==='municipio'&&!munSel&&<ListaMunicipios dados={dados} irParaMunicipio={irParaMunicipio}/>}
        {page==='detfiltro'&&detFiltro&&<DetalheFiltro dados={dados} area={detFiltro.area} ano={detFiltro.ano} voltar={()=>setPage('panorama')} irParaMunicipio={irParaMunicipio}/>}
        {page==='execucao'&&<Simple title="Execução orçamentária" txt="Detalhamento do ciclo previsto, empenhado, liquidado e pago por município entra aqui."/>}
        {page==='glossario'&&<Glossario/>}
        <footer style={{background:C.panel,borderTop:`1px solid ${C.line}`,padding:'18px 26px',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <img src={LOGO.reguaCor} alt="Associação Raízes · Petrobras · IBAMA" style={{height:90,width:'auto',maxWidth:'75%',objectFit:'contain'}}
            onError={(e)=>{e.currentTarget.style.display='none';}}/>
        </footer>
      </div>
    </div>
  </div>;
}