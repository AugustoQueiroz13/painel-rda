import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, AreaChart, Area, Sector
} from 'recharts';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

// ====================================================================
// Painel RPD - Rendas Petroliferas em Dados (acao 19.1 Planeja+)
// BLOCO 2: trabalha com FUNCOES (nao mais areas), metrica PAGO,
// valores completos com centavos. Dados: public/data/dados.json.
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
const FONTE_LABEL = { petroleo: 'Petróleo', outros: 'Outros', nao_informado: 'Não informado' };

// Paleta para as 16 funcoes na rosca (tons variados, distinguíveis)
const CORES_FUNCAO = [
  '#1F7A5A', '#2E9E74', '#57B98C', '#8FC9A9', '#7BC043', '#3AA99A',
  '#0F3D2E', '#5FA88A', '#A3D4B4', '#6BAF4B', '#2C8C7E', '#4C9E6F',
  '#89C267', '#B7DDC5', '#39795E', '#9AC', '#C7E3D4', '#268F6B',
];
function corFuncao(i) { return CORES_FUNCAO[i % CORES_FUNCAO.length]; }

const LOGO = {
  planejaBranca: `${import.meta.env.BASE_URL}logos/logo_planeja_branca.png`,
  planejaCor: `${import.meta.env.BASE_URL}logos/logo_planeja_color.png`,
  reguaBranca: `${import.meta.env.BASE_URL}logos/regua_planejamais_branco.png`,
  reguaCor: `${import.meta.env.BASE_URL}logos/regua_planejamais_color.png`,
  pgp: `${import.meta.env.BASE_URL}logos/PGP_1.png`,
};

// abreviado: SO nos eixos dos graficos
const fmtEixo = (v) => v >= 1e9 ? `R$ ${(v/1e9).toFixed(1).replace('.',',')} bi`
  : v >= 1e6 ? `R$ ${(v/1e6).toFixed(0)} mi` : v >= 1e3 ? `R$ ${(v/1e3).toFixed(0)} mil` : `R$ ${v.toFixed(0)}`;
// abreviado de RESUMO: KPIs de topo do Panorama e numeros da tela inicial
// bilhoes com 3 casas ("R$ 1,135 bi"), milhoes inteiros ("R$ 883 mi")
const fmtResumo = (v) => v >= 1e9 ? `R$ ${(v/1e9).toFixed(3).replace('.',',')} bi`
  : v >= 1e6 ? `R$ ${Math.round(v/1e6)} mi` : v >= 1e3 ? `R$ ${Math.round(v/1e3)} mil` : `R$ ${v.toFixed(0)}`;
// COMPLETO com centavos: todo valor especifico
const fmtFull = (v) => (v||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 });
// porcentagem que nunca zera um valor real: >=1% inteiro, <1% com casas ate refletir o dado
const fmtPct = (parte, total) => {
  if(!total || parte<=0) return '0%';
  const p = (parte/total)*100;
  if(p>=1) return `${Math.round(p)}%`;
  if(p>=0.1) return `${p.toFixed(1).replace('.',',')}%`;
  if(p>=0.01) return `${p.toFixed(2).replace('.',',')}%`;
  return '<0,01%';
};

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
  book:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M5 3h12a2 2 0 012 2v16l-4-2-4 2-4-2V5a2 2 0 012-2z"/></svg>,
  back:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M15 5l-7 7 7 7 1.4-1.4L11 12l5.4-5.6z"/></svg>,
  exit:(p)=><svg viewBox="0 0 24 24" {...p}><path fill="currentColor" d="M10 3H5a2 2 0 00-2 2v14a2 2 0 002 2h5v-2H5V5h5zm7.5 4l-1.4 1.4L18.2 11H9v2h9.2l-2.1 2.6L17.5 17 22 12z"/></svg>,
};

function Sidebar({ page, setPage, onSair }) {
  const items=[['panorama','Panorama',Ico.home],['funcao','Por função',Ico.grid],['municipio','Municípios',Ico.city],['glossario','Glossário',Ico.book]];
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
  const val=useCount(kpis.total_petroleo_pago);
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
      <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:600}}>Renda petrolífera paga · {kpis.ano_inicio}–{kpis.ano_fim}</div>
      <div style={{fontSize:28,fontWeight:800,color:C.primary,letterSpacing:-1,fontVariantNumeric:'tabular-nums',lineHeight:1.1}}>{fmtFull(val)}</div>
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

// Rosca de FUNCOES (todas as 16). data = [{funcao, pago}], ja ordenado desc.
function DonutFuncao({ dados, onClickFuncao }) {
  const [idx,setIdx]=useState(0);
  const data=dados.filter(d=>d.pago>0);
  const tot=data.reduce((s,d)=>s+d.pago,0);
  if(!data.length) return <div style={{color:C.sub,fontSize:12,padding:20}}>Sem dados.</div>;
  return <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
    <div style={{flex:'0 0 210px'}}>
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie data={data} dataKey="pago" nameKey="funcao" cx="50%" cy="50%" innerRadius={62} outerRadius={90}
            activeIndex={idx} activeShape={renderActive} onMouseEnter={(_,i)=>setIdx(i)}
            onClick={(_,i)=>onClickFuncao&&onClickFuncao(data[i].funcao)} paddingAngle={1.5} stroke="none"
            style={{cursor:onClickFuncao?'pointer':'default'}}>
            {data.map((d,i)=><Cell key={i} fill={corFuncao(i)}/>)}
          </Pie>
          <text x="50%" y="46%" textAnchor="middle" style={{fontSize:19,fontWeight:800,fill:C.ink}}>{fmtPct(data[idx].pago, tot)}</text>
          <text x="50%" y="57%" textAnchor="middle" style={{fontSize:10.5,fill:C.sub}}>{data[idx].funcao}</text>
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div style={{flex:1,minWidth:200,display:'flex',flexDirection:'column',gap:3,maxHeight:230,overflow:'auto'}}>
      {data.map((d,i)=>{
        const on=i===idx;
        return <div key={d.funcao} onMouseEnter={()=>setIdx(i)}
          onClick={()=>onClickFuncao&&onClickFuncao(d.funcao)}
          style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11.5,padding:'3px 6px',background:on?C.mist:'transparent',cursor:onClickFuncao?'pointer':'default'}}>
          <span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:9,height:9,background:corFuncao(i),flexShrink:0}}/>{d.funcao}</span>
          <span style={{fontWeight:600,color:C.ink,whiteSpace:'nowrap',marginLeft:8}}>{fmtFull(d.pago)}</span>
        </div>;
      })}
    </div>
  </div>;
}

// Mapa coropletico: SO os 26 municipios do Planeja+, enquadrados para
// preencher toda a area destinada. Legenda pequena no canto.
function MapaCoropletico({ dados, irParaMunicipio }) {
  const [geo, setGeo] = useState(null);
  const [estados, setEstados] = useState(null);
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState({x:0,y:0,texto:'',valor:''});

  const totais = useMemo(()=>{
    const canon = Object.fromEntries(dados.municipios.map(m=>[m.nome, m.canonico]));
    const acc = {};
    dados.agregados.por_municipio_funcao.forEach(m=>{
      const c = canon[m.municipio];
      if(c) acc[c] = Object.values(m.funcoes).reduce((s,v)=>s+v,0);
    });
    return acc;
  },[dados]);
  const maxVal = Math.max(1, ...Object.values(totais));
  const nomePorCanon = Object.fromEntries(dados.municipios.map(m=>[m.canonico, m.nome]));

  useEffect(()=>{
    fetch(`${import.meta.env.BASE_URL}data/municipios.geojson`).then(r=>r.json()).then(setGeo).catch(()=>setGeo('erro'));
    fetch(`${import.meta.env.BASE_URL}data/estados.geojson`).then(r=>r.json()).then(setEstados).catch(()=>setEstados(null));
  },[]);

  const W=760, H=440; // mapa largo, legenda agora fica fora (na lateral)

  function corPlaneja(canon){
    const v = totais[canon];
    if(v===undefined || v===0) return '#BFD9C8';
    const t = Math.pow(v/maxVal, 0.6);
    const lerp=(a,b)=>Math.round(a+(b-a)*t);
    const c1=[143,201,169], c2=[15,61,46];
    return `rgb(${lerp(c1[0],c2[0])},${lerp(c1[1],c2[1])},${lerp(c1[2],c2[2])})`;
  }

  if(geo==='erro') return <MapaFallback kpis={dados.kpis}/>;
  if(!geo) return <div style={{minHeight:300,display:'grid',placeItems:'center',background:C.panel,border:`1px solid ${C.line}`,color:C.sub,fontSize:12}}>Carregando mapa…</div>;

  return <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'14px 18px',position:'relative',boxSizing:'border-box'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
      <div style={{fontSize:13.5,fontWeight:700,color:C.ink,borderLeft:`3px solid ${C.mid}`,paddingLeft:8}}>Mapa dos municípios do Planeja+</div>
      <span style={{fontSize:11,color:C.sub}}>passe o mouse ou clique num município</span>
    </div>
    <div style={{display:'flex',gap:12,alignItems:'stretch'}}>
      <div style={{position:'relative',flex:1,minWidth:0}}>
        <ComposableMap projection="geoMercator"
          projectionConfig={{ center:[-44.47,-23.05], scale:5000 }}
          width={W} height={H} style={{width:'100%',height:'auto'}}>
          {/* camada de fundo: contorno dos estados */}
          {estados && <Geographies geography={estados}>
            {({geographies})=>geographies.map(g=>(
              <Geography key={g.rsmKey} geography={g}
                fill="#F3F6F4" stroke="#C6D3CB" strokeWidth={0.8}
                style={{default:{outline:'none',pointerEvents:'none'},hover:{outline:'none',pointerEvents:'none'},pressed:{outline:'none'}}}/>
            ))}
          </Geographies>}
          {/* camada dos 26 municipios */}
          <Geographies geography={geo}>
            {({geographies})=>geographies.map(g=>{
              const canon=g.properties.canonico;
              const temDado=totais[canon]!==undefined && totais[canon]>0;
              return <Geography key={g.rsmKey} geography={g}
                fill={hover===canon?C.lime:corPlaneja(canon)}
                stroke="#fff" strokeWidth={0.7}
                style={{default:{outline:'none'},hover:{outline:'none',cursor:temDado?'pointer':'default'},pressed:{outline:'none'}}}
                onMouseEnter={(e)=>{setHover(canon);const v=totais[canon];setTip({x:e.clientX,y:e.clientY,texto:nomePorCanon[canon],valor:(v===undefined||v===0)?'dados em coleta':fmtFull(v)});}}
                onMouseMove={(e)=>setTip(t=>({...t,x:e.clientX,y:e.clientY}))}
                onMouseLeave={()=>setHover(null)}
                onClick={()=>temDado&&irParaMunicipio(nomePorCanon[canon])}/>;
            })}
          </Geographies>
        </ComposableMap>
      </div>
      {/* legenda vertical na lateral direita */}
      <div style={{flex:'0 0 130px',display:'flex',flexDirection:'column',justifyContent:'center',gap:8,paddingLeft:6,borderLeft:`1px solid ${C.line}`}}>
        <div style={{fontSize:11,fontWeight:700,color:C.ink,lineHeight:1.3}}>Renda petrolífera gasta</div>
        <div style={{display:'flex',gap:8,alignItems:'stretch'}}>
          <div style={{width:14,height:120,background:'linear-gradient(to top,#BFD9C8,#0F3D2E)',flexShrink:0}}/>
          <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',fontSize:10,color:C.sub}}>
            <span>mais</span>
            <span>menos</span>
          </div>
        </div>
        <div style={{fontSize:10.5,color:C.sub,lineHeight:1.4,marginTop:4}}>Quanto mais escuro, mais o município gastou de renda do petróleo.</div>
      </div>
    </div>
    {hover && <div style={{position:'fixed',left:tip.x+14,top:tip.y+14,background:C.deep,color:'#fff',padding:'8px 12px',fontSize:12.5,pointerEvents:'none',zIndex:1000,border:`1px solid ${C.mid}`}}>
      <div style={{fontWeight:700,marginBottom:2}}>{tip.texto}</div>
      <div style={{color:'#DDEDE4'}}>{tip.valor}</div>
    </div>}
  </div>;
}

// fallback se o geojson nao carregar
function MapaFallback({ kpis }) {
  return <div style={{background:`linear-gradient(160deg, ${C.deep} 0%, ${C.primary} 100%)`,color:'#fff',padding:'18px 20px',minHeight:150,height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',boxSizing:'border-box'}}>
    <div style={{fontSize:11,letterSpacing:1,textTransform:'uppercase',opacity:0.8,fontWeight:700}}>Cobertura territorial</div>
    <div style={{fontSize:34,fontWeight:800,letterSpacing:-1,marginTop:4}}>{kpis.municipios_cobertos}<span style={{fontSize:18,opacity:0.7}}> de {kpis.municipios_totais}</span></div>
    <div style={{fontSize:12,opacity:0.9}}>municípios com dados · demais em coleta</div>
  </div>;
}

function Panorama({ dados, irParaMunicipio, irParaFuncao, irParaAno }) {
  const { kpis, agregados } = dados;
  const porAno = agregados.por_ano.map(x=>({ano:String(x.ano),valor:x.pago}));
  // top 8 municipios por total pago (soma das funcoes)
  const muns = agregados.por_municipio_funcao.slice(0,8).map(m=>({
    nome: m.municipio,
    total: Object.values(m.funcoes).reduce((s,v)=>s+v,0),
  }));
  const ciclo = [
    {etapa:'Empenhado',valor:agregados.ciclo.empenhado},
    {etapa:'Liquidado',valor:agregados.ciclo.liquidado},
    {etapa:'Pago',valor:agregados.ciclo.pago},
  ];
  return <div style={{padding:20,display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:14}}>
    {/* coluna esquerda: KPIs empilhados */}
    <div style={{gridColumn:'span 3',display:'flex',flexDirection:'column',gap:14}}>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Total de gastos pagos</div>
        <div style={{fontSize:26,fontWeight:800,color:C.ink,letterSpacing:-0.5}}>{fmtResumo(kpis.total_geral_pago)}</div>
        <div style={{fontSize:11.5,color:C.sub,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.line}`}}>Período coberto</div>
        <div style={{fontSize:18,fontWeight:800,color:C.mid}}>{kpis.ano_inicio}–{kpis.ano_fim}</div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Renda petrolífera paga</div>
        <div style={{fontSize:24,fontWeight:800,color:C.primary,letterSpacing:-0.5}}>{fmtResumo(kpis.total_petroleo_pago)}</div>
        <div style={{fontSize:11.5,color:C.sub}}>paga com recursos do petróleo</div>
      </div>
      <div style={{background:`linear-gradient(160deg, ${C.deep} 0%, ${C.primary} 100%)`,color:'#fff',padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',opacity:0.8,fontWeight:700}}>Cobertura territorial</div>
        <div style={{fontSize:30,fontWeight:800,letterSpacing:-1,marginTop:2}}>{kpis.municipios_cobertos}<span style={{fontSize:16,opacity:0.7}}> de {kpis.municipios_totais}</span></div>
        <div style={{fontSize:11.5,opacity:0.9}}>municípios com dados · demais em coleta</div>
      </div>
    </div>
    {/* mapa ocupa toda a area a direita */}
    <div style={{gridColumn:'span 9'}}><MapaCoropletico dados={dados} irParaMunicipio={irParaMunicipio}/></div>


    <div style={{gridColumn:'span 7'}}>
      <Panel title="Evolução por ano" hint="Valor pago de renda petrolífera. Clique num ano para ver os municípios daquele ano." clickHint>
        <ResponsiveContainer width="100%" height={252}>
          <AreaChart data={porAno} margin={{left:0,right:10,top:10}}
            onClick={(e)=>e&&e.activeLabel&&irParaAno(Number(e.activeLabel))}>
            <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.mid} stopOpacity={0.45}/><stop offset="100%" stopColor={C.mid} stopOpacity={0.02}/></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="ano" tick={{fontSize:12,fill:C.sub}}/>
            <YAxis tickFormatter={fmtEixo} tick={{fontSize:10.5,fill:C.sub}} width={64}/>
            <Tooltip content={<Tip/>}/>
            <Area type="monotone" dataKey="valor" name="Pago" stroke={C.primary} strokeWidth={2.5} fill="url(#ga)" dot={{r:3.5,fill:C.primary}} activeDot={{r:6,style:{cursor:'pointer'}}} animationDuration={1000}/>
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
    <div style={{gridColumn:'span 5'}}>
      <Panel title="Ciclo do gasto" hint="Empenhado, liquidado e pago. Pago é a referência do painel.">
        <ResponsiveContainer width="100%" height={252}>
          <BarChart data={ciclo} margin={{left:6,right:16}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="etapa" tick={{fontSize:12,fill:C.ink,fontWeight:600}}/>
            <YAxis tickFormatter={fmtEixo} tick={{fontSize:10.5,fill:C.sub}} width={64}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Valor" animationDuration={800}>
              <Cell fill={C.pale}/><Cell fill={C.mid}/><Cell fill={C.primary}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>

    <div style={{gridColumn:'span 12'}}>
      <Panel title="Distribuição por política pública" hint="Passe o mouse nas fatias. Clique numa função para ver os municípios que mais aplicaram nela." clickHint>
        <DonutFuncao dados={agregados.por_funcao} onClickFuncao={(f)=>irParaFuncao(f)}/>
      </Panel>
    </div>

    <div style={{gridColumn:'span 12'}}>
      <Panel title="Municípios que mais aplicaram" hint="Valor pago total. Clique numa barra para abrir o detalhe do município." clickHint>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={muns} margin={{left:6,right:16,bottom:40}}
            onClick={(e)=>e&&e.activeLabel&&irParaMunicipio(e.activeLabel)}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="nome" tick={{fontSize:10.5,fill:C.sub}} angle={-25} textAnchor="end" interval={0} height={54}/>
            <YAxis tickFormatter={fmtEixo} tick={{fontSize:10.5,fill:C.sub}} width={64}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="total" name="Pago" radius={[4,4,0,0]} animationDuration={800} style={{cursor:'pointer'}}>
              {muns.map((_,i)=><Cell key={i} fill={`rgba(31,122,90,${1-i*0.06})`}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>

    <div style={{gridColumn:'span 12',fontSize:11,color:C.sub,padding:'8px 4px',borderTop:`1px solid ${C.line}`,marginTop:2}}>
      Fonte: monitoramento do orçamento público municipal · período {kpis.ano_inicio}–{kpis.ano_fim} · valores de despesa paga.
    </div>
  </div>;
}

// Aba "Por função": rosca + ranking de municipios da funcao selecionada, na MESMA tela
function FuncaoPage({ dados, irParaMunicipio }) {
  const [funcSel, setFuncSel] = useState(dados.agregados.por_funcao[0]?.funcao || null);

  // municipios que aplicaram na funcao selecionada (por pago)
  const munsDaFuncao = useMemo(()=>{
    const acc = {};
    dados.registros.forEach(r=>{
      if(r.funcao===funcSel && r.fonte_classe==='petroleo'){
        acc[r.municipio]=(acc[r.municipio]||0)+r.pago;
      }
    });
    return Object.entries(acc).map(([municipio,valor])=>({municipio,valor}))
      .filter(x=>x.valor>0).sort((a,b)=>b.valor-a.valor);
  },[dados,funcSel]);
  const totalFunc = munsDaFuncao.reduce((s,m)=>s+m.valor,0);

  return <div style={{padding:20,display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:14}}>
    <div style={{gridColumn:'span 6'}}>
      <Panel title="Despesa por função" hint="Passe o mouse ou clique numa função para ver os municípios ao lado.">
        <DonutFuncao dados={dados.agregados.por_funcao} onClickFuncao={(f)=>setFuncSel(f)}/>
      </Panel>
    </div>
    <div style={{gridColumn:'span 6'}}>
      <Panel title={funcSel ? `Municípios · ${funcSel}` : 'Municípios'} hint={funcSel ? `${fmtFull(totalFunc)} pagos nesta função · ${munsDaFuncao.length} municípios. Clique para o detalhe.` : ''}>
        {munsDaFuncao.length ? (
          <div style={{maxHeight:300,overflow:'auto'}}>
            <ResponsiveContainer width="100%" height={Math.max(200, munsDaFuncao.length*30)}>
              <BarChart data={munsDaFuncao} layout="vertical" margin={{left:10,right:40}}
                onClick={(e)=>e&&e.activeLabel&&irParaMunicipio(e.activeLabel)}>
                <CartesianGrid horizontal={false} stroke={C.line}/>
                <XAxis type="number" tickFormatter={fmtEixo} tick={{fontSize:10,fill:C.sub}}/>
                <YAxis type="category" dataKey="municipio" tick={{fontSize:11,fill:C.ink,fontWeight:600}} width={140}/>
                <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
                <Bar dataKey="valor" name="Pago" radius={[0,4,4,0]} animationDuration={600} style={{cursor:'pointer'}}>
                  {munsDaFuncao.map((_,i)=><Cell key={i} fill={`rgba(31,122,90,${1-i*0.05})`}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div style={{padding:24,textAlign:'center',color:C.sub,fontSize:12}}>Selecione uma função na rosca ao lado.</div>}
      </Panel>
    </div>
  </div>;
}

function ListaMunicipios({ dados, irParaMunicipio }) {
  const totais = Object.fromEntries(dados.agregados.por_municipio_funcao.map(m=>[
    m.municipio, Object.values(m.funcoes).reduce((s,v)=>s+v,0)
  ]));
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
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
          {porUF[uf].sort((a,b)=>(totais[b.nome]||0)-(totais[a.nome]||0)).map(m=>{
            const temDado=m.tem_dado && totais[m.nome]!==undefined;
            return <button key={m.canonico} onClick={()=>temDado&&irParaMunicipio(m.nome)} disabled={!temDado} style={{
              textAlign:'left',background:temDado?C.bg:'#F7F7F7',border:`1px solid ${C.line}`,padding:'14px 16px',
              cursor:temDado?'pointer':'default',display:'flex',flexDirection:'column',gap:4,opacity:temDado?1:0.72}}
              onMouseEnter={e=>temDado&&(e.currentTarget.style.borderColor=C.mid)}
              onMouseLeave={e=>e.currentTarget.style.borderColor=C.line}>
              <span style={{fontWeight:700,color:C.ink,fontSize:14}}>{m.nome}</span>
              {temDado? <>
                <span style={{fontSize:16,fontWeight:800,color:C.primary}}>{fmtFull(totais[m.nome])}</span>
                <span style={{fontSize:11,color:C.sub}}>renda petrolífera paga →</span>
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

function AbaExecutado({ dados, municipio }) {
  const [fAno, setFAno] = useState('todos');
  const [fFunc, setFFunc] = useState('todos');
  const regs = useMemo(()=>dados.registros.filter(r=>r.municipio===municipio), [dados, municipio]);
  const petRegs = regs.filter(r=>r.fonte_classe==='petroleo');
  const totalPet = petRegs.reduce((s,r)=>s+r.pago,0);
  const anos = [...new Set(regs.map(r=>r.ano))].sort();
  const funcsDisp = [...new Set(regs.map(r=>r.funcao))].sort();
  const porFuncao = Object.entries(petRegs.reduce((acc,r)=>{acc[r.funcao]=(acc[r.funcao]||0)+r.pago;return acc;},{}))
    .map(([funcao,pago])=>({funcao,pago})).sort((a,b)=>b.pago-a.pago);
  const porAno = anos.map(a=>({ano:String(a),valor:petRegs.filter(r=>r.ano===a).reduce((s,r)=>s+r.pago,0)}));
  const ciclo = [
    {etapa:'Empenhado',valor:petRegs.reduce((s,r)=>s+r.empenhado,0)},
    {etapa:'Liquidado',valor:petRegs.reduce((s,r)=>s+r.liquidado,0)},
    {etapa:'Pago',valor:petRegs.reduce((s,r)=>s+r.pago,0)},
  ];
  const listaFiltrada = regs.filter(r=>(fAno==='todos'||r.ano===Number(fAno)) && (fFunc==='todos'||r.funcao===fFunc)).sort((a,b)=>b.pago-a.pago);
  const btnStyle=(on)=>({padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${on?C.primary:C.line}`,background:on?C.primary:C.panel,color:on?'#fff':C.sub});
  return <>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
      <div style={{background:`linear-gradient(135deg,${C.deep},${C.primary})`,color:'#fff',padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',opacity:0.85,fontWeight:700}}>Renda petrolífera paga</div>
        <div style={{fontSize:22,fontWeight:800,letterSpacing:-0.5}}>{fmtFull(totalPet)}</div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Registros</div>
        <div style={{fontSize:26,fontWeight:800,color:C.ink}}>{regs.length}</div>
        <div style={{fontSize:11,color:C.sub}}>lançamentos registrados</div>
      </div>
      <div style={{background:C.panel,border:`1px solid ${C.line}`,padding:'16px 18px'}}>
        <div style={{fontSize:10.5,letterSpacing:1,textTransform:'uppercase',color:C.sub,fontWeight:700}}>Anos com dados</div>
        <div style={{fontSize:22,fontWeight:800,color:C.ink}}>{anos.join(', ')}</div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr 1fr',gap:14,marginBottom:14}}>
      <Panel title="Despesa por função">
        {porFuncao.length? <DonutFuncao dados={porFuncao}/> : <div style={{color:C.sub,fontSize:12,padding:20}}>Sem dados de petróleo.</div>}
      </Panel>
      <Panel title="Evolução por ano">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={porAno} margin={{left:0,right:8}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="ano" tick={{fontSize:11,fill:C.sub}}/>
            <YAxis tickFormatter={fmtEixo} tick={{fontSize:10,fill:C.sub}} width={58}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Pago" fill={C.mid} animationDuration={700}/>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      <Panel title="Ciclo do gasto">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={ciclo} margin={{left:0,right:8}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="etapa" tick={{fontSize:10.5,fill:C.ink,fontWeight:600}}/>
            <YAxis tickFormatter={fmtEixo} tick={{fontSize:10,fill:C.sub}} width={58}/>
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
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:11.5,color:C.sub,fontWeight:600}}>Ano:</span>
          <button style={btnStyle(fAno==='todos')} onClick={()=>setFAno('todos')}>Todos</button>
          {anos.map(a=><button key={a} style={btnStyle(fAno===String(a))} onClick={()=>setFAno(String(a))}>{a}</button>)}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:11.5,color:C.sub,fontWeight:600}}>Função:</span>
          <button style={btnStyle(fFunc==='todos')} onClick={()=>setFFunc('todos')}>Todas</button>
          {funcsDisp.map(f=><button key={f} style={btnStyle(fFunc===f)} onClick={()=>setFFunc(f)}>{f}</button>)}
        </div>
      </div>
      <div style={{maxHeight:440,overflow:'auto',border:`1px solid ${C.line}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:C.deep,color:'#fff'}}>
            <tr>{['Ano','Função','O que foi feito','Fonte','Empenhado','Liquidado','Pago'].map(h=>
              <th key={h} style={{textAlign:['Empenhado','Liquidado','Pago'].includes(h)?'right':'left',padding:'9px 10px',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {listaFiltrada.map((r,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C.line}`,background:i%2?C.bg:'#fff'}}>
                <td style={{padding:'8px 10px',color:C.sub}}>{r.ano}</td>
                <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{r.funcao}</td>
                <td style={{padding:'8px 10px',maxWidth:320}}>
                  <div style={{fontWeight:600,color:C.ink}}>{r.acao||'—'}</div>
                  {r.historico&&<div style={{fontSize:11,color:C.sub,marginTop:2,lineHeight:1.4}}>{r.historico.length>140?r.historico.slice(0,140)+'…':r.historico}</div>}
                </td>
                <td style={{padding:'8px 10px'}}><span style={{fontSize:10.5,padding:'2px 7px',background:r.fonte_classe==='petroleo'?C.mist:C.line,color:C.deep,fontWeight:600,whiteSpace:'nowrap'}}>{FONTE_LABEL[r.fonte_classe]}</span></td>
                <td style={{padding:'8px 10px',textAlign:'right',color:C.sub,whiteSpace:'nowrap'}}>{fmtFull(r.empenhado)}</td>
                <td style={{padding:'8px 10px',textAlign:'right',color:C.sub,whiteSpace:'nowrap'}}>{fmtFull(r.liquidado)}</td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:C.ink,whiteSpace:'nowrap'}}>{fmtFull(r.pago)}</td>
              </tr>
            ))}
            {listaFiltrada.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:'center',color:C.sub}}>Nenhum registro para este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  </>;
}

function AbaPlanejado({ dados, municipio }) {
  const [fAno, setFAno] = useState('todos');
  const [fFunc, setFFunc] = useState('todos');
  const regs = useMemo(()=>dados.registros.filter(r=>r.municipio===municipio && r.previsto>0), [dados, municipio]);
  if(!regs.length) return <div style={{padding:'30px',textAlign:'center',color:C.sub,fontSize:13,background:C.panel,border:`1px solid ${C.line}`}}>
    Sem dados de planejamento (LOA) para este município nesta versão. Serão incorporados conforme a coleta avançar.
  </div>;
  const anos=[...new Set(regs.map(r=>r.ano))].sort();
  const funcsDisp=[...new Set(regs.map(r=>r.funcao))].sort();
  const porFuncao = Object.entries(regs.reduce((acc,r)=>{acc[r.funcao]=(acc[r.funcao]||0)+r.previsto;return acc;},{}))
    .map(([funcao,pago])=>({funcao,pago})).sort((a,b)=>b.pago-a.pago);
  const porAno = anos.map(a=>({ano:String(a),valor:regs.filter(r=>r.ano===a).reduce((s,r)=>s+r.previsto,0)}));
  const listaFiltrada = regs.filter(r=>(fAno==='todos'||r.ano===Number(fAno)) && (fFunc==='todos'||r.funcao===fFunc)).sort((a,b)=>b.previsto-a.previsto);
  const btnStyle=(on)=>({padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer',border:`1px solid ${on?C.primary:C.line}`,background:on?C.primary:C.panel,color:on?'#fff':C.sub});
  return <>
    <div style={{background:'#FFF8E8',border:'1px solid #E8D9A8',padding:'10px 14px',marginBottom:14,fontSize:12,color:'#7A5C10'}}>
      Valores de planejamento orçamentário (LOA), tratados para refletir o orçamento de cada ano. Referem-se ao previsto de todas as fontes, não apenas do petróleo.
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14,marginBottom:14}}>
      <Panel title="Planejado por função">
        {porFuncao.length? <DonutFuncao dados={porFuncao}/> : <div style={{color:C.sub,fontSize:12,padding:20}}>Sem dados.</div>}
      </Panel>
      <Panel title="Planejado por ano">
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={porAno} margin={{left:0,right:8}}>
            <CartesianGrid vertical={false} stroke={C.line}/>
            <XAxis dataKey="ano" tick={{fontSize:11,fill:C.sub}}/>
            <YAxis tickFormatter={fmtEixo} tick={{fontSize:10,fill:C.sub}} width={58}/>
            <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
            <Bar dataKey="valor" name="Previsto" fill={C.soft} animationDuration={700}/>
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
    <Panel title={`Planejamento detalhado · ${listaFiltrada.length} registros`} hint="Dimensões do orçamento: função, subfunção, programa, ação e fonte.">
      <div style={{display:'flex',gap:16,marginBottom:12,flexWrap:'wrap',paddingLeft:11}}>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:11.5,color:C.sub,fontWeight:600}}>Ano:</span>
          <button style={btnStyle(fAno==='todos')} onClick={()=>setFAno('todos')}>Todos</button>
          {anos.map(a=><button key={a} style={btnStyle(fAno===String(a))} onClick={()=>setFAno(String(a))}>{a}</button>)}
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:11.5,color:C.sub,fontWeight:600}}>Função:</span>
          <button style={btnStyle(fFunc==='todos')} onClick={()=>setFFunc('todos')}>Todas</button>
          {funcsDisp.map(f=><button key={f} style={btnStyle(fFunc===f)} onClick={()=>setFFunc(f)}>{f}</button>)}
        </div>
      </div>
      <div style={{maxHeight:420,overflow:'auto',border:`1px solid ${C.line}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead style={{position:'sticky',top:0,background:C.deep,color:'#fff'}}>
            <tr>{['Ano','Função','Subfunção','Programa','Ação','Fonte','Previsto'].map(h=>
              <th key={h} style={{textAlign:h==='Previsto'?'right':'left',padding:'9px 10px',fontWeight:700,fontSize:11,whiteSpace:'nowrap'}}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {listaFiltrada.map((r,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C.line}`,background:i%2?C.bg:'#fff'}}>
                <td style={{padding:'8px 10px',color:C.sub}}>{r.ano}</td>
                <td style={{padding:'8px 10px',whiteSpace:'nowrap'}}>{r.funcao}</td>
                <td style={{padding:'8px 10px',color:'#B0B0B0'}}>{r.subfuncao||'—'}</td>
                <td style={{padding:'8px 10px',color:C.sub,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.programa||'—'}</td>
                <td style={{padding:'8px 10px',maxWidth:240}}>{r.acao||'—'}</td>
                <td style={{padding:'8px 10px'}}><span style={{fontSize:10.5,padding:'2px 7px',background:r.fonte_classe==='petroleo'?C.mist:C.line,color:C.deep,fontWeight:600,whiteSpace:'nowrap'}}>{FONTE_LABEL[r.fonte_classe]}</span></td>
                <td style={{padding:'8px 10px',textAlign:'right',fontWeight:700,color:C.ink,whiteSpace:'nowrap'}}>{fmtFull(r.previsto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  </>;
}

function AbaReservada({ titulo, texto }) {
  return <div style={{padding:'40px 30px',textAlign:'center',background:C.panel,border:`1px dashed ${C.pale}`}}>
    <div style={{fontSize:16,fontWeight:800,color:C.deep,marginBottom:8}}>{titulo}</div>
    <div style={{fontSize:13,color:C.sub,maxWidth:520,margin:'0 auto',lineHeight:1.6}}>{texto}</div>
    <span style={{display:'inline-block',marginTop:14,fontSize:11,fontWeight:700,letterSpacing:0.5,textTransform:'uppercase',color:C.primary,background:C.bg,padding:'5px 14px',border:`1px solid ${C.pale}`}}>Em desenvolvimento</span>
  </div>;
}

function DetalheMunicipio({ dados, municipio, filtroInicial, voltar }) {
  const [aba, setAba] = useState('executado');
  const info = dados.municipios.find(m=>m.nome===municipio) || {};
  const abas = [['planejado','Planejado'],['receita','Receita'],['executado','Executado'],['monitorado','Monitorado']];
  const tabStyle=(on)=>({padding:'10px 20px',fontSize:13.5,fontWeight:700,cursor:'pointer',border:'none',borderBottom:on?`3px solid ${C.primary}`:'3px solid transparent',background:'transparent',color:on?C.primary:C.sub});
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
    <div style={{display:'flex',gap:2,borderBottom:`1px solid ${C.line}`,marginBottom:18}}>
      {abas.map(([id,label])=>(
        <button key={id} style={tabStyle(aba===id)} onClick={()=>setAba(id)}>{label}</button>
      ))}
    </div>
    {aba==='executado'&&<AbaExecutado dados={dados} municipio={municipio}/>}
    {aba==='planejado'&&<AbaPlanejado dados={dados} municipio={municipio}/>}
    {aba==='receita'&&<AbaReservada titulo="Receitas do município"
      texto="Os dados de receita (royalties, participação especial, compensação financeira, cessão onerosa e bônus de assinatura, por legislação) serão incorporados a partir do levantamento em andamento pela equipe de pesquisa."/>}
    {aba==='monitorado'&&<AbaReservada titulo="Monitoramento comunitário"
      texto="Esta é a camada de acompanhamento feito pela comunidade e pelos pesquisadores, comparando o planejado com o executado no território. Será alimentada pelas reuniões de monitoramento do programa."/>}
  </div>;
}

function DetalheFiltro({ dados, funcao, ano, voltar, irParaMunicipio }) {
  const titulo = funcao ? `Função: ${funcao}` : `Ano: ${ano}`;
  const regs = dados.registros.filter(r=>
    (funcao? r.funcao===funcao : true) && (ano? r.ano===ano : true) && r.fonte_classe==='petroleo'
  );
  const porMun = Object.entries(regs.reduce((acc,r)=>{acc[r.municipio]=(acc[r.municipio]||0)+r.pago;return acc;},{}))
    .map(([municipio,valor])=>({municipio,valor})).filter(x=>x.valor>0).sort((a,b)=>b.valor-a.valor);
  const total = regs.reduce((s,r)=>s+r.pago,0);
  return <div style={{padding:20}}>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
      <button onClick={voltar} style={{display:'flex',alignItems:'center',gap:4,background:C.panel,border:`1px solid ${C.line}`,padding:'8px 12px',cursor:'pointer',color:C.sub,fontSize:13,fontWeight:600}}>
        <Ico.back width={16} height={16}/> Voltar
      </button>
      <div>
        <div style={{fontSize:22,fontWeight:800,color:C.ink,letterSpacing:-0.5}}>{titulo}</div>
        <div style={{fontSize:12.5,color:C.sub}}>{fmtFull(total)} em renda petrolífera paga · {porMun.length} municípios</div>
      </div>
    </div>
    <Panel title="Ranking de municípios" hint="Clique num município para ver o detalhe completo dele.">
      <ResponsiveContainer width="100%" height={Math.max(220, porMun.length*34)}>
        <BarChart data={porMun} layout="vertical" margin={{left:10,right:40}} onClick={(e)=>e&&e.activeLabel&&irParaMunicipio(e.activeLabel)}>
          <CartesianGrid horizontal={false} stroke={C.line}/>
          <XAxis type="number" tickFormatter={fmtEixo} tick={{fontSize:10.5,fill:C.sub}}/>
          <YAxis type="category" dataKey="municipio" tick={{fontSize:11.5,fill:C.ink,fontWeight:600}} width={150}/>
          <Tooltip content={<Tip/>} cursor={{fill:'rgba(31,122,90,0.05)'}}/>
          <Bar dataKey="valor" name="Pago" radius={[0,4,4,0]} animationDuration={700} style={{cursor:'pointer'}}>
            {porMun.map((_,i)=><Cell key={i} fill={`rgba(31,122,90,${1-i*0.045})`}/>)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  </div>;
}

function Glossario() {
  const termos = [
    ['Royalties', 'Valor que o município recebe como compensação pela exploração de petróleo e gás no seu território ou próximo a ele. É a principal renda petrolífera.'],
    ['Participação especial', 'Uma compensação financeira extra, paga quando um campo de petróleo tem produção muito alta. Vai para municípios, estados e União.'],
    ['Participações na exploração', 'Nome que aparece em alguns registros para as transferências ligadas à exploração de petróleo e gás. Conta como renda petrolífera.'],
    ['Compensação financeira', 'Pagamento que o município recebe pela exploração de recursos naturais, como petróleo, gás ou minerais, no seu território.'],
    ['Cessão onerosa e pré-sal', 'Tipos de contrato de exploração de petróleo e gás, principalmente na camada do pré-sal. Geram receita para os municípios.'],
    ['Despesa empenhada', 'O primeiro passo do gasto público: o valor que a prefeitura reserva no orçamento para pagar algo. Ainda não saiu do caixa.'],
    ['Despesa liquidada', 'A etapa em que o serviço ou a obra foi entregue e conferido, e a prefeitura reconhece que deve pagar.'],
    ['Despesa paga', 'O valor que efetivamente saiu do caixa da prefeitura e foi pago ao fornecedor. É a referência principal deste painel.'],
    ['Função', 'A grande área em que o governo gasta o dinheiro. Exemplos: saúde, educação, urbanismo, saneamento, gestão ambiental.'],
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

function FormasPlaneja() {
  const VD = '#2E8B4A', VM = '#5FBB57', VL = '#8CC63F', TQ = '#3AA99A';
  const formas = [
    { x: 84, y: 6,  s: 5.5, rot: -8, cor: VM, op: 0.30 },
    { x: 92, y: 12, s: 6.5, rot: 6,  cor: VL, op: 0.26 },
    { x: 88, y: 20, s: 5,   rot: -4, cor: VD, op: 0.28 },
    { x: 95, y: 24, s: 4.5, rot: 10, cor: TQ, op: 0.24 },
    { x: 90, y: 46, s: 6,   rot: 4,  cor: VL, op: 0.22 },
    { x: 96, y: 54, s: 5,   rot: -6, cor: VM, op: 0.24 },
    { x: 86, y: 76, s: 6.5, rot: 8,  cor: VD, op: 0.26 },
    { x: 93, y: 82, s: 5.5, rot: -5, cor: VL, op: 0.24 },
    { x: 90, y: 90, s: 5,   rot: 6,  cor: TQ, op: 0.22 },
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
    [fmtResumo(kpis.total_petroleo_pago),'renda petrolífera paga'],
    [`${kpis.municipios_cobertos} municípios`,'com dados disponíveis'],
    [`${kpis.ano_inicio}–${kpis.ano_fim}`,'período coberto'],
  ];
  return <div style={{minHeight:'100%',height:'100%',overflowY:'auto',background:`linear-gradient(150deg, ${C.deep} 0%, ${C.primary} 55%, ${C.mid} 100%)`,color:'#fff',display:'flex',flexDirection:'column',position:'relative',boxSizing:'border-box'}}>
    <FormasPlaneja/>
    <div style={{padding:'30px 40px 16px',display:'flex',alignItems:'center',gap:24,zIndex:1,flexWrap:'wrap'}}>
      <img src={LOGO.planejaBranca} alt="Planeja+" style={{height:160,width:'auto',maxWidth:'90%',objectFit:'contain'}}
        onError={(e)=>{e.currentTarget.style.display='none';}}/>
      <div style={{borderLeft:'2px solid rgba(255,255,255,0.25)',paddingLeft:24}}>
        <div style={{fontSize:26,fontWeight:800,letterSpacing:-0.5,lineHeight:1.15}}>Rendas Petrolíferas em Dados</div>
        <div style={{fontSize:20,fontWeight:700,color:C.lime,letterSpacing:-0.2}}>Painel RPD Planeja+</div>
        <div style={{fontSize:13.5,opacity:0.85,marginTop:6,maxWidth:360,lineHeight:1.4}}>Monitoramento Participativo do Orçamento Público</div>
      </div>
    </div>
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'6px 40px',maxWidth:980,zIndex:1}}>
      <h1 style={{fontSize:32,fontWeight:800,letterSpacing:-0.8,lineHeight:1.1,margin:'0 0 12px'}}>Para onde vai o dinheiro do petróleo?</h1>
      <p style={{fontSize:15.5,lineHeight:1.6,opacity:0.94,maxWidth:640,margin:'0 0 26px'}}>
        Este painel acompanha como os 26 municípios do Planeja+ aplicam as rendas petrolíferas nas
        políticas públicas de saúde, educação e território. Os valores mostram o que foi
        efetivamente executado, com os dados atuais entre {kpis.ano_inicio} e {kpis.ano_fim}.
      </p>
      <div style={{display:'flex',alignItems:'center',gap:24}}>
        <button onClick={onEnter} style={{background:C.lime,color:C.deep,border:'none',padding:'16px 30px',fontSize:15,fontWeight:800,cursor:'pointer',letterSpacing:0.3,whiteSpace:'nowrap',flexShrink:0}}>Entrar no painel →</button>
        <div style={{display:'flex',gap:24,borderLeft:'2px solid rgba(255,255,255,0.2)',paddingLeft:24,flexShrink:0}}>
          {stats.map(([v,l])=>(
            <div key={l}><div style={{fontSize:20,fontWeight:800,whiteSpace:'nowrap'}}>{v}</div><div style={{fontSize:12,opacity:0.8,whiteSpace:'nowrap'}}>{l}</div></div>
          ))}
        </div>
      </div>
    </div>
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
  const [detFiltro,setDetFiltro]=useState(null); // {funcao} ou {ano}

  useEffect(()=>{
    fetch(`${import.meta.env.BASE_URL}data/dados.json`)
      .then(r=>{ if(!r.ok) throw new Error('Falha ao carregar dados.json'); return r.json(); })
      .then(setDados).catch(e=>setErro(e.message));
  },[]);

  function irParaMunicipio(nome, filtro){
    setMunSel(nome); setFiltroDet(filtro||null); setDetFiltro(null); setPage('municipio');
  }
  function irParaFuncao(funcao){
    setDetFiltro({funcao, ano:null}); setMunSel(null); setPage('detfiltro');
  }
  function irParaAno(ano){
    setDetFiltro({funcao:null, ano}); setMunSel(null); setPage('detfiltro');
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
    funcao:['Por função','Despesa por política pública e municípios'],
    municipio:[munSel?munSel:'Municípios','Detalhe dos gastos por município'],
    detfiltro:['Detalhamento','Gastos por município'],
    glossario:['Glossário','Termos do orçamento público'],
  };

  if(!entered) return <div style={{fontFamily:FONT,height:'100vh'}}><Home onEnter={()=>setEntered(true)} kpis={dados.kpis}/></div>;

  function navSidebar(p){ setPage(p); setMunSel(null); setFiltroDet(null); setDetFiltro(null); }

  return <div style={{fontFamily:FONT,display:'flex',height:'100vh',background:C.bg,color:C.ink}}>
    <Sidebar page={page==='detfiltro'?'panorama':page} setPage={navSidebar} onSair={()=>{setEntered(false);navSidebar('panorama');}}/>
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <TopBar title={titles[page][0]} sub={titles[page][1]} kpis={dados.kpis}/>
      <div style={{flex:1,overflow:'auto'}}>
        {page==='panorama'&&<Panorama dados={dados} irParaMunicipio={irParaMunicipio} irParaFuncao={irParaFuncao} irParaAno={irParaAno}/>}
        {page==='funcao'&&<FuncaoPage dados={dados} irParaMunicipio={irParaMunicipio}/>}
        {page==='municipio'&&munSel&&<DetalheMunicipio dados={dados} municipio={munSel} filtroInicial={filtroDet} voltar={()=>{setMunSel(null);setFiltroDet(null);}}/>}
        {page==='municipio'&&!munSel&&<ListaMunicipios dados={dados} irParaMunicipio={irParaMunicipio}/>}
        {page==='detfiltro'&&detFiltro&&<DetalheFiltro dados={dados} funcao={detFiltro.funcao} ano={detFiltro.ano} voltar={()=>setPage('panorama')} irParaMunicipio={irParaMunicipio}/>}
        {page==='glossario'&&<Glossario/>}
        <footer style={{background:C.panel,borderTop:`1px solid ${C.line}`,padding:'18px 26px',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <img src={LOGO.reguaCor} alt="Associação Raízes · Petrobras · IBAMA" style={{height:90,width:'auto',maxWidth:'75%',objectFit:'contain'}}
            onError={(e)=>{e.currentTarget.style.display='none';}}/>
        </footer>
      </div>
    </div>
  </div>;
}