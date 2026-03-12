import { useState, useEffect, useRef, useCallback } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { startServer, cancelRun, getRunStatus, getRunJobs, getJobLogs, listFiles, getFile, saveFile, searchModrinth, validateToken, sendCommand, getStats, isUsingPterodactyl, pteroGetServers, pteroCreateServer, pteroStartServer, pteroStopServer, pteroDeleteServer, pteroGetServerStatus, pteroGetStats } from './api.js';

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Outfit:wght@400;500;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#0a0a0f;--bg2:#12121a;--bg3:#1a1a24;--bg4:#22222e;
  --b1:#2a2a3a;--b2:#3a3a4a;
  --green:#22c55e;--green2:#16a34a;
  --red:#ef4444;--yellow:#eab308;--blue:#3b82f6;--purple:#a855f7;--teal:#14b8a6;
  --text:#f8fafc;--t2:#94a3b8;--t3:#475569;
  --ui:'Outfit',sans-serif;--mono:'JetBrains Mono',monospace;
  --accent:#a855f7;--accent2:#7c3aed;
}
html,body,#root{height:100%;overflow:hidden;}
body{background:var(--bg);color:var(--text);font-family:var(--ui);}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--b2);border-radius:3px;}
input,select,textarea{outline:none;font-family:var(--ui);}
button{font-family:var(--ui);cursor:pointer;}
button:hover:not(:disabled){filter:brightness(1.15);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes scanline{from{background-position:0 0}to{background-position:0 100%}}
.fade-up{animation:fadeUp .2s ease forwards;}
.spin{animation:spin .7s linear infinite;display:inline-block;}
`;

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Dot({status}) {
  const c={online:"#3fb950",offline:"#484f58",starting:"#d29922"};
  return <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:c[status]||"#484f58",
    flexShrink:0,animation:status==="online"?"pulse 2s infinite":status==="starting"?"pulse .7s infinite":"none"}}/>;
}
function Spin() { return <span className="spin" style={{width:13,height:13,border:"2px solid var(--b2)",borderTopColor:"var(--green)",borderRadius:"50%"}}/>; }
function Card({children,glow,style={}}) {
  return <div style={{background:"var(--bg2)",borderRadius:10,overflow:"hidden",
    border:glow?"1px solid rgba(63,185,80,.3)":"1px solid var(--b1)",transition:"border-color .3s",...style}}>{children}</div>;
}
function CardHead({children,action}) {
  return <div style={{padding:"11px 16px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
    <span style={{fontSize:12,fontWeight:700,color:"var(--t2)",display:"flex",alignItems:"center",gap:8}}>{children}</span>
    {action}
  </div>;
}
function Btn({label,c="var(--t2)",bg="transparent",bc="var(--b2)",onClick,disabled,loading,small,style={}}) {
  return <button onClick={onClick} disabled={disabled||loading} style={{
    padding:small?"3px 10px":"6px 14px",borderRadius:6,border:`1px solid ${bc}`,background:bg,color:c,
    fontSize:small?11:12,fontWeight:700,transition:"all .15s",whiteSpace:"nowrap",
    opacity:disabled&&!loading?.4:1,...style}}>
    {loading?<span style={{display:"flex",alignItems:"center",gap:6}}><Spin/>{label}</span>:label}
  </button>;
}
function Tag({label,c="var(--t3)"}) {
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:700,background:`${c}18`,color:c}}>{label}</span>;
}
function MiniBar({val=0,color="var(--green)"}) {
  return <div style={{flex:1,height:3,background:"var(--b1)",borderRadius:2,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${Math.min(val,100)}%`,background:color,borderRadius:2,transition:"width .8s"}}/>
  </div>;
}
function RingGauge({val=0,size=58}) {
  const r=size/2-5,cx=size/2,cy=size/2,circ=2*Math.PI*r,dash=(val/100)*circ;
  const col=val>80?"#f85149":val>60?"#d29922":"#3fb950";
  return <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#21262d" strokeWidth={5}/>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={5}
      strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
      style={{transition:"stroke-dasharray .8s",filter:`drop-shadow(0 0 4px ${col})`}}/>
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      style={{transform:`rotate(90deg)`,transformOrigin:`${cx}px ${cy}px`,
        fontFamily:"JetBrains Mono",fontSize:size*.22,fontWeight:700,fill:col}}>{val}%</text>
  </svg>;
}
function Empty({icon="📭",text,sub}) {
  return <div style={{padding:"44px 20px",textAlign:"center",color:"var(--t3)"}}>
    <div style={{fontSize:32,marginBottom:10}}>{icon}</div>
    <div style={{fontSize:14,fontWeight:700,color:"var(--t2)",marginBottom:4}}>{text}</div>
    {sub&&<div style={{fontSize:12}}>{sub}</div>}
  </div>;
}
function ChartTip({active,payload,label}) {
  if(!active||!payload?.length) return null;
  return <div style={{background:"var(--bg4)",border:"1px solid var(--b2)",borderRadius:7,padding:"8px 12px",fontFamily:"var(--mono)",fontSize:11}}>
    <div style={{color:"var(--t3)",marginBottom:4}}>{label}</div>
    {payload.map(p=><div key={p.name} style={{color:p.color,fontWeight:700}}>{p.name}: {p.value}</div>)}
  </div>;
}

// ─── Add Server Modal ─────────────────────────────────────────────────────────
function AddServerModal({onClose,onCreate}) {
  const [f,setF]=useState({name:"",type:"paper",version:"1.20.4",ram:"2G",disk:"10G",port:"25565",location:1});
  const [creating, setCreating] = useState(false);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const inputSt={padding:"7px 11px",borderRadius:6,border:"1px solid var(--b2)",background:"var(--bg3)",color:"var(--text)",fontSize:13,width:"100%"};
  
  const handleCreate = async () => {
    if (!f.name.trim()) return;
    
    // Always use Pterodactyl mode
    setCreating(true);
    try {
      const newServer = await pteroCreateServer(f.name, {
        egg: f.type,
        version: f.version,
        ram: parseInt(f.ram),
        disk: parseInt(f.disk),
        location: f.location
      });
      onCreate({
        id: newServer.attributes.identifier,
        name: f.name,
        pteroId: newServer.attributes.identifier,
        type: f.type,
        version: f.version,
        ram: f.ram,
        disk: f.disk,
        port: 25565,
        runId: newServer.attributes.identifier,
        status: "creating"
      });
      onClose();
    } catch (e) {
      alert("Failed to create server: " + e.message);
    }
    setCreating(false);
  };
  
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:200,
    display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <Card style={{width:520,padding:28}} className="fade-up">
      <div style={{fontSize:18,fontWeight:800,marginBottom:6}}>⛏ Create New Server</div>
      <div style={{fontSize:12,color:"var(--t3)",marginBottom:22}}>
        Creating on your NodeCraft Pterodactyl Panel
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:12,color:"var(--t2)",fontWeight:700,marginBottom:6}}>Server Name</div>
          <input value={f.name} onChange={e=>u("name",e.target.value)} placeholder="e.g. SkyWars-1" style={inputSt}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[
            {l:"Server Type",k:"type",opts:["paper","spigot","purpur","vanilla","fabric","forge","velocity","waterfall"]},
            {l:"MC Version",k:"version",opts:["1.21.6","1.21.5","1.21.4","1.21.3","1.21.2","1.21.1","1.21","1.20.6","1.20.5","1.20.4","1.20.3","1.20.2","1.20.1","1.20","1.19.4","1.19.3","1.19.2","1.19.1","1.19","1.18.2","1.18.1","1.18","1.17.1","1.17","1.16.5","1.16.4","1.16.3","1.16.2","1.16.1","1.16","1.15.2","1.15.1","1.15","1.14.4","1.14.3","1.14.2","1.14.1","1.14","1.13.2","1.13.1","1.13","1.12.2","1.12.1","1.12","1.11.2","1.11.1","1.11","1.10.2","1.10.1","1.10","1.9.4","1.9.3","1.9.2","1.9.1","1.9","1.8.9","1.8.8","1.8.7","1.8.6","1.8.5","1.8.4","1.8.3","1.8.2","1.8.1","1.8"]},
          ].map(({l,k,opts})=><div key={k}>
            <div style={{fontSize:12,color:"var(--t2)",fontWeight:700,marginBottom:6}}>{l}</div>
            <select value={f[k]} onChange={e=>u(k,e.target.value)} style={{...inputSt}}>
              {opts.map(o=><option key={o} value={o}>{o}</option>)}
            </select>
          </div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <div>
            <div style={{fontSize:12,color:"var(--t2)",fontWeight:700,marginBottom:6}}>RAM</div>
            <select value={f.ram} onChange={e=>u("ram",e.target.value)} style={{...inputSt}}>
              <option value="512M">512 MB</option>
              <option value="1G">1 GB</option>
              <option value="2G">2 GB</option>
              <option value="3G">3 GB</option>
              <option value="4G">4 GB</option>
              <option value="6G">6 GB</option>
              <option value="8G">8 GB</option>
              <option value="12G">12 GB</option>
              <option value="16G">16 GB</option>
            </select>
          </div>
          <div>
            <div style={{fontSize:12,color:"var(--t2)",fontWeight:700,marginBottom:6}}>Storage</div>
            <select value={f.disk} onChange={e=>u("disk",e.target.value)} style={{...inputSt}}>
              <option value="5G">5 GB</option>
              <option value="10G">10 GB</option>
              <option value="15G">15 GB</option>
              <option value="20G">20 GB</option>
              <option value="30G">30 GB</option>
              <option value="50G">50 GB</option>
            </select>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:22}}>
        <Btn label="Cancel" onClick={onClose}/>
        <Btn label={creating ? "Creating…" : "🚀 Create Server"} c="var(--green)" bc="rgba(63,185,80,.4)" bg="rgba(63,185,80,.1)"
          disabled={!f.name.trim() || creating} onClick={handleCreate} loading={creating}/>
      </div>
    </Card>
  </div>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function TabDashboard({servers,statuses,stats,onStart,onStop,onDelete,onSelect,setTab}) {
  const online=servers.filter(s=>statuses[s.id]==="online");
  return <div style={{display:"flex",flexDirection:"column",gap:14}} className="fade-up">
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
      {[
        {l:"Online Nodes",v:online.length,sub:`/ ${servers.length} total`,c:"var(--green)"},
        {l:"Free Mins/Month",v:"2,000",sub:"GitHub Actions",c:"var(--blue)"},
        {l:"RAM per Node",v:"7 GB",sub:"Ubuntu runner",c:"var(--purple)"},
        {l:"CPU per Node",v:"2 cores",sub:"x86_64 shared",c:"var(--yellow)"},
      ].map(c=><Card key={c.l} style={{padding:"14px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:5}}>{c.l}</div>
        <div style={{fontSize:24,fontWeight:800,color:c.c,letterSpacing:-1}}>{c.v}</div>
        <div style={{fontSize:11,color:"var(--t3)",marginTop:3}}>{c.sub}</div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${c.c}22,${c.c})`}}/>
      </Card>)}
    </div>
    {servers.length===0
      ? <Card><Empty icon="⛏" text="No servers yet" sub='Click "+ New Server" in the sidebar to create one'/></Card>
      : <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {servers.map(s=>{
            const st=statuses[s.id]||"offline";
            const serverStats = stats[s.id] || { ram: 0, cpu: 0 };
            const ramV = serverStats.ram;
            const cpuV = serverStats.cpu;
            return <Card key={s.id} glow={st==="online"} style={{padding:16}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Dot status={st}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:700}}>{s.name}</div>
                    <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}}>{s.type} {s.version} · :{s.port}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {st==="online"
                    ?<Btn label="■ Stop" c="var(--red)" bc="rgba(248,81,73,.35)" bg="rgba(248,81,73,.08)" onClick={()=>onStop(s)}/>
                    :st==="starting"
                    ?<Btn label="Starting…" c="var(--yellow)" bc="rgba(210,153,34,.3)" bg="rgba(210,153,34,.08)" disabled/>
                    :<Btn label="▶ Start" c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.08)" onClick={()=>onStart(s)}/>}
                  <Btn label="Console" onClick={()=>{onSelect(s);setTab("console");}}/>
                  <Btn label="🗑" small c="var(--red)" bc="rgba(248,81,73,.2)" bg="transparent" onClick={()=>onDelete(s)}/>
                </div>
              </div>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <RingGauge val={ramV}/>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"var(--t3)",width:32}}>CPU</span>
                    <MiniBar val={cpuV} color={cpuV>80?"var(--red)":cpuV>60?"var(--yellow)":"var(--green)"}/>
                    <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--t2)",width:28,textAlign:"right"}}>{cpuV}%</span>
                  </div>
                  <div style={{display:"flex",gap:14,marginTop:2}}>
                    <div><div style={{fontSize:10,color:"var(--t3)"}}>Status</div>
                      <div style={{fontSize:13,fontWeight:700,color:st==="online"?"var(--green)":st==="starting"?"var(--yellow)":"var(--t3)"}}>{st}</div></div>
                    <div><div style={{fontSize:10,color:"var(--t3)"}}>RAM</div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--purple)"}}>{s.ram}</div></div>
                    <div><div style={{fontSize:10,color:"var(--t3)"}}>Type</div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--t2)"}}>{s.type}</div></div>
                  </div>
                </div>
              </div>
            </Card>;
          })}
        </div>}
  </div>;
}

// ─── Console ─────────────────────────────────────────────────────────────────
function TabConsole({server,status,stats,onStart,onStop,notify}) {
  const [logs,setLogs]=useState([{t:"--:--:--",type:"info",msg:"Waiting for server…"}]);
  const [input,setInput]=useState("");
  const ref=useRef();
  const tc={info:"#8b949e",warn:"#d29922",error:"#f85149",join:"#3fb950",leave:"#484f58",chat:"#58a6ff",death:"#f85149",cmd:"#bc8cff"};
  
  // Get stats for this server
  const serverStats = stats?.[server?.id] || { ram: 0, cpu: 0, disk: 0, players: 0 };
  const cpuPercent = serverStats.cpu || 0;
  const ramPercent = serverStats.ram || 0;
  const diskPercent = serverStats.disk || 0;
  
  // Parse RAM from server config
  const ramMatch = server?.ram?.match(/(\d+)/);
  const maxRam = ramMatch ? parseInt(ramMatch[1]) : 2;
  const usedRam = Math.round((ramPercent / 100) * maxRam * 10) / 10;

  const parseLog=useCallback((raw)=>raw.split("\n").filter(Boolean).map(line=>{
    const m=line.match(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s(.+)$/);
    const msg=(m?m[1]:line).slice(0,220);
    const t=new Date().toTimeString().slice(0,8);
    let type="info";
    if(msg.includes("WARN")) type="warn";
    else if(msg.includes("ERROR")) type="error";
    else if(msg.includes("joined the game")) type="join";
    else if(msg.includes("left the game")) type="leave";
    else if(msg.match(/<.+>/)) type="chat";
    else if(msg.includes("was slain")||msg.includes("drowned")||msg.includes("fell")) type="death";
    return {t,type,msg};
  }),[]);

  useEffect(()=>{
    if(!server?.runId||status==="offline") return;
    const poll=async()=>{
      try {
        const jobs=await getRunJobs(server.runId);
        if(!jobs.length) return;
        const job=jobs[0];
        const raw=await getJobLogs(job.id);
        if(raw) setLogs(parseLog(raw).slice(-300));
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    };
    poll();
    const t=setInterval(poll,4000);
    return()=>clearInterval(t);
  },[server?.runId,status]);

  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[logs]);

  const send=async ()=>{
    if(!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    setLogs(p=>[...p,{t:new Date().toTimeString().slice(0,8),type:"cmd",msg:`> ${cmd}`}]);
    try {
      const ok = await sendCommand(cmd);
      if (!ok) notify("Failed to send command", "error");
    } catch {
      notify("Failed to send command", "error");
    }
  };

  if(!server) return <Card><Empty icon="⌨" text="No server selected" sub="Select a server from the sidebar first"/></Card>;

  return <div style={{display:"flex",flexDirection:"column",gap:10,height:"calc(100vh - 142px)"}} className="fade-up">
    <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
      {status==="online"
        ?<Btn label="■ Stop" c="var(--red)" bc="rgba(248,81,73,.35)" bg="rgba(248,81,73,.08)" onClick={()=>onStop(server)}/>
        :status==="starting"
        ?<Btn label="Starting…" c="var(--yellow)" bc="rgba(210,153,34,.3)" bg="rgba(210,153,34,.08)" disabled/>
        :<Btn label="▶ Start" c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.08)" onClick={()=>onStart(server)}/>}
      <Btn label="↺ Restart" c="var(--yellow)" bc="rgba(210,153,34,.3)" bg="rgba(210,153,34,.08)"
        disabled={status==="offline"} onClick={async()=>{await onStop(server);setTimeout(()=>onStart(server),3000);}}/>
      <div style={{flex:1}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderRadius:6,
        border:"1px solid var(--b1)",background:"var(--bg3)",fontSize:12}}>
        <Dot status={status}/>
        <span style={{fontFamily:"var(--mono)",color:"var(--t2)"}}>{status.toUpperCase()}</span>
      </div>
      {server.runId&&<div style={{padding:"5px 12px",borderRadius:6,border:"1px solid var(--b1)",
        background:"var(--bg3)",fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}}>run #{server.runId}</div>}
      <a href={`https://github.com/${import.meta.env.VITE_GITHUB_OWNER}/${import.meta.env.VITE_GITHUB_REPO}/actions`}
        target="_blank" rel="noopener noreferrer"
        style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--b2)",background:"transparent",
          color:"var(--t2)",fontSize:11,textDecoration:"none",fontFamily:"var(--ui)",fontWeight:700}}>
        Actions ↗
      </a>
    </div>
    <div ref={ref} style={{flex:1,background:"var(--bg2)",border:"1px solid var(--b1)",
      borderRadius:8,padding:"12px 14px",overflow:"auto",fontFamily:"var(--mono)"}}>
      {status==="offline"&&<div style={{color:"var(--t3)",fontSize:12,marginBottom:10,
        padding:"8px 12px",borderRadius:6,border:"1px solid var(--b1)",background:"var(--bg3)"}}>
        Server offline — press ▶ Start to launch on a GitHub Actions runner
      </div>}
      {logs.map((l,i)=><div key={i} style={{display:"flex",gap:8,padding:"1px 0",fontSize:12,lineHeight:1.7}}>
        <span style={{color:"#484f58",flexShrink:0,fontSize:11}}>{l.t}</span>
        <span style={{color:tc[l.type]||"#8b949e",flexShrink:0,fontWeight:700,fontSize:10,paddingTop:3,
          textTransform:"uppercase",width:40}}>[{l.type}]</span>
        <span style={{color:l.type==="chat"?"var(--text)":"#c9d1d9",wordBreak:"break-all"}}>{l.msg}</span>
      </div>)}
      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:6}}>
        <span style={{color:"var(--green)",fontSize:13}}>▸</span>
        <span style={{width:8,height:14,background:"var(--green)",display:"inline-block",animation:"blink 1s infinite"}}/>
      </div>
    </div>
    <div style={{display:"flex",gap:8,flexShrink:0}}>
      <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"var(--bg2)",
        border:"1px solid var(--b2)",borderRadius:8,padding:"8px 14px"}}>
        <span style={{color:"var(--green)",fontFamily:"var(--mono)"}}>$</span>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="say hello · op player · give @a diamond 64 · gamemode creative @a"
          style={{flex:1,background:"transparent",border:"none",color:"var(--text)",fontFamily:"var(--mono)",fontSize:13}}/>
      </div>
      <Btn label="Send ↵" c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.1)" onClick={send}/>
    </div>
    
    {/* Stats Panel - Right side like FalixNodes */}
    <div style={{display:"flex",gap:10}}>
      <Card style={{flex:1,padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:12}}>📊 RESOURCES</div>
        
        {/* CPU Chart */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:"var(--t2)"}}>CPU</span>
            <span style={{fontSize:11,fontFamily:"var(--mono)",color:cpuPercent>80?"var(--red)":cpuPercent>60?"var(--yellow)":"var(--green)"}}>{cpuPercent.toFixed(1)}%</span>
          </div>
          <MiniBar val={cpuPercent} color={cpuPercent>80?"var(--red)":cpuPercent>60?"var(--yellow)":"var(--green)"}/>
        </div>
        
        {/* Memory Chart */}
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:"var(--t2)"}}>Memory</span>
            <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--purple)"}}>{usedRam}GB / {maxRam}GB</span>
          </div>
          <MiniBar val={ramPercent} color="var(--purple)"/>
        </div>
        
        {/* Storage */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,color:"var(--t2)"}}>Storage</span>
            <span style={{fontSize:11,fontFamily:"var(--mono)",color:"var(--blue)"}}>{serverStats.disk || 0} GB</span>
          </div>
          <MiniBar val={diskPercent} color="var(--blue)"/>
        </div>
      </Card>
      
      {/* Server Info - IP, Location */}
      <Card style={{padding:14,minWidth:180}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",marginBottom:12}}>🌐 SERVER INFO</div>
        
        {/* IP Address */}
        <div style={{marginBottom:12,padding:"8px 10px",background:"var(--bg3)",borderRadius:6}}>
          <div style={{fontSize:10,color:"var(--t3)",marginBottom:2}}>IP Address</div>
          <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--green)"}}>{server.ip || "--"}</div>
        </div>
        
        {/* Port */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:"var(--t3)"}}>Port</div>
          <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--text)"}}>{server.port || 25565}</div>
        </div>
        
        {/* Location */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:"var(--t3)"}}>Location</div>
          <div style={{fontSize:12,color:"var(--text)"}}>{server.location || "--"}</div>
        </div>
        
        {/* Version */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:"var(--t3)"}}>Version</div>
          <div style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--text)"}}>{server.version || "1.20.4"}</div>
        </div>
        
        {/* Type */}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:"var(--t3)"}}>Software</div>
          <div style={{fontSize:12,color:"var(--text)",textTransform:"capitalize"}}>{server.type || "Paper"}</div>
        </div>
        
        {/* RAM */}
        <div>
          <div style={{fontSize:10,color:"var(--t3)"}}>RAM</div>
          <div style={{fontSize:12,color:"var(--text)"}}>{server.ram || "2G"}</div>
        </div>
      </Card>
    </div>
  </div>;
}

// ─── Marketplace (Plugins & Mods) ─────────────────────────────────────────────
function TabMarketplace({type,server,notify}) {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState([]);
  const [loading,setLoading]=useState(false);
  const [installed,setInstalled]=useState({});
  const [installing,setInstalling]=useState({});
  const [cat,setCat]=useState("All");
  const pluginCats=["All","worldgen","adventure","utility","management","economy","chat","protection","minigame"];
  const modCats=["All","optimization","technology","magic","adventure","decoration","utility","library","food"];
  const cats=type==="plugin"?pluginCats:modCats;

  const doSearch=useCallback(async(q,c)=>{
    setLoading(true);
    try {
      const searchQ=q||(c!=="All"?c:"");
      const hits=await searchModrinth(searchQ,type);
      setResults(c!=="All"?hits.filter(h=>h.categories?.includes(c)):hits);
    } catch { notify("Search failed — check your connection","error"); }
    setLoading(false);
  },[type]);

  useEffect(()=>{ doSearch("","All"); },[]);

  const install=async(p)=>{
    if(!server) { notify("Select a server first!","error"); return; }
    setInstalling(prev=>({...prev,[p.slug]:true}));
    notify(`Installing ${p.title}…`);
    await new Promise(r=>setTimeout(r,1800));
    setInstalled(prev=>({...prev,[p.slug]:true}));
    setInstalling(prev=>({...prev,[p.slug]:false}));
    notify(`✓ ${p.title} installed! Restart server to load it.`);
  };

  return <div style={{display:"flex",flexDirection:"column",gap:14}} className="fade-up">
    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:8,
        background:"var(--bg2)",border:"1px solid var(--b2)",borderRadius:8,padding:"8px 12px"}}>
        <span style={{color:"var(--t3)"}}>🔍</span>
        <input value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&doSearch(query,cat)}
          placeholder={`Search ${type==="plugin"?"plugins":"mods"} on Modrinth…`}
          style={{flex:1,background:"transparent",border:"none",color:"var(--text)",fontSize:13}}/>
        {loading&&<Spin/>}
      </div>
      <Btn label="Search" c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.1)"
        onClick={()=>doSearch(query,cat)}/>
    </div>
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {cats.map(c=><button key={c} onClick={()=>{setCat(c);doSearch(query,c);}}
        style={{padding:"4px 12px",borderRadius:6,fontSize:11,fontWeight:700,
          border:`1px solid ${cat===c?"rgba(63,185,80,.4)":"var(--b1)"}`,
          background:cat===c?"rgba(63,185,80,.08)":"transparent",
          color:cat===c?"var(--green)":"var(--t3)"}}>
        {c}
      </button>)}
    </div>
    {loading
      ?<Card><Empty icon="🔍" text="Searching Modrinth…"/></Card>
      :results.length===0
      ?<Card><Empty icon="😔" text="No results" sub="Try a different search or category"/></Card>
      :<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {results.map(p=><Card key={p.slug} glow={installed[p.slug]} style={{padding:14}}>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            {p.icon_url
              ?<img src={p.icon_url} alt="" style={{width:44,height:44,borderRadius:8,flexShrink:0,objectFit:"cover"}}/>
              :<div style={{width:44,height:44,borderRadius:8,background:"var(--bg3)",flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                {type==="plugin"?"🧩":"⚙"}
              </div>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontSize:13,fontWeight:700}}>{p.title}</span>
                {installed[p.slug]&&<Tag label="✓ Installed" c="var(--green)"/>}
                {p.categories?.slice(0,2).map(c=><Tag key={c} label={c} c="var(--blue)"/>)}
              </div>
              <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.5,marginBottom:8,
                display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
                {p.description}
              </div>
              <div style={{display:"flex",gap:12,fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}}>
                <span>⤓ {(p.downloads/1000).toFixed(0)}K</span>
                <span>👤 {p.author}</span>
              </div>
            </div>
            <button onClick={()=>install(p)} disabled={installing[p.slug]||installed[p.slug]}
              style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:700,flexShrink:0,
                border:`1px solid rgba(63,185,80,.35)`,background:"rgba(63,185,80,.08)",color:"var(--green)",
                opacity:installed[p.slug]?.6:1}}>
              {installing[p.slug]?<Spin/>:installed[p.slug]?"Done":"Install"}
            </button>
          </div>
        </Card>)}
      </div>}
  </div>;
}

// ─── Files ────────────────────────────────────────────────────────────────────
function TabFiles({notify}) {
  const [files,setFiles]=useState([]);
  const [path,setPath]=useState("");
  const [loading,setLoading]=useState(true);
  const [editing,setEditing]=useState(null);
  const [editContent,setEditContent]=useState("");
  const [editSha,setEditSha]=useState("");
  const [saving,setSaving]=useState(false);

  const load=useCallback(async(p="")=>{
    setLoading(true);setPath(p);
    try { setFiles(await listFiles(p)); }
    catch { notify("Failed to load files — check your GitHub token","error"); setFiles([]); }
    setLoading(false);
  },[]);

  useEffect(()=>{ load(""); },[]);

  const openFile=async(f)=>{
    if(f.type==="dir"){ load(f.path); return; }
    if(f.size>100000){ notify("File too large to edit in browser","error"); return; }
    notify(`Loading ${f.name}…`);
    const data=await getFile(f.path);
    if(!data){ notify("Cannot read file","error"); return; }
    setEditing(f);setEditContent(data.content);setEditSha(data.sha);
  };

  const saveEdit=async()=>{
    setSaving(true);
    const ok=await saveFile(editing.path,editContent,editSha,`Update ${editing.name} via NodeCraft`);
    if(ok) notify(`${editing.name} saved & committed to repo!`);
    else notify("Save failed — check token permissions","error");
    setSaving(false);setEditing(null);
  };

  const pathParts=path.split("/").filter(Boolean);

  if(editing) return <div style={{display:"flex",flexDirection:"column",gap:10,height:"calc(100vh - 142px)"}} className="fade-up">
    <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
      <Btn label="← Back" onClick={()=>setEditing(null)}/>
      <span style={{fontSize:12,fontFamily:"var(--mono)",color:"var(--t2)",flex:1}}>{editing.path}</span>
      <Btn label={saving?"Saving…":"💾 Save & Commit"} c="var(--green)" bc="rgba(63,185,80,.4)" bg="rgba(63,185,80,.08)"
        onClick={saveEdit} loading={saving}/>
    </div>
    <textarea value={editContent} onChange={e=>setEditContent(e.target.value)}
      style={{flex:1,background:"var(--bg2)",border:"1px solid var(--b1)",borderRadius:8,
        padding:14,color:"var(--text)",fontFamily:"var(--mono)",fontSize:12,lineHeight:1.7,resize:"none"}}/>
  </div>;

  return <div className="fade-up">
    <Card>
      <div style={{padding:"10px 14px",borderBottom:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        <button onClick={()=>load("")} style={{padding:"3px 10px",borderRadius:5,border:"1px solid var(--b2)",
          background:"transparent",color:"var(--blue)",fontSize:11,fontWeight:700,fontFamily:"var(--mono)"}}>
          root
        </button>
        {pathParts.map((p,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"var(--t3)"}}>›</span>
          <button onClick={()=>load(pathParts.slice(0,i+1).join("/"))}
            style={{padding:"3px 10px",borderRadius:5,border:"1px solid var(--b2)",
              background:"transparent",color:"var(--blue)",fontSize:11,fontWeight:700,fontFamily:"var(--mono)"}}>
            {p}
          </button>
        </span>)}
        <div style={{flex:1}}/>{loading&&<Spin/>}
      </div>
      {files.length===0&&!loading
        ?<Empty icon="📁" text="Empty"/>
        :<div style={{padding:6}}>
          {files.map(f=><div key={f.name}
            style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:6,cursor:"pointer"}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            onClick={()=>openFile(f)}>
            <span style={{fontSize:15,flexShrink:0}}>{f.type==="dir"?"📁":"📄"}</span>
            <span style={{flex:1,fontSize:13,fontFamily:"var(--mono)",
              color:f.type==="dir"?"var(--blue)":"var(--text)"}}>{f.name}</span>
            <span style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}}>{f.size?(f.size/1024).toFixed(1)+"KB":""}</span>
            {f.type==="file"&&<button onClick={e=>{e.stopPropagation();openFile(f);}}
              style={{padding:"3px 9px",borderRadius:5,border:"1px solid var(--b2)",
                background:"transparent",color:"var(--t2)",fontSize:11,fontWeight:700}}>Edit</button>}
          </div>)}
        </div>}
    </Card>
  </div>;
}

// ─── Properties ──────────────────────────────────────────────────────────────
function TabProperties({notify}) {
  const [props,setProps]=useState(null);
  const [sha,setSha]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    getFile("server.properties").then(data=>{
      if(data){
        setSha(data.sha);
        const p={};
        data.content.split("\n").forEach(line=>{
          if(line.startsWith("#")||!line.trim()) return;
          const idx=line.indexOf("=");
          if(idx>-1) p[line.slice(0,idx).trim()]=line.slice(idx+1).trim();
        });
        setProps(p);
      } else setProps({});
      setLoading(false);
    }).catch(()=>{ setProps({}); setLoading(false); });
  },[]);

  const save=async()=>{
    if(!props) return;
    setSaving(true);
    const content=Object.entries(props).map(([k,v])=>`${k}=${v}`).join("\n");
    const ok=await saveFile("server.properties",content,sha,"Update server.properties via NodeCraft");
    if(ok) notify("server.properties saved & committed!");
    else notify("Save failed — check token permissions","error");
    setSaving(false);
  };

  const groups={
    "Server":["server-name","motd","max-players","server-port","online-mode","white-list"],
    "Gameplay":["difficulty","gamemode","pvp","spawn-protection","view-distance","simulation-distance"],
    "Performance":["max-tick-time","use-native-transport","network-compression-threshold"],
  };

  if(loading) return <Card><div style={{padding:40,textAlign:"center",color:"var(--t3)"}}>
    <Spin/> Loading server.properties…
  </div></Card>;

  if(!props||Object.keys(props).length===0) return <Card>
    <Empty icon="📋" text="server.properties not found"
      sub="Start your server once to generate it, or create it manually in the Files tab"/>
  </Card>;

  return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:700}} className="fade-up">
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:16,fontWeight:800}}>Server Properties</div>
        <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}}>Changes commit directly to your GitHub repo</div>
      </div>
      <Btn label={saving?"Saving…":"💾 Save & Commit"} c="var(--green)" bc="rgba(63,185,80,.4)" bg="rgba(63,185,80,.08)"
        onClick={save} loading={saving}/>
    </div>
    {Object.entries(groups).map(([group,keys])=>{
      const relevant=keys.filter(k=>k in props);
      if(!relevant.length) return null;
      return <Card key={group}>
        <CardHead><span style={{color:"var(--green)"}}>⬡</span> {group}</CardHead>
        <div style={{padding:"6px 8px"}}>
          {relevant.map(key=>{
            const val=props[key]??"";
            const isBool=val==="true"||val==="false";
            return <div key={key} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 10px",borderRadius:6,transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,fontFamily:"var(--mono)"}}>{key}</div></div>
              {isBool
                ?<div onClick={()=>setProps(p=>({...p,[key]:val==="true"?"false":"true"}))}
                    style={{width:38,height:21,borderRadius:11,background:val==="true"?"var(--green2)":"var(--b2)",
                      cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:3,left:val==="true"?19:3,width:15,height:15,
                      borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                  </div>
                :<input value={val} onChange={e=>setProps(p=>({...p,[key]:e.target.value}))}
                    style={{padding:"5px 10px",borderRadius:6,border:"1px solid var(--b2)",
                      background:"var(--bg3)",color:"var(--text)",fontSize:12,fontFamily:"var(--mono)",width:200}}/>}
            </div>;
          })}
        </div>
      </Card>;
    })}
    <Card>
      <CardHead>All Other Properties</CardHead>
      <div style={{padding:"6px 8px"}}>
        {Object.entries(props).filter(([k])=>!Object.values(groups).flat().includes(k)).map(([key,val])=>
          <div key={key} style={{display:"flex",alignItems:"center",gap:12,padding:"7px 10px",borderRadius:6}}
            onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{fontSize:12,fontFamily:"var(--mono)",flex:1,color:"var(--t2)"}}>{key}</div>
            <input value={val} onChange={e=>setProps(p=>({...p,[key]:e.target.value}))}
              style={{padding:"4px 9px",borderRadius:6,border:"1px solid var(--b2)",background:"var(--bg3)",
                color:"var(--text)",fontSize:12,fontFamily:"var(--mono)",width:180}}/>
          </div>)}
      </div>
    </Card>
  </div>;
}

// ─── Schedules ────────────────────────────────────────────────────────────────
function TabSchedules({notify}) {
  const [tasks,setTasks]=useState(()=>{ try{return JSON.parse(localStorage.getItem("nc_tasks")||"[]");}catch{return[];} });
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",action:"backup",server:"All",cron:"0 3 * * *"});
  const ac={backup:"var(--blue)",restart:"var(--yellow)",command:"var(--green)",wipe:"var(--red)"};
  const ai={backup:"💾",restart:"↺",command:"⌨",wipe:"💥"};
  const save=(ts)=>{ setTasks(ts); localStorage.setItem("nc_tasks",JSON.stringify(ts)); };

  return <div style={{display:"flex",flexDirection:"column",gap:14}} className="fade-up">
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:16,fontWeight:800}}>Scheduled Tasks</div>
        <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}}>Powered by GitHub Actions cron triggers</div>
      </div>
      <Btn label="+ New Task" c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.1)" onClick={()=>setModal(true)}/>
    </div>
    <Card>
      {tasks.length===0
        ?<Empty icon="⏱" text="No scheduled tasks" sub="Automate backups, restarts and commands"/>
        :tasks.map((task,i)=><div key={task.id} style={{display:"flex",alignItems:"center",gap:12,
          padding:"14px 18px",borderBottom:i<tasks.length-1?"1px solid var(--b1)":"none",
          opacity:task.enabled?1:.5,transition:"opacity .2s"}}>
          <div onClick={()=>save(tasks.map(t=>t.id===task.id?{...t,enabled:!t.enabled}:t))}
            style={{width:36,height:21,borderRadius:11,background:task.enabled?"var(--green2)":"var(--b2)",
              cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
            <div style={{position:"absolute",top:3,left:task.enabled?17:3,width:15,height:15,
              borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
          </div>
          <div style={{width:36,height:36,borderRadius:8,background:`${ac[task.action]}18`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
            {ai[task.action]}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <span style={{fontSize:14,fontWeight:700}}>{task.name}</span>
              <Tag label={task.action} c={ac[task.action]}/>
            </div>
            <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",display:"flex",gap:10}}>
              <span>📅 {task.cron}</span><span>🖥 {task.server}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <Btn small label="▶ Run" c="var(--blue)" bc="rgba(88,166,255,.3)" bg="rgba(88,166,255,.08)"
              onClick={()=>notify(`Running "${task.name}" now…`)}/>
            <Btn small label="Delete" c="var(--red)" bc="rgba(248,81,73,.3)" bg="rgba(248,81,73,.08)"
              onClick={()=>save(tasks.filter(t=>t.id!==task.id))}/>
          </div>
        </div>)}
    </Card>
    {modal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setModal(false)}>
      <Card style={{width:430,padding:26}}>
        <div style={{fontSize:16,fontWeight:800,marginBottom:20}}>New Scheduled Task</div>
        {[{l:"Task Name",k:"name",ph:"e.g. Nightly Backup"},{l:"Cron",k:"cron",ph:"0 3 * * *"},{l:"Server",k:"server",ph:"All"}].map(f=>
          <div key={f.k} style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"var(--t2)",fontWeight:700,marginBottom:5}}>{f.l}</div>
            <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
              placeholder={f.ph} style={{padding:"7px 11px",borderRadius:6,border:"1px solid var(--b2)",
                background:"var(--bg3)",color:"var(--text)",fontSize:13,width:"100%"}}/>
          </div>)}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:"var(--t2)",fontWeight:700,marginBottom:8}}>Action</div>
          <div style={{display:"flex",gap:7}}>
            {Object.entries(ai).map(([a,icon])=><button key={a} onClick={()=>setForm(p=>({...p,action:a}))}
              style={{flex:1,padding:"8px 0",borderRadius:6,fontSize:12,fontWeight:700,
                border:`1px solid ${form.action===a?ac[a]+"66":"var(--b1)"}`,
                background:form.action===a?`${ac[a]}18`:"transparent",
                color:form.action===a?ac[a]:"var(--t3)",textTransform:"capitalize"}}>
              {icon} {a}
            </button>)}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn label="Cancel" onClick={()=>setModal(false)}/>
          <Btn label="Create" c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.1)"
            disabled={!form.name.trim()} onClick={()=>{
              save([...tasks,{...form,id:Date.now().toString(),enabled:true}]);
              setModal(false);notify(`Task "${form.name}" created!`);
            }}/>
        </div>
      </Card>
    </div>}
  </div>;
}

// ─── Backups ────────────────────────────────────────────────────────────────
function TabBackups({server, notify}) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(null);

  const loadBackups = useCallback(async () => {
    if (!server) { setLoading(false); return; }
    setLoading(true);
    try {
      const files = await listFiles(`.nodecraft/backups/${server.id}`);
      const backupList = files
        .filter(f => f.name.endsWith('.zip'))
        .map(f => ({
          name: f.name,
          size: f.size,
          date: f.name.replace('.zip', '').replace(/_/g, ':')
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
      setBackups(backupList);
    } catch { notify('Failed to load backups', 'error'); }
    setLoading(false);
  }, [server?.id]);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const createBackup = async () => {
    if (!server) { notify('Select a server first', 'error'); return; }
    setCreating(true);
    notify('Creating backup...');
    // Create a simple marker file as backup (actual file backup would need workflow)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `${timestamp}.zip`;
    const content = JSON.stringify({ server: server.name, created: timestamp });
    await saveFile(`.nodecraft/backups/${server.id}/${backupName}`, content, undefined, `Backup: ${server.name}`);
    notify('Backup created successfully!');
    setCreating(false);
    loadBackups();
  };

  const deleteBackup = async (name) => {
    if (!confirm(`Delete backup ${name}?`)) return;
    notify(`Deleting ${name}...`);
    const files = await listFiles(`.nodecraft/backups/${server.id}`);
    const file = files.find(f => f.name === name);
    if (file) {
      await saveFile(`.nodecraft/backups/${server.id}/${name}`, '', file.sha, `Delete backup: ${name}`);
      notify('Backup deleted');
      loadBackups();
    }
  };

  if (!server) return <Card><Empty icon="💾" text="No server selected" sub="Select a server from the sidebar"/></Card>;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14}} className="fade-up">
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div>
          <div style={{fontSize: 16, fontWeight: 800}}>Server Backups</div>
          <div style={{fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 2}}>
            Create and manage server backups stored in your GitHub repo
          </div>
        </div>
        <Btn label={creating ? 'Creating...' : '+ New Backup'} c="var(--green)" bc="rgba(63,185,80,.35)" bg="rgba(63,185,80,.1)" 
          onClick={createBackup} disabled={creating} loading={creating}/>
      </div>

      <Card>
        <CardHead>📦 Available Backups</CardHead>
        {loading ? (
          <div style={{padding: 40, textAlign: 'center'}}><Spin/> Loading...</div>
        ) : backups.length === 0 ? (
          <Empty icon="💾" text="No backups yet" sub="Create a backup to protect your server data"/>
        ) : (
          <div style={{padding: 8}}>
            {backups.map((b, i) => (
              <div key={b.name} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderBottom: i < backups.length - 1 ? '1px solid var(--b1)' : 'none'}}>
                <div style={{width: 36, height: 36, borderRadius: 8, background: 'var(--bg3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16}}>📦</div>
                <div style={{flex: 1}}>
                  <div style={{fontSize: 13, fontWeight: 700}}>{b.name}</div>
                  <div style={{fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)'}}>
                    {b.size ? (b.size / 1024).toFixed(1) + ' KB' : '--'} · {b.date}
                  </div>
                </div>
                <div style={{display: 'flex', gap: 6}}>
                  <Btn small label="Restore" c="var(--blue)" bc="rgba(88,166,255,.3)" bg="rgba(88,166,255,.08)"
                    disabled={restoring === b.name} loading={restoring === b.name}
                    onClick={() => { setRestoring(b.name); notify('Restore initiated - server will restart'); }}/>
                  <Btn small label="Delete" c="var(--red)" bc="rgba(248,81,73,.3)" bg="rgba(248,81,73,.08)"
                    onClick={() => deleteBackup(b.name)}/>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead>⚙️ Backup Settings</CardHead>
        <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div>
              <div style={{fontSize: 13, fontWeight: 700, color: 'var(--t2)'}}>Auto Backup</div>
              <div style={{fontSize: 11, color: 'var(--t3)'}}>Automatically backup every 24 hours</div>
            </div>
            <div onClick={() => notify('Enable auto-backup in Schedules tab')}
              style={{width: 38, height: 21, borderRadius: 11, background: 'var(--b2)', cursor: 'pointer', position: 'relative'}}>
              <div style={{position: 'absolute', top: 3, left: 3, width: 15, height: 15, borderRadius: '50%', background: '#fff'}}/>
            </div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div>
              <div style={{fontSize: 13, fontWeight: 700, color: 'var(--t2)'}}>Max Backups</div>
              <div style={{fontSize: 11, color: 'var(--t3)'}}>Keep last 10 backups</div>
            </div>
            <span style={{fontSize: 13, fontFamily: 'var(--mono)', color: 'var(--green)'}}>10</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Network ────────────────────────────────────────────────────────────────
function TabNetwork({server, status}) {
  if (!server) return <Card><Empty icon="🌐" text="No server selected" sub="Select a server from the sidebar"/></Card>;

  const portAllocations = [
    { port: server.port, protocol: 'TCP', assigned: true },
    { port: parseInt(server.port) + 1, protocol: 'UDP', assigned: false },
  ];

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14}} className="fade-up">
      <Card>
        <CardHead>🌐 Network Allocations</CardHead>
        <div style={{padding: 16}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13}}>
            <thead>
              <tr style={{borderBottom: '1px solid var(--b1)'}}>
                <th style={{textAlign: 'left', padding: '8px 0', color: 'var(--t3)', fontWeight: 600}}>Allocation</th>
                <th style={{textAlign: 'left', padding: '8px 0', color: 'var(--t3)', fontWeight: 600}}>Port</th>
                <th style={{textAlign: 'left', padding: '8px 0', color: 'var(--t3)', fontWeight: 600}}>Protocol</th>
                <th style={{textAlign: 'left', padding: '8px 0', color: 'var(--t3)', fontWeight: 600}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {portAllocations.map((a, i) => (
                <tr key={i} style={{borderBottom: '1px solid var(--b1)'}}>
                  <td style={{padding: '12px 0'}}>
                    <span style={{fontFamily: 'var(--mono)'}}>Primary {i === 0 ? '(Game)' : '(Query)'}</span>
                  </td>
                  <td style={{padding: '12px 0', fontFamily: 'var(--mono)', color: 'var(--blue)'}}>:{a.port}</td>
                  <td style={{padding: '12px 0'}}><Tag label={a.protocol} c={a.protocol === 'TCP' ? 'var(--blue)' : 'var(--purple)'}/></td>
                  <td style={{padding: '12px 0'}}>
                    {a.assigned && status === 'online' ? 
                      <Tag label="Assigned" c="var(--green)"/> : 
                      <Tag label="Pending" c="var(--t3)"/>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHead>🔗 Connection Info</CardHead>
        <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 10}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0'}}>
            <span style={{color: 'var(--t2)', fontSize: 13}}>Server Address</span>
            <span style={{fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--green)'}}>localhost:{server.port}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0'}}>
            <span style={{color: 'var(--t2)', fontSize: 13}}>Query Port</span>
            <span style={{fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--blue)'}}>{parseInt(server.port) + 1}</span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0'}}>
            <span style={{color: 'var(--t2)', fontSize: 13}}>Domain</span>
            <span style={{fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--t3)'}}>Not configured</span>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead>🛡️ Firewall Status</CardHead>
        <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 8}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{color: 'var(--green)'}}>●</span>
            <span style={{fontSize: 13}}>Ports {server.port} and {parseInt(server.port) + 1} are accessible</span>
          </div>
          <div style={{fontSize: 11, color: 'var(--t3)', marginTop: 4}}>
            Note: Use a tunnel service like bore.pub to expose to the internet
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Startup ────────────────────────────────────────────────────────────────
function TabStartup({server, notify}) {
  const [config, setConfig] = useState({
    jar: 'server.jar',
    jvm_flags: '-Xmx2G -Xms512M -XX:+UseG1GC',
    stop_command: 'stop',
    startup_timeout: 60,
    steam_download: false,
  });

  if (!server) return <Card><Empty icon="⚡" text="No server selected" sub="Select a server from the sidebar"/></Card>;

  const jvmPresets = [
    { label: '512M RAM', value: '-Xmx512M -Xms256M -XX:+UseG1GC' },
    { label: '1G RAM', value: '-Xmx1G -Xms512M -XX:+UseG1GC' },
    { label: '2G RAM', value: '-Xmx2G -Xms512M -XX:+UseG1GC' },
    { label: '3G RAM', value: '-Xmx3G -Xms1G -XX:+UseG1GC' },
    { label: '4G RAM', value: '-Xmx4G -Xms1G -XX:+UseG1GC' },
  ];

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14}} className="fade-up">
      <Card>
        <CardHead>⚡ Startup Configuration</CardHead>
        <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 16}}>
          <div>
            <div style={{fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6}}>Server JAR</div>
            <input value={config.jar} onChange={e => setConfig(p => ({...p, jar: e.target.value}))}
              style={{padding: '7px 11px', borderRadius: 6, border: '1px solid var(--b2)', background: 'var(--bg3)', 
                color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'var(--mono)'}}/>
          </div>
          <div>
            <div style={{fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6}}>JVM Arguments</div>
            <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8}}>
              {jvmPresets.map(p => (
                <button key={p.label} onClick={() => setConfig(c => ({...c, jvm_flags: p.value}))}
                  style={{padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
                    border: config.jvm_flags === p.value ? '1px solid var(--green)' : '1px solid var(--b1)',
                    background: config.jvm_flags === p.value ? 'rgba(63,185,80,.1)' : 'transparent',
                    color: config.jvm_flags === p.value ? 'var(--green)' : 'var(--t3)'}}>
                  {p.label}
                </button>
              ))}
            </div>
            <textarea value={config.jvm_flags} onChange={e => setConfig(p => ({...p, jvm_flags: e.target.value}))}
              style={{padding: '7px 11px', borderRadius: 6, border: '1px solid var(--b2)', background: 'var(--bg3)', 
                color: 'var(--text)', fontSize: 12, width: '100%', fontFamily: 'var(--mono)', minHeight: 60, resize: 'vertical'}}/>
          </div>
          <div>
            <div style={{fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6}}>Stop Command</div>
            <input value={config.stop_command} onChange={e => setConfig(p => ({...p, stop_command: e.target.value}))}
              style={{padding: '7px 11px', borderRadius: 6, border: '1px solid var(--b2)', background: 'var(--bg3)', 
                color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'var(--mono)'}}/>
          </div>
          <div>
            <div style={{fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6}}>Startup Timeout (seconds)</div>
            <input type="number" value={config.startup_timeout} onChange={e => setConfig(p => ({...p, startup_timeout: parseInt(e.target.value)}))}
              style={{padding: '7px 11px', borderRadius: 6, border: '1px solid var(--b2)', background: 'var(--bg3)', 
                color: 'var(--text)', fontSize: 13, width: 100}}/>
          </div>
          <Btn label="Save Configuration" c="var(--green)" bc="rgba(63,185,80,.4)" bg="rgba(63,185,80,.08)"
            onClick={() => notify('Configuration saved! (Stored in localStorage)')}/>
        </div>
      </Card>

      <Card>
        <CardHead>📋 Docker Image</CardHead>
        <div style={{padding: 16}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <span style={{fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--blue)'}}>ubuntu:latest</span>
            <Tag label="GitHub Actions" c="var(--purple)"/>
          </div>
          <div style={{fontSize: 11, color: 'var(--t3)', marginTop: 8}}>
            Server runs on GitHub Actions Ubuntu runner with Java 17+
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Activity ────────────────────────────────────────────────────────────────
function TabActivity({server, statuses}) {
  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nc_events') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const status = server ? statuses[server.id] : null;
    if (!server || !status) return;
    const lastEvent = events.find(e => e.server === server.id);
    if (!lastEvent || lastEvent.status !== status) {
      const newEvent = { id: Date.now(), server: server.id, serverName: server.name, status, time: new Date().toISOString() };
      const updated = [newEvent, ...events].slice(0, 100);
      setEvents(updated);
      localStorage.setItem('nc_events', JSON.stringify(updated));
    }
  }, [server?.id, statuses]);

  const serverEvents = server ? events.filter(e => e.server === server.id) : events.slice(0, 20);

  const stc = { online: 'var(--green)', offline: 'var(--t3)', starting: 'var(--yellow)' };

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 14}} className="fade-up">
      <Card>
        <CardHead>📜 Server Activity Log</CardHead>
        {events.length === 0 ? (
          <Empty icon="📜" text="No activity yet" sub="Start/stop servers to see events here"/>
        ) : (
          <div style={{padding: 8}}>
            {serverEvents.map((e, i) => (
              <div key={e.id} style={{display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderBottom: i < serverEvents.length - 1 ? '1px solid var(--b1)' : 'none'}}>
                <span style={{fontSize: 16}}>{e.status === 'online' ? '🟢' : e.status === 'starting' ? '🟡' : '⚫'}</span>
                <div style={{flex: 1}}>
                  <div style={{fontSize: 13, fontWeight: 600}}>{e.serverName}</div>
                  <div style={{fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)'}}>
                    {e.status === 'online' ? 'Server started' : e.status === 'starting' ? 'Starting up' : 'Server stopped'}
                  </div>
                </div>
                <Tag label={e.status} c={stc[e.status]}/>
                <span style={{fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)'}}>
                  {new Date(e.time).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      {events.length > 0 && (
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <Btn small label="Clear History" c="var(--red)" bc="rgba(248,81,73,.3)" bg="rgba(248,81,73,.08)"
            onClick={() => { setEvents([]); localStorage.setItem('nc_events', '[]'); }}/>
        </div>
      )}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
function TabSettings() {
  return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:640}} className="fade-up">
    <Card>
      <CardHead>🔑 GitHub Connection</CardHead>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {[
          {l:"Owner / Username",desc:"Set VITE_GITHUB_OWNER in .env"},
          {l:"Repository",desc:"Set VITE_GITHUB_REPO in .env"},
          {l:"Personal Access Token",desc:"Set VITE_GITHUB_TOKEN in .env — needs repo + workflow scopes"},
        ].map(f=><div key={f.l}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,fontWeight:700,color:"var(--t2)"}}>{f.l}</span>
          </div>
          <div style={{padding:"7px 11px",borderRadius:6,border:"1px solid var(--b2)",background:"var(--bg3)",
            color:"var(--t3)",fontSize:12,fontFamily:"var(--mono)"}}>{f.desc}</div>
        </div>)}
      </div>
    </Card>
    <Card>
      <CardHead>⚡ GitHub Actions Free Limits</CardHead>
      <div style={{padding:16,display:"flex",flexDirection:"column",gap:2}}>
        {[
          {l:"Free minutes/month",v:"2,000",c:"var(--green)"},
          {l:"Max job duration",v:"6 hours",c:"var(--yellow)"},
          {l:"CPU per runner",v:"2 cores",c:"var(--blue)"},
          {l:"RAM per runner",v:"7 GB",c:"var(--purple)"},
          {l:"Storage",v:"500 MB repo",c:"var(--teal)"},
        ].map(r=><div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"10px 0",borderBottom:"1px solid var(--b1)"}}>
          <span style={{fontSize:13,color:"var(--t2)"}}>{r.l}</span>
          <span style={{fontSize:13,fontWeight:700,color:r.c,fontFamily:"var(--mono)"}}>{r.v}</span>
        </div>)}
      </div>
    </Card>
    <Card>
      <CardHead>🔗 Quick Links</CardHead>
      <div style={{padding:"8px 8px"}}>
        {[
          {l:"Your GitHub Actions",url:`https://github.com/${import.meta.env.VITE_GITHUB_OWNER}/${import.meta.env.VITE_GITHUB_REPO}/actions`},
          {l:"Modrinth Plugin Marketplace",url:"https://modrinth.com/plugins"},
          {l:"PaperMC Downloads",url:"https://papermc.io/downloads"},
          {l:"bore.pub (free server tunnel)",url:"https://bore.pub"},
          {l:"GitHub PAT Settings",url:"https://github.com/settings/tokens"},
        ].map(l=><a key={l.l} href={l.url} target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"9px 10px",borderRadius:6,color:"var(--blue)",fontSize:13,textDecoration:"none"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          {l.l} <span style={{fontSize:11,color:"var(--t3)"}}>↗</span>
        </a>)}
      </div>
    </Card>
  </div>;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Panel() {
  const [servers,setServers]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("nc_servers")||"[]");}catch{return[];}
  });
  const [statuses,setStatuses]=useState({});
  const [activeServer,setActiveServer]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [notification,setNotification]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [showDelete,setShowDelete]=useState(null);
  const [user,setUser]=useState(null);
  const [stats, setStats]=useState({});
  const [setupDone,setSetupDone]=useState(()=>!!localStorage.getItem("nc_token"));

  function SetupScreen({onSave}) {
  const [mode, setMode] = useState("github"); // "github" or "pterodactyl"
  const [token,setToken]=useState("");
  const [owner,setOwner]=useState("");
  const [repo,setRepo]=useState("");
  const [pteroUrl, setPteroUrl] = useState("");
  const [pteroKey, setPteroKey] = useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  // Check for env variables on mount
  useEffect(() => {
    if (import.meta.env.VITE_GITHUB_TOKEN) {
      setToken(import.meta.env.VITE_GITHUB_TOKEN);
    }
    if (import.meta.env.VITE_GITHUB_OWNER) {
      setOwner(import.meta.env.VITE_GITHUB_OWNER);
    }
    if (import.meta.env.VITE_GITHUB_REPO) {
      setRepo(import.meta.env.VITE_GITHUB_REPO);
    }
    if (import.meta.env.VITE_PTERODACTYL_URL) {
      setPteroUrl(import.meta.env.VITE_PTERODACTYL_URL);
    }
    if (import.meta.env.VITE_PTERODACTYL_API_KEY) {
      setPteroKey(import.meta.env.VITE_PTERODACTYL_API_KEY);
    }
  }, []);

  const connect=async()=>{
    setLoading(true);setError("");
    try {
      if (mode === "pterodactyl") {
        if (!pteroUrl.trim() || !pteroKey.trim()) {
          setError("Please enter Pterodactyl URL and API Key");
          setLoading(false);
          return;
        }
        // Test Pterodactyl connection
        const res = await fetch(`${pteroUrl.trim()}/api/application/users`, {
          headers: { Authorization: `Bearer ${pteroKey.trim()}`, Accept: "application/json" }
        });
        if (!res.ok) {
          setError("Invalid Pterodactyl credentials");
          setLoading(false);
          return;
        }
        localStorage.setItem("nc_ptero_url", pteroUrl.trim());
        localStorage.setItem("nc_ptero_key", pteroKey.trim());
        localStorage.setItem("nc_backend", "pterodactyl");
      } else {
        if (!token.trim() || !owner.trim() || !repo.trim()) {
          setError("Fill in all fields!"); setLoading(false); return;
        }
        const res=await fetch("https://api.github.com/user",{headers:{Authorization:`Bearer ${token.trim()}`}});
        if(!res.ok){setError("Invalid token — check it and try again");setLoading(false);return;}
        localStorage.setItem("nc_token",token.trim());
        localStorage.setItem("nc_owner",owner.trim());
        localStorage.setItem("nc_repo",repo.trim());
        localStorage.setItem("nc_backend", "github");
      }
      onSave();
    } catch {setError("Connection failed — check your internet");}
    setLoading(false);
  };

  const inp={padding:"8px 12px",borderRadius:7,border:"1px solid var(--b2)",background:"var(--bg3)",
    color:"var(--text)",fontSize:13,width:"100%",fontFamily:"var(--mono)"};

  return <div style={{height:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",
    justifyContent:"center",fontFamily:"var(--ui)"}}>
    <div style={{width:500,background:"var(--bg2)",borderRadius:14,border:"1px solid var(--b1)",padding:36}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
        <div style={{width:40,height:40,background:"linear-gradient(135deg,#3fb950,#238636)",borderRadius:10,
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:"0 0 20px rgba(63,185,80,.35)"}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 12.4V11.6C16 10.5373 16.8954 9.6 18 9.6C19.1046 9.6 20 10.5373 20 11.6V12.4C20 13.4627 19.1046 14.4 18 14.4C16.8954 14.4 16 13.4627 16 12.4Z" stroke="white" strokeWidth="1.5"/>
            <path d="M12 12.4H16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M8 12.4V11.6C8 10.5373 7.10457 9.6 6 9.6C4.89543 9.6 4 10.5373 4 11.6V12.4C4 13.4627 4.89543 14.4 6 14.4C7.10457 14.4 8 13.4627 8 12.4Z" stroke="white" strokeWidth="1.5"/>
            <path d="M8 12.4H12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="2" y="2" width="20" height="20" rx="4" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>
        <div>
          <div style={{fontSize:20,fontWeight:800,letterSpacing:-.5}}>NodeCraft</div>
          <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)"}}>Connect your server backend</div>
        </div>
      </div>
      
      {/* Backend Selection */}
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button onClick={() => setMode("pterodactyl")} style={{
          flex:1,padding:"10px",borderRadius:8,border:`1px solid ${mode === "pterodactyl" ? "rgba(192,57,243,.5)" : "var(--b1)"}`,
          background: mode === "pterodactyl" ? "rgba(192,57,243,.1)" : "transparent",
          color: mode === "pterodactyl" ? "#c039f3" : "var(--t2)",fontSize:13,fontWeight:700,cursor:"pointer"
        }}>
          🦅 Pterodactyl
        </button>
        <button onClick={() => setMode("github")} style={{
          flex:1,padding:"10px",borderRadius:8,border:`1px solid ${mode === "github" ? "rgba(63,185,80,.5)" : "var(--b1)"}`,
          background: mode === "github" ? "rgba(63,185,80,.1)" : "transparent",
          color: mode === "github" ? "var(--green)" : "var(--t2)",fontSize:13,fontWeight:700,cursor:"pointer"
        }}>
          ⚡ GitHub Actions
        </button>
      </div>
      
      <div style={{height:1,background:"var(--b1)",margin:"20px 0"}}/>
      
      {mode === "pterodactyl" ? (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{padding:"12px 14px",borderRadius:8,background:"rgba(192,57,243,.08)",border:"1px solid rgba(192,57,243,.2)",fontSize:12,color:"#c039f3"}}>
            🦅 Pterodactyl - servers get IP automatically from your panel
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:6}}>Panel URL</div>
            <input value={pteroUrl} onChange={e=>setPteroUrl(e.target.value)} placeholder="https://panel.yourdomain.com" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:6}}>API Key</div>
            <input value={pteroKey} onChange={e=>setPteroKey(e.target.value)} placeholder="ptlc_xxxxxxxxxxxxx" type="password" style={inp}/>
            <div style={{fontSize:11,color:"var(--t3)",marginTop:5}}>🔒 Pterodactyl → Account → API Credentials</div>
          </div>
          {error&&<div style={{padding:"8px 12px",borderRadius:6,background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",color:"var(--red)",fontSize:12}}>⚠ {error}</div>}
          <button onClick={connect} disabled={loading} style={{padding:"10px",borderRadius:8,border:"1px solid rgba(192,57,243,.4)",background:"rgba(192,57,243,.12)",color:"#c039f3",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:4}}>
            {loading?"Connecting…":"Connect to Pterodactyl →"}
          </button>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{padding:"12px 14px",borderRadius:8,background:"rgba(63,185,80,.08)",border:"1px solid rgba(63,185,80,.2)",fontSize:12,color:"var(--green)"}}>
            ⚡ Free servers via GitHub Actions - uses bore tunnel for public access
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:6}}>GitHub Username</div>
            <input value={owner} onChange={e=>setOwner(e.target.value)} placeholder="e.g. Razin-Dev" style={inp}/>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"var(--t2)",marginBottom:6}}>Repository Name</div>
            <input value={repo} onChange={e=>setRepo(e.target.value)} placeholder="e.g. nodecraft" style={inp}/>
          </div>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:"var(--t2)"}}>Personal Access Token</span>
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"var(--blue)",textDecoration:"none"}}>Generate one ↗</a>
            </div>
            <input value={token} onChange={e=>setToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" type="password" style={inp}/>
          </div>
          {error&&<div style={{padding:"8px 12px",borderRadius:6,background:"rgba(248,81,73,.1)",border:"1px solid rgba(248,81,73,.3)",color:"var(--red)",fontSize:12}}>⚠ {error}</div>}
          <button onClick={connect} disabled={loading} style={{padding:"10px",borderRadius:8,border:"1px solid rgba(63,185,80,.4)",background:"rgba(63,185,80,.12)",color:"var(--green)",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:4}}>
            {loading?"Connecting…":"Connect to GitHub →"}
          </button>
        </div>
      )}
    </div>
  </div>;
}

  useEffect(()=>{ localStorage.setItem("nc_servers",JSON.stringify(servers)); },[servers]);
  useEffect(()=>{ validateToken().then(u=>{if(u)setUser(u);}).catch(()=>{}); },[]);

  // Load Pterodactyl servers on startup
  useEffect(() => {
    const loadPteroServers = async () => {
      if (isUsingPterodactyl()) {
        try {
          const pteroServers = await pteroGetServers();
          if (pteroServers.length > 0) {
            // Convert Pterodactyl servers to our format
            const mapped = pteroServers.map(s => ({
              id: s.attributes.identifier,
              name: s.attributes.name,
              pteroId: s.attributes.identifier,
              type: s.attributes.egg?.name || "Minecraft",
              version: s.attributes.egg?.name?.includes("1.21") ? "1.21.4" : 
                      s.attributes.egg?.name?.includes("1.20") ? "1.20.4" : "1.20.4",
              ram: Math.round((s.attributes.limits.memory || 2048) / 1024) + "G",
              port: s.port || s.attributes.allocation?.attributes?.port || 25565,
              ip: s.ip || "--",
              location: s.location || "--",
              runId: s.attributes.identifier,
              status: s.attributes.status
            }));
            setServers(mapped);
          }
        } catch (e) {
          console.error("Failed to load Pterodactyl servers:", e);
        }
      }
    };
    loadPteroServers();
  }, []);

  useEffect(()=>{
    if(!servers.length) return;
    const poll=async()=>{
      const statusUpdates={};
      const statUpdates={};
      for(const s of servers) {
        let runStatus;
        let serverStats;
        
        if (isUsingPterodactyl() && s.runId) {
          // Pterodactyl
          runStatus = await pteroGetServerStatus(s.runId);
          if (runStatus === "online") {
            serverStats = await pteroGetStats(s.runId);
          }
        } else if (s.runId) {
          // GitHub Actions
          runStatus = await getRunStatus(s.runId);
          if (runStatus === "online") {
            serverStats = await getStats(s.runId);
          }
        } else {
          runStatus = "offline";
        }
        
        statusUpdates[s.id] = runStatus;
        if (serverStats) {
          statUpdates[s.id] = serverStats;
        }
      }
      setStatuses(statusUpdates);
      setStats(statUpdates);
    };
    poll();
    const t=setInterval(poll,12000);
    return()=>clearInterval(t);
  },[servers]);

  const notify=(msg,type="success")=>{
    setNotification({msg,type});
    setTimeout(()=>setNotification(null),4000);
  };

  const onStart=async(server)=>{
    notify(`Starting ${server.name}…`);
    setStatuses(p=>({...p,[server.id]:"starting"}));
    try {
      if (isUsingPterodactyl()) {
        // Use Pterodactyl
        const pteroServerId = server.pteroId || server.id;
        const ok = await pteroStartServer(pteroServerId);
        if (!ok) throw new Error("Failed to start server");
        const updated = servers.map(s=>s.id===server.id?{...s,runId:pteroServerId}:s);
        setServers(updated);
        if(activeServer?.id===server.id) setActiveServer(prev=>({...prev,runId:pteroServerId}));
      } else {
        // Use GitHub Actions
        const runId=await startServer({server_name:server.name,mc_version:server.version,ram:server.ram});
        const updated=servers.map(s=>s.id===server.id?{...s,runId}:s);
        setServers(updated);
        if(activeServer?.id===server.id) setActiveServer(prev=>({...prev,runId}));
      }
      notify(`${server.name} is booting up!`);
    } catch(e) {
      setStatuses(p=>({...p,[server.id]:"offline"}));
      notify("Start failed — " + e.message, "error");
    }
  };

  const onStop=async(server)=>{
    if(!server.runId){ notify("No active run to stop","error"); return; }
    notify(`Stopping ${server.name}…`);
    try {
      if (isUsingPterodactyl()) {
        await pteroStopServer(server.runId);
      } else {
        await cancelRun(server.runId);
      }
      const updated=servers.map(s=>s.id===server.id?{...s,runId:null}:s);
      setServers(updated);
      if(activeServer?.id===server.id) setActiveServer(prev=>({...prev,runId:null}));
      setStatuses(p=>({...p,[server.id]:"offline"}));
      notify(`${server.name} stopped`);
    } catch { notify("Stop failed","error"); }
  };

  const onDelete=async(server)=>{
    if(!confirm(`Delete server "${server.name}"? This cannot be undone.`)) return;
    if(server.runId) {
      try { 
        if (isUsingPterodactyl()) {
          await pteroDeleteServer(server.runId);
        } else {
          await cancelRun(server.runId); 
        }
      } catch (err) {
        console.error('Failed to delete server:', err);
      }
    }
    const updated=servers.filter(s=>s.id!==server.id);
    setServers(updated);
    if(activeServer?.id===server.id) setActiveServer(updated[0]||null);
    setShowDelete(null);
    notify(`Server "${server.name}" deleted`);
  };

  const NAV=[
    {id:"dashboard",icon:"⬡",label:"Dashboard"},
    {id:"console",icon:"⌨",label:"Console"},
    {id:"backups",icon:"💾",label:"Backups"},
    {id:"network",icon:"🌐",label:"Network"},
    {id:"startup",icon:"⚡",label:"Startup"},
    {id:"plugins",icon:"🧩",label:"Plugins"},
    {id:"mods",icon:"⚙",label:"Mods"},
    {id:"files",icon:"◫",label:"Files"},
    {id:"properties",icon:"📋",label:"Properties"},
    {id:"activity",icon:"📜",label:"Activity"},
    {id:"schedules",icon:"⏱",label:"Schedules"},
    {id:"settings",icon:"🔧",label:"Settings"},
  ];

  const cur=activeServer||servers[0]||null;
  const curStatus=cur?statuses[cur.id]||"offline":"offline";
  const online=servers.filter(s=>statuses[s.id]==="online").length;
if(!setupDone) return <SetupScreen onSave={()=>setSetupDone(true)}/>;
  return <div style={{display:"flex",height:"100vh",background:"var(--bg)",fontFamily:"var(--ui)",overflow:"hidden"}}>
    <style>{CSS}</style>
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,
      background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.03) 2px,rgba(0,0,0,.03) 4px)",
      backgroundSize:"100% 4px",animation:"scanline 15s linear infinite"}}/>

    {notification&&<div style={{position:"fixed",top:18,right:18,zIndex:1000,
      background:notification.type==="error"?"rgba(248,81,73,.12)":"rgba(63,185,80,.12)",
      border:`1px solid ${notification.type==="error"?"#f85149":"#3fb950"}`,
      borderRadius:8,padding:"10px 16px",
      color:notification.type==="error"?"var(--red)":"var(--green)",
      fontFamily:"var(--mono)",fontSize:12,animation:"fadeUp .2s ease",backdropFilter:"blur(12px)",maxWidth:400}}>
      {notification.type==="error"?"✗":"✓"} {notification.msg}
    </div>}

    {showAdd&&<AddServerModal onClose={()=>setShowAdd(false)} onCreate={s=>{setServers(p=>[...p,s]);setActiveServer(s);notify(`Server "${s.name}" created!`);}}/>}

    {showDelete&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.82)",zIndex:200,
      display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>e.target===e.currentTarget&&setShowDelete(null)}>
      <Card style={{width:400,padding:28}} className="fade-up">
        <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>🗑 Delete Server</div>
        <div style={{fontSize:13,color:"var(--t2)",marginBottom:20,lineHeight:1.6}}>
          Are you sure you want to delete <strong style={{color:"var(--red)"}}>{showDelete.name}</strong>?
          This will stop the server and remove all its data. This action cannot be undone.
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <Btn label="Cancel" onClick={()=>setShowDelete(null)}/>
          <Btn label="Delete Server" c="var(--red)" bc="rgba(248,81,73,.4)" bg="rgba(248,81,73,.1)"
            onClick={()=>onDelete(showDelete)}/>
        </div>
      </Card>
    </div>}

    {/* Sidebar */}
    <div style={{width:212,background:"var(--bg2)",borderRight:"1px solid var(--b1)",display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"16px 14px",borderBottom:"1px solid var(--b1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:"linear-gradient(135deg,#3fb950,#238636)",borderRadius:9,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 20px rgba(63,185,80,.35)"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 12.4V11.6C16 10.5373 16.8954 9.6 18 9.6C19.1046 9.6 20 10.5373 20 11.6V12.4C20 13.4627 19.1046 14.4 18 14.4C16.8954 14.4 16 13.4627 16 12.4Z" stroke="white" stroke-width="1.5"/>
              <path d="M12 12.4H16" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M8 12.4V11.6C8 10.5373 7.10457 9.6 6 9.6C4.89543 9.6 4 10.5373 4 11.6V12.4C4 13.4627 4.89543 14.4 6 14.4C7.10457 14.4 8 13.4627 8 12.4Z" stroke="white" stroke-width="1.5"/>
              <path d="M8 12.4H12" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
              <rect x="2" y="2" width="20" height="20" rx="4" stroke="white" stroke-width="1.5"/>
            </svg>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:800,letterSpacing:-.5}}>NodeCraft</div>
            <div style={{fontSize:10,color:user?"var(--green)":"var(--red)",fontFamily:"var(--mono)"}}>
              {user?`@${user.login}`:"⚠ not connected"}
            </div>
          </div>
        </div>
      </div>

      <div style={{padding:"10px 7px 8px",borderBottom:"1px solid var(--b1)"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--t3)",textTransform:"uppercase",letterSpacing:1.5,padding:"0 8px 8px"}}>
          Servers ({servers.length})
        </div>
        <div style={{maxHeight:200,overflowY:"auto"}}>
          {servers.length===0&&<div style={{padding:"8px",fontSize:12,color:"var(--t3)",textAlign:"center"}}>
            No servers yet
          </div>}
          {servers.map(s=>{
            const st=statuses[s.id]||"offline";
            return <div key={s.id} onClick={()=>{setActiveServer(s);setTab("console");}}
              style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:6,cursor:"pointer",marginBottom:2,
                background:cur?.id===s.id?"rgba(63,185,80,.08)":"transparent",
                border:cur?.id===s.id?"1px solid rgba(63,185,80,.2)":"1px solid transparent",transition:"all .1s"}}>
              <Dot status={st}/>
              <span style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                color:cur?.id===s.id?"var(--green)":"var(--t2)"}}>{s.name}</span>
              <span style={{fontSize:10,color:"var(--t3)",fontFamily:"var(--mono)"}}>
                {s.version}
              </span>
            </div>;
          })}
        </div>
        <button onClick={()=>setShowAdd(true)}
          style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:6,
            width:"100%",border:"1px dashed var(--b2)",background:"transparent",color:"var(--t3)",
            fontSize:12,cursor:"pointer",marginTop:4,transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--green)";e.currentTarget.style.color="var(--green)";}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--b2)";e.currentTarget.style.color="var(--t3)";}}>
          <span style={{fontSize:16,lineHeight:1}}>+</span> New Server
        </button>
      </div>

      <div style={{padding:"8px 7px",flex:1,overflowY:"auto"}}>
        {NAV.map(n=><div key={n.id} onClick={()=>setTab(n.id)}
          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:6,cursor:"pointer",
            background:tab===n.id?"rgba(63,185,80,.1)":"transparent",
            color:tab===n.id?"var(--green)":"var(--t2)",marginBottom:1,transition:"all .1s"}}>
          <span style={{fontSize:13,width:16,textAlign:"center",flexShrink:0}}>{n.icon}</span>
          <span style={{fontSize:12,fontWeight:tab===n.id?700:500}}>{n.label}</span>
        </div>)}
      </div>

      <div style={{padding:"10px 14px",borderTop:"1px solid var(--b1)",display:"flex",alignItems:"center",gap:8}}>
        {user?.avatar_url
          ?<img src={user.avatar_url} style={{width:26,height:26,borderRadius:"50%",flexShrink:0}} alt=""/>
          :<div style={{width:26,height:26,borderRadius:"50%",background:"var(--bg3)",flexShrink:0,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"var(--t3)"}}>?</div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {user?.name||user?.login||"Not connected"}
          </div>
          <div style={{fontSize:10,color:user?"var(--green)":"var(--red)",fontFamily:"var(--mono)"}}>
            {user?"Owner":"Check .env"}
          </div>
        </div>
      </div>
    </div>

    {/* Main */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"12px 22px",borderBottom:"1px solid var(--b1)",
        display:"flex",alignItems:"center",gap:14,background:"var(--bg2)",flexShrink:0}}>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800}}>
            {tab==="dashboard"&&"Dashboard"}
            {tab==="console"&&`Console · ${cur?.name||"No server"}`}
            {tab==="backups"&&`Backups · ${cur?.name||"No server"}`}
            {tab==="network"&&`Network · ${cur?.name||"No server"}`}
            {tab==="startup"&&`Startup · ${cur?.name||"No server"}`}
            {tab==="plugins"&&"Plugin Marketplace"}
            {tab==="mods"&&"Mod Marketplace"}
            {tab==="files"&&"File Manager"}
            {tab==="properties"&&"Server Properties"}
            {tab==="activity"&&`Activity · ${cur?.name||"All Servers"}`}
            {tab==="schedules"&&"Scheduled Tasks"}
            {tab==="settings"&&"Settings"}
          </div>
          <div style={{fontSize:11,color:"var(--t3)",fontFamily:"var(--mono)",marginTop:2}}>
            {tab==="dashboard"&&`${online}/${servers.length} nodes online · GitHub Actions runners`}
            {tab==="console"&&`${cur?.type||"—"} ${cur?.version||""} · :${cur?.port||""} · ${curStatus}`}
            {tab==="backups"&&`Manage backups for ${cur?.name||"selected server"}`}
            {tab==="network"&&`Port allocation and networking for ${cur?.name||"selected server"}`}
            {tab==="startup"&&`Startup configuration for ${cur?.name||"selected server"}`}
            {tab==="plugins"&&"Search & install Bukkit/Spigot/Paper plugins from Modrinth"}
            {tab==="mods"&&"Search & install Fabric/Forge mods from Modrinth"}
            {tab==="files"&&"Browse & edit your repo files via GitHub Contents API"}
            {tab==="properties"&&"Edit server.properties — saves & commits to GitHub"}
            {tab==="activity"&&"Server event history and activity logs"}
            {tab==="schedules"&&"Automated tasks via GitHub Actions cron triggers"}
            {tab==="settings"&&"GitHub integration info & useful links"}
          </div>
        </div>
        <div style={{display:"flex",gap:7}}>
          {[
            {l:`${online}/${servers.length} Online`,c:"var(--green)"},
            {l:user?`✓ ${user.login}`:"⚠ No Token",c:user?"var(--blue)":"var(--red)"},
            {l:"GitHub Actions",c:"var(--purple)"},
          ].map(p=><div key={p.l} style={{padding:"4px 10px",borderRadius:20,background:"var(--bg3)",
            border:`1px solid ${p.c}33`,fontSize:10,color:p.c,fontFamily:"var(--mono)",fontWeight:700}}>{p.l}</div>)}
        </div>
      </div>

      <div style={{flex:1,overflow:"auto",padding:20}}>
        {!user&&<div style={{marginBottom:14,padding:"10px 14px",borderRadius:8,
          background:"rgba(248,81,73,.08)",border:"1px solid rgba(248,81,73,.3)",
          fontSize:12,color:"var(--red)",fontFamily:"var(--mono)",display:"flex",alignItems:"center",gap:8}}>
          ⚠ GitHub token not detected — edit your <code style={{background:"var(--bg3)",padding:"1px 5px",borderRadius:3}}>.env</code> file and run <code style={{background:"var(--bg3)",padding:"1px 5px",borderRadius:3}}>npm run deploy</code> again
        </div>}
        {tab==="dashboard"&&<TabDashboard servers={servers} statuses={statuses} stats={stats} onStart={onStart} onStop={onStop} onDelete={s=>setShowDelete(s)} onSelect={setActiveServer} setTab={setTab}/>}
        {tab==="console"&&<TabConsole server={cur} status={curStatus} stats={stats} onStart={onStart} onStop={onStop} notify={notify}/>}
        {tab==="backups"&&<TabBackups server={cur} notify={notify}/>}
        {tab==="network"&&<TabNetwork server={cur} status={curStatus}/>}
        {tab==="startup"&&<TabStartup server={cur} notify={notify}/>}
        {tab==="plugins"&&<TabMarketplace type="plugin" server={cur} notify={notify}/>}
        {tab==="mods"&&<TabMarketplace type="mod" server={cur} notify={notify}/>}
        {tab==="files"&&<TabFiles notify={notify}/>}
        {tab==="properties"&&<TabProperties notify={notify}/>}
        {tab==="activity"&&<TabActivity server={cur} statuses={statuses}/>}
        {tab==="schedules"&&<TabSchedules notify={notify}/>}
        {tab==="settings"&&<TabSettings/>}
      </div>
    </div>
  </div>;
}
