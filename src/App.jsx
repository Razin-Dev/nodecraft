import { useState, useEffect, useRef } from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { triggerWorkflow, getServerStatus, cancelRun, getRunJobs, getJobLogs } from './api.js';
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Syne:wght@400;500;600;700;800&display=swap');`;

const CSS = `
${FONTS}
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#080b0f;--bg2:#0d1117;--bg3:#161b22;
  --border:#21262d;--border2:#30363d;
  --green:#39d353;--green2:#26a641;
  --red:#f85149;--yellow:#d29922;--blue:#58a6ff;--purple:#bc8cff;
  --text:#e6edf3;--text2:#8b949e;--text3:#484f58;
  --font-ui:'Syne',sans-serif;--font-mono:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font-ui);overflow:hidden;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes slideIn{from{transform:translateY(-6px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
input:focus,select:focus{outline:none;}
`;

const SERVERS = [
  {id:1,name:"SkyWars-1",type:"Paper",version:"1.20.4",status:"online",players:12,maxPlayers:20,ram:62,cpu:34,port:25565,uptime:"4h 22m",tps:19.8},
  {id:2,name:"Survival-Hub",type:"Spigot",version:"1.20.1",status:"online",players:5,maxPlayers:50,ram:45,cpu:18,port:25566,uptime:"1d 6h",tps:20.0},
  {id:3,name:"Creative-Build",type:"Vanilla",version:"1.21",status:"offline",players:0,maxPlayers:30,ram:0,cpu:0,port:25567,uptime:"—",tps:0},
  {id:4,name:"BedWars-Node",type:"Paper",version:"1.20.4",status:"starting",players:0,maxPlayers:16,ram:20,cpu:8,port:25568,uptime:"0m 12s",tps:18.2},
];

const PLUGINS = [
  {id:1,name:"EssentialsX",version:"2.21.0",category:"Core",desc:"Homes, warps, economy, chat — the essential suite.",installed:true,size:"2.1MB",rating:4.9,downloads:"12M"},
  {id:2,name:"WorldGuard",version:"7.0.11",category:"Protection",desc:"Region-based permissions and world protection.",installed:true,size:"1.2MB",rating:4.8,downloads:"9M"},
  {id:3,name:"LuckPerms",version:"5.4.141",category:"Permissions",desc:"Powerful permission management for Bukkit/Spigot.",installed:true,size:"3.4MB",rating:4.9,downloads:"8M"},
  {id:4,name:"Vault",version:"1.7.3",category:"Core",desc:"Permission, chat & economy bridge for plugins.",installed:false,size:"0.3MB",rating:4.7,downloads:"11M"},
  {id:5,name:"WorldEdit",version:"7.3.4",category:"Building",desc:"In-game map editor with brush tools and clipboard.",installed:false,size:"5.6MB",rating:4.8,downloads:"7M"},
  {id:6,name:"AntiCheat+",version:"4.1.0",category:"Security",desc:"Advanced detection for KillAura, fly hacks, and more.",installed:false,size:"1.8MB",rating:4.3,downloads:"2M"},
  {id:7,name:"PlaceholderAPI",version:"2.11.6",category:"Core",desc:"Custom placeholders shared across all plugins.",installed:false,size:"0.8MB",rating:4.9,downloads:"10M"},
  {id:8,name:"CoreProtect",version:"22.4",category:"Logging",desc:"Fast block logging and rollback — every action tracked.",installed:true,size:"2.2MB",rating:4.8,downloads:"5M"},
];

const SCHEDULES = [
  {id:1,name:"Nightly Backup",cron:"0 3 * * *",next:"03:00",action:"backup",server:"All Servers",enabled:true,lastRun:"Success · 2h ago"},
  {id:2,name:"Auto-Restart SkyWars",cron:"0 */6 * * *",next:"06:00",action:"restart",server:"SkyWars-1",enabled:true,lastRun:"Success · 4h ago"},
  {id:3,name:"RAM Flush",cron:"*/30 * * * *",next:"30m",action:"command",server:"Survival-Hub",enabled:true,lastRun:"Success · 28m ago"},
  {id:4,name:"Weekly Wipe",cron:"0 0 * * 0",next:"Sun 00:00",action:"wipe",server:"BedWars-Node",enabled:false,lastRun:"Skipped"},
];

const PROPERTIES = {
  "Server": {
    "server-name": {val:"NodeCraft SkyWars",type:"text",desc:"Server display name"},
    "motd": {val:"§aNodeCraft §7| §bSkyWars",type:"text",desc:"Message of the day"},
    "max-players": {val:"20",type:"number",desc:"Maximum players allowed"},
    "online-mode": {val:true,type:"toggle",desc:"Enable Mojang authentication"},
    "white-list": {val:false,type:"toggle",desc:"Restrict to whitelisted players"},
  },
  "Gameplay": {
    "difficulty": {val:"hard",type:"select",opts:["peaceful","easy","normal","hard"],desc:"World difficulty"},
    "gamemode": {val:"survival",type:"select",opts:["survival","creative","adventure","spectator"],desc:"Default gamemode"},
    "pvp": {val:true,type:"toggle",desc:"Allow player vs player combat"},
    "view-distance": {val:"10",type:"number",desc:"Chunk view distance (chunks)"},
    "simulation-distance": {val:"8",type:"number",desc:"Entity simulation range"},
  },
  "Performance": {
    "max-tick-time": {val:"60000",type:"number",desc:"Max ms per tick before watchdog crash"},
    "use-native-transport": {val:true,type:"toggle",desc:"Use optimized Netty transport"},
    "network-compression-threshold": {val:"256",type:"number",desc:"Packet compression threshold (bytes)"},
  },
};

const CONSOLE_LOGS = [
  {t:"18:42:01",type:"info",msg:"[Server] Starting Paper server version 1.20.4-build.496"},
  {t:"18:42:03",type:"warn",msg:"[WorldGuard] Loaded configuration, 0 regions loaded."},
  {t:"18:42:04",type:"info",msg:"[EssentialsX] Loaded 26530 items from items.json."},
  {t:"18:42:05",type:"info",msg:"[Server] Done (3.241s)! For help, type 'help'"},
  {t:"18:44:12",type:"join",msg:"xAce_PvP joined the game"},
  {t:"18:47:01",type:"chat",msg:"<xAce_PvP> yo anyone wanna 1v1"},
  {t:"18:49:45",type:"death",msg:"Notch was slain by xAce_PvP"},
  {t:"18:53:30",type:"warn",msg:"[AntiCheat] Flagged xAce_PvP for KillAura (low confidence)"},
];

const PLAYERS = [
  {name:"xAce_PvP",uuid:"a1b2c3d4",ping:32,op:true,rank:"Admin"},
  {name:"Notch",uuid:"e5f6g7h8",ping:88,op:true,rank:"Owner"},
  {name:"CreeperKing99",uuid:"i9j0k1",ping:120,op:false,rank:"Member"},
  {name:"Steve_Farms",uuid:"m3n4o5",ping:45,op:false,rank:"VIP"},
];

const FILES = [
  {name:"server.jar",type:"file",size:"45.2 MB",modified:"2d ago"},
  {name:"server.properties",type:"file",size:"2 KB",modified:"4h ago"},
  {name:"plugins",type:"folder",size:"—",modified:"1h ago",children:["EssentialsX.jar","WorldGuard.jar","LuckPerms.jar","CoreProtect.jar"]},
  {name:"world",type:"folder",size:"234 MB",modified:"5m ago",children:["level.dat","region/","playerdata/"]},
  {name:"logs",type:"folder",size:"12 MB",modified:"just now",children:["latest.log","2025-01-01.log.gz"]},
  {name:"ops.json",type:"file",size:"512 B",modified:"1d ago"},
  {name:"banned-players.json",type:"file",size:"256 B",modified:"6h ago"},
];

const USERS = [
  {name:"you",email:"admin@panel.io",role:"Owner",servers:4,joined:"Jan 2025",avatar:"Y"},
  {name:"zyrex_dev",email:"zyrex@gmail.com",role:"Admin",servers:3,joined:"Feb 2025",avatar:"Z"},
  {name:"frost_mc",email:"frost@mc.net",role:"Moderator",servers:2,joined:"Mar 2025",avatar:"F"},
  {name:"builder_bob",email:"bob@builds.io",role:"Member",servers:1,joined:"Mar 2025",avatar:"B"},
];

const genTPS=()=>Array.from({length:30},(_,i)=>({t:`${i}m`,tps:+(19+Math.random()*1.2-0.5*(i>20?1:0)).toFixed(2),mspt:+(45+Math.random()*10).toFixed(1)}));
const genPlayers=()=>Array.from({length:24},(_,i)=>({h:`${i}:00`,players:Math.floor(Math.random()*18+2)}));
const genRAM=()=>Array.from({length:30},(_,i)=>({t:`${i}m`,ram:Math.floor(55+Math.random()*15),cpu:Math.floor(20+Math.random()*30)}));

// ─── Shared UI ───────────────────────────────────────────────────────────────
function Dot({status}){
  const c={online:"#39d353",offline:"#484f58",starting:"#d29922"};
  return <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:c[status]||"#484f58",
    animation:status==="online"?"pulse 2s infinite":status==="starting"?"pulse 0.7s infinite":"none",flexShrink:0}}/>;
}
function Tag({label,color="var(--text3)"}){
  return <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${color}18`,color,fontWeight:700}}>{label}</span>;
}
function Btn({label,color="var(--text2)",bg="transparent",border="var(--border2)",onClick,disabled,small}){
  return <button onClick={onClick} disabled={disabled} style={{
    padding:small?"3px 9px":"6px 14px",borderRadius:6,border:`1px solid ${border}`,
    background:bg,color,fontSize:small?11:12,cursor:disabled?"not-allowed":"pointer",
    fontFamily:"var(--font-ui)",fontWeight:700,opacity:disabled?.4:1,transition:"all .15s"}}>
    {label}
  </button>;
}
function Card({children,style={},glow}){
  return <div style={{background:"var(--bg2)",border:`1px solid ${glow?"rgba(57,211,83,0.25)":"var(--border)"}`,
    borderRadius:10,overflow:"hidden",...style}}>{children}</div>;
}
function CardHead({children}){
  return <div style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",
    fontSize:12,fontWeight:700,color:"var(--text2)",display:"flex",alignItems:"center",gap:8}}>{children}</div>;
}
function RingGauge({val,size=60}){
  const r=size/2-5,cx=size/2,cy=size/2,circ=2*Math.PI*r,dash=(val/100)*circ;
  const col=val>80?"#f85149":val>60?"#d29922":"#39d353";
  return <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#21262d" strokeWidth={5}/>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={5}
      strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
      style={{transition:"stroke-dasharray 1s ease",filter:`drop-shadow(0 0 4px ${col})`}}/>
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      style={{transform:`rotate(90deg)`,transformOrigin:`${cx}px ${cy}px`,
        fontFamily:"JetBrains Mono",fontSize:size/5,fontWeight:700,fill:col}}>{val}%</text>
  </svg>;
}
function MiniBar({val,color="var(--green)"}){
  return <div style={{flex:1,height:4,background:"#21262d",borderRadius:2,overflow:"hidden"}}>
    <div style={{height:"100%",width:`${val}%`,background:color,borderRadius:2,transition:"width 1s"}}/>
  </div>;
}
function ChartTip({active,payload,label,unit=""}){
  if(!active||!payload?.length) return null;
  return <div style={{background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:7,
    padding:"8px 12px",fontFamily:"var(--font-mono)",fontSize:12}}>
    <div style={{color:"var(--text3)",marginBottom:4}}>{label}</div>
    {payload.map(p=><div key={p.name} style={{color:p.color||"var(--text)",fontWeight:700}}>
      {p.name}: {p.value}{unit}
    </div>)}
  </div>;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function TabDashboard({servers,setServers,setActiveServer,setTab,notify}){
  const online=servers.filter(s=>s.status==="online");
  const totalPlayers=servers.reduce((a,s)=>a+s.players,0);
  const toggle=(id,newStatus)=>{
    setServers(p=>p.map(s=>s.id===id?{...s,status:newStatus}:s));
    notify(`Server ${newStatus==="online"?"started ▶":"stopped ■"} via GitHub Actions`);
  };
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
      {[
        {label:"Online Nodes",val:online.length,sub:"/ 4 total",c:"var(--green)"},
        {label:"Total Players",val:totalPlayers,sub:"across all nodes",c:"var(--blue)"},
        {label:"Avg CPU",val:`${online.length?Math.round(online.reduce((a,s)=>a+s.cpu,0)/online.length):0}%`,sub:"online nodes",c:"var(--yellow)"},
        {label:"Actions",val:"1,240",sub:"mins used / month",c:"var(--purple)"},
      ].map(c=><Card key={c.label} style={{padding:"14px 16px",position:"relative",overflow:"hidden"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:5}}>{c.label}</div>
        <div style={{fontSize:26,fontWeight:800,color:c.c,letterSpacing:-1}}>{c.val}</div>
        <div style={{fontSize:11,color:"var(--text3)",marginTop:3}}>{c.sub}</div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${c.c}22,${c.c})`}}/>
      </Card>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
      {servers.map(s=><Card key={s.id} glow={s.status==="online"} style={{padding:16}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Dot status={s.status}/>
            <div>
              <div style={{fontSize:14,fontWeight:700}}>{s.name}</div>
              <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>{s.type} {s.version} · :{s.port}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            {s.status==="online"
              ?<Btn label="■ Stop" color="var(--red)" border="rgba(248,81,73,.35)" bg="rgba(248,81,73,.08)" onClick={()=>toggle(s.id,"offline")}/>
              :s.status==="offline"
              ?<Btn label="▶ Start" color="var(--green)" border="rgba(57,211,83,.35)" bg="rgba(57,211,83,.08)" onClick={()=>toggle(s.id,"online")}/>
              :<span style={{padding:"5px 10px",borderRadius:6,background:"rgba(210,153,34,.1)",color:"var(--yellow)",fontSize:12,fontWeight:700}}>Starting…</span>}
            <Btn label="Console" onClick={()=>{setActiveServer(s);setTab("console");}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <RingGauge val={s.ram}/>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"var(--text3)",width:32}}>CPU</span>
              <MiniBar val={s.cpu} color={s.cpu>80?"var(--red)":s.cpu>60?"var(--yellow)":"var(--green)"}/>
              <span style={{fontSize:11,color:"var(--text2)",fontFamily:"var(--font-mono)",width:30,textAlign:"right"}}>{s.cpu}%</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"var(--text3)",width:32}}>TPS</span>
              <MiniBar val={(s.tps/20)*100} color={s.tps>18?"var(--green)":s.tps>15?"var(--yellow)":"var(--red)"}/>
              <span style={{fontSize:11,color:s.tps>18?"var(--green)":s.tps>15?"var(--yellow)":"var(--red)",fontFamily:"var(--font-mono)",fontWeight:700,width:30,textAlign:"right"}}>{s.tps}</span>
            </div>
            <div style={{display:"flex",gap:14,marginTop:2}}>
              <div><div style={{fontSize:10,color:"var(--text3)"}}>Players</div><div style={{fontSize:14,fontWeight:700,color:"var(--blue)"}}>{s.players}/{s.maxPlayers}</div></div>
              <div><div style={{fontSize:10,color:"var(--text3)"}}>Uptime</div><div style={{fontSize:12,fontWeight:600,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>{s.uptime}</div></div>
            </div>
          </div>
        </div>
      </Card>)}
    </div>
  </div>;
}

// ─── Console ─────────────────────────────────────────────────────────────────
function TabConsole({server,notify}){
  const [logs,setLogs]=useState(CONSOLE_LOGS);
  const [input,setInput]=useState("");
  const ref=useRef();
  useEffect(()=>{if(ref.current)ref.current.scrollTop=ref.current.scrollHeight;},[logs]);
  useEffect(()=>{
    const msgs=[
      {type:"info",msg:"[Server] Auto-saving world…"},
      {type:"join",msg:`Player${Math.floor(Math.random()*9999)} joined the game`},
      {type:"chat",msg:"<xAce_PvP> gg"},
      {type:"warn",msg:"[Paper] Lag detected — TPS dropped below 18."},
    ];
    const t=setInterval(()=>{
      if(Math.random()>.6) setLogs(p=>[...p.slice(-60),{t:new Date().toTimeString().slice(0,8),...msgs[Math.floor(Math.random()*msgs.length)]}]);
    },2800);
    return()=>clearInterval(t);
  },[]);
  const send=()=>{
    if(!input.trim())return;
    setLogs(p=>[...p,{t:new Date().toTimeString().slice(0,8),type:"cmd",msg:`> ${input}`}]);
    setInput("");
  };
  const typeColor={info:"#8b949e",warn:"#d29922",join:"#39d353",death:"#f85149",chat:"#58a6ff",cmd:"#bc8cff"};
  return <div style={{display:"flex",flexDirection:"column",gap:10,height:"calc(100vh - 142px)"}}>
    <div style={{display:"flex",gap:8,flexShrink:0}}>
      {[{l:"▶ Start",c:"var(--green)",dis:server.status==="online"},{l:"■ Stop",c:"var(--red)",dis:server.status==="offline"},{l:"↺ Restart",c:"var(--yellow)"},{l:"⤓ Kill",c:"var(--red)"}].map(b=>
        <Btn key={b.l} label={b.l} color={b.c} border={`${b.c}44`} bg={`${b.c}11`} onClick={()=>notify(`${b.l} triggered via Actions`)} disabled={b.dis}/>)}
      <div style={{flex:1}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderRadius:6,
        border:"1px solid var(--border)",background:"var(--bg3)",fontSize:12}}>
        <Dot status={server.status}/>
        <span style={{fontFamily:"var(--font-mono)",color:"var(--text2)"}}>{server.status.toUpperCase()}</span>
        <span style={{color:"var(--text3)",fontSize:11,fontFamily:"var(--font-mono)"}}>TPS: <span style={{color:"var(--green)"}}>{server.tps}</span></span>
      </div>
    </div>
    <div ref={ref} style={{flex:1,background:"var(--bg2)",border:"1px solid var(--border)",
      borderRadius:8,padding:"12px 14px",overflow:"auto",fontFamily:"var(--font-mono)"}}>
      {logs.map((l,i)=><div key={i} style={{display:"flex",gap:8,padding:"1px 0",fontSize:12,lineHeight:1.7}}>
        <span style={{color:"#484f58",flexShrink:0}}>{l.t}</span>
        <span style={{color:typeColor[l.type]||"#8b949e",flexShrink:0,fontWeight:700,fontSize:10,paddingTop:2,textTransform:"uppercase",width:36}}>[{l.type}]</span>
        <span style={{color:l.type==="chat"?"var(--text)":"#c9d1d9"}}>{l.msg}</span>
      </div>)}
      <div style={{display:"flex",alignItems:"center",gap:4,marginTop:6}}>
        <span style={{color:"var(--green)",fontSize:13}}>▸</span>
        <span style={{width:8,height:14,background:"var(--green)",display:"inline-block",animation:"blink 1s infinite"}}/>
      </div>
    </div>
    <div style={{display:"flex",gap:8,flexShrink:0}}>
      <div style={{flex:1,display:"flex",alignItems:"center",gap:8,background:"var(--bg2)",
        border:"1px solid var(--border2)",borderRadius:8,padding:"8px 14px"}}>
        <span style={{color:"var(--green)",fontFamily:"var(--font-mono)"}}>$</span>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="say hello · op player · tp @a 0 64 0 · /gc"
          style={{flex:1,background:"transparent",border:"none",color:"var(--text)",fontFamily:"var(--font-mono)",fontSize:13}}/>
      </div>
      <Btn label="Send ↵" color="var(--green)" border="rgba(57,211,83,.35)" bg="rgba(57,211,83,.1)" onClick={send}/>
    </div>
  </div>;
}

// ─── Analytics ───────────────────────────────────────────────────────────────
function TabAnalytics({server}){
  const [tpsData]=useState(genTPS);
  const [playerData]=useState(genPlayers);
  const [ramData]=useState(genRAM);
  const tpsColor=server.tps>18?"#39d353":server.tps>15?"#d29922":"#f85149";
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
      {[
        {label:"Current TPS",val:server.tps,unit:"/20",c:tpsColor},
        {label:"Avg Players 24h",val:"9.4",unit:"players",c:"var(--blue)"},
        {label:"Peak Today",val:"18",unit:"players",c:"var(--purple)"},
        {label:"7-day Uptime",val:"99.2%",unit:"",c:"var(--green)"},
      ].map(k=><Card key={k.label} style={{padding:"14px 16px"}}>
        <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1.5,fontWeight:700,marginBottom:6}}>{k.label}</div>
        <div style={{fontSize:26,fontWeight:800,color:k.c,letterSpacing:-1}}>{k.val}
          <span style={{fontSize:12,color:"var(--text3)",fontWeight:400,marginLeft:4}}>{k.unit}</span>
        </div>
      </Card>)}
    </div>
    <Card>
      <CardHead>📈 TPS & MSPT — Last 30 minutes</CardHead>
      <div style={{padding:16}}>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={tpsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d"/>
            <XAxis dataKey="t" tick={{fill:"#484f58",fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:"#484f58",fontSize:10}} axisLine={false} tickLine={false} domain={[0,22]}/>
            <Tooltip content={<ChartTip/>}/>
            <Line type="monotone" dataKey="tps" stroke="#39d353" strokeWidth={2} dot={false} name="TPS"/>
            <Line type="monotone" dataKey="mspt" stroke="#d29922" strokeWidth={1.5} dot={false} name="MSPT" strokeDasharray="4 2"/>
          </LineChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:16,marginTop:8}}>
          {[{c:"#39d353",l:"TPS (target 20.0)"},{c:"#d29922",l:"MSPT (target <50ms)"}].map(x=>
            <div key={x.l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--text3)"}}>
              <span style={{width:14,height:2,background:x.c,display:"inline-block",borderRadius:1}}/>
              {x.l}
            </div>)}
        </div>
      </div>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      <Card>
        <CardHead>👥 Player Count — Last 24 hours</CardHead>
        <div style={{padding:16}}>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={playerData}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#58a6ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#58a6ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d"/>
              <XAxis dataKey="h" tick={{fill:"#484f58",fontSize:9}} axisLine={false} tickLine={false} interval={3}/>
              <YAxis tick={{fill:"#484f58",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTip unit=" players"/>}/>
              <Area type="monotone" dataKey="players" stroke="#58a6ff" fill="url(#pg)" strokeWidth={2} name="Players"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardHead>💾 RAM & CPU — Last 30 minutes</CardHead>
        <div style={{padding:16}}>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={ramData}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#bc8cff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#bc8cff" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#39d353" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#39d353" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d"/>
              <XAxis dataKey="t" tick={{fill:"#484f58",fontSize:9}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#484f58",fontSize:10}} axisLine={false} tickLine={false} domain={[0,100]}/>
              <Tooltip content={<ChartTip unit="%"/>}/>
              <Area type="monotone" dataKey="ram" stroke="#bc8cff" fill="url(#rg)" strokeWidth={2} name="RAM"/>
              <Area type="monotone" dataKey="cpu" stroke="#39d353" fill="url(#cg)" strokeWidth={2} name="CPU"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  </div>;
}

// ─── Plugins ─────────────────────────────────────────────────────────────────
function TabPlugins({notify}){
  const [plugins,setPlugins]=useState(PLUGINS);
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("All");
  const cats=["All","Core","Protection","Permissions","Building","Security","Logging"];
  const toggle=(id)=>{
    const pl=plugins.find(x=>x.id===id);
    setPlugins(p=>p.map(x=>x.id===id?{...x,installed:!x.installed}:x));
    notify(pl.installed?`Removed ${pl.name}`:`Installing ${pl.name} via GitHub Actions…`);
  };
  const filtered=plugins.filter(p=>
    (filter==="All"||p.category===filter)&&
    (p.name.toLowerCase().includes(search.toLowerCase())||p.desc.toLowerCase().includes(search.toLowerCase()))
  );
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{flex:1,minWidth:200,display:"flex",alignItems:"center",gap:8,background:"var(--bg2)",
        border:"1px solid var(--border2)",borderRadius:8,padding:"7px 12px"}}>
        <span style={{color:"var(--text3)"}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plugins…"
          style={{flex:1,background:"transparent",border:"none",color:"var(--text)",fontFamily:"var(--font-ui)",fontSize:13}}/>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        {cats.map(c=><button key={c} onClick={()=>setFilter(c)} style={{
          padding:"5px 11px",borderRadius:6,border:`1px solid ${filter===c?"rgba(57,211,83,.4)":"var(--border)"}`,
          background:filter===c?"rgba(57,211,83,.08)":"transparent",
          color:filter===c?"var(--green)":"var(--text3)",fontSize:11,cursor:"pointer",fontFamily:"var(--font-ui)",fontWeight:700
        }}>{c}</button>)}
      </div>
    </div>
    <div style={{display:"flex",gap:10}}>
      {[{l:"Installed",v:plugins.filter(p=>p.installed).length,c:"var(--green)"},{l:"Available",v:plugins.filter(p=>!p.installed).length,c:"var(--text2)"},{l:"Updates",v:1,c:"var(--yellow)"}].map(s=>
        <div key={s.l} style={{padding:"8px 14px",borderRadius:7,background:"var(--bg2)",border:"1px solid var(--border)",display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</span>
          <span style={{fontSize:11,color:"var(--text3)"}}>{s.l}</span>
        </div>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
      {filtered.map(p=><Card key={p.id} glow={p.installed} style={{padding:14}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:700}}>{p.name}</span>
              <Tag label={p.version} color="var(--text3)"/>
              <Tag label={p.category} color="var(--blue)"/>
              {p.installed&&<Tag label="✓ Installed" color="var(--green)"/>}
            </div>
            <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.5,marginBottom:8}}>{p.desc}</div>
            <div style={{display:"flex",gap:12,fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>
              <span>⭐ {p.rating}</span><span>⤓ {p.downloads}</span><span>📦 {p.size}</span>
            </div>
          </div>
          <button onClick={()=>toggle(p.id)} style={{
            padding:"6px 13px",borderRadius:7,flexShrink:0,whiteSpace:"nowrap",
            border:`1px solid ${p.installed?"rgba(248,81,73,.35)":"rgba(57,211,83,.35)"}`,
            background:p.installed?"rgba(248,81,73,.08)":"rgba(57,211,83,.08)",
            color:p.installed?"var(--red)":"var(--green)",fontSize:12,cursor:"pointer",fontFamily:"var(--font-ui)",fontWeight:700
          }}>{p.installed?"Remove":"Install"}</button>
        </div>
      </Card>)}
    </div>
  </div>;
}

// ─── Schedules ────────────────────────────────────────────────────────────────
function TabSchedules({notify}){
  const [tasks,setTasks]=useState(SCHEDULES);
  const [modal,setModal]=useState(false);
  const [newTask,setNewTask]=useState({name:"",action:"backup",server:"All Servers",cron:"0 3 * * *"});
  const actionColor={backup:"var(--blue)",restart:"var(--yellow)",command:"var(--green)",wipe:"var(--red)"};
  const actionIcon={backup:"💾",restart:"↺",command:"⌨",wipe:"💥"};
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:16,fontWeight:800}}>Scheduled Tasks</div>
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)",marginTop:2}}>Powered by GitHub Actions cron triggers</div>
      </div>
      <Btn label="+ New Task" color="var(--green)" border="rgba(57,211,83,.35)" bg="rgba(57,211,83,.1)" onClick={()=>setModal(true)}/>
    </div>
    <Card>
      {tasks.map((task,i)=><div key={task.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",
        borderBottom:i<tasks.length-1?"1px solid var(--border)":"none",opacity:task.enabled?1:.5,transition:"opacity .2s"}}>
        <div onClick={()=>{setTasks(p=>p.map(t=>t.id===task.id?{...t,enabled:!t.enabled}:t));notify(`Task "${task.name}" ${task.enabled?"disabled":"enabled"}`);}}
          style={{width:38,height:22,borderRadius:11,background:task.enabled?"var(--green2)":"var(--border2)",
            cursor:"pointer",position:"relative",transition:"background .2s",flexShrink:0}}>
          <div style={{position:"absolute",top:3,left:task.enabled?18:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
        </div>
        <div style={{width:36,height:36,borderRadius:8,flexShrink:0,background:`${actionColor[task.action]}18`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
          {actionIcon[task.action]}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
            <span style={{fontSize:14,fontWeight:700}}>{task.name}</span>
            <Tag label={task.action} color={actionColor[task.action]}/>
          </div>
          <div style={{fontSize:12,color:"var(--text3)",display:"flex",gap:12,fontFamily:"var(--font-mono)"}}>
            <span>📅 {task.cron}</span><span>🖥 {task.server}</span>
          </div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text2)",fontFamily:"var(--font-mono)"}}>Next: {task.next}</div>
          <div style={{fontSize:11,color:task.lastRun.includes("Success")?"var(--green)":"var(--text3)"}}>{task.lastRun}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn small label="Edit" onClick={()=>notify("Edit modal—coming soon")}/>
          <Btn small label="Run Now" color="var(--blue)" border="rgba(88,166,255,.3)" bg="rgba(88,166,255,.08)"
            onClick={()=>notify(`Running "${task.name}" now…`)}/>
        </div>
      </div>)}
    </Card>
    {modal&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:100,
      display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s"}}>
      <Card style={{width:430,padding:24}}>
        <div style={{fontSize:16,fontWeight:800,marginBottom:18}}>New Scheduled Task</div>
        {[{label:"Task Name",key:"name",ph:"e.g. Nightly Backup"},{label:"Cron Expression",key:"cron",ph:"0 3 * * *"},{label:"Target Server",key:"server",ph:"All Servers"}].map(f=>
          <div key={f.key} style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"var(--text2)",fontWeight:700,marginBottom:5}}>{f.label}</div>
            <input value={newTask[f.key]} onChange={e=>setNewTask(p=>({...p,[f.key]:e.target.value}))}
              placeholder={f.ph} style={{width:"100%",padding:"8px 12px",borderRadius:7,
                border:"1px solid var(--border2)",background:"var(--bg3)",color:"var(--text)",
                fontFamily:"var(--font-mono)",fontSize:13}}/>
          </div>)}
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:"var(--text2)",fontWeight:700,marginBottom:8}}>Action</div>
          <div style={{display:"flex",gap:7}}>
            {["backup","restart","command","wipe"].map(a=><button key={a} onClick={()=>setNewTask(p=>({...p,action:a}))}
              style={{flex:1,padding:"7px 0",borderRadius:6,
                border:`1px solid ${newTask.action===a?actionColor[a]+"66":"var(--border)"}`,
                background:newTask.action===a?`${actionColor[a]}18`:"transparent",
                color:newTask.action===a?actionColor[a]:"var(--text3)",
                fontSize:12,cursor:"pointer",fontFamily:"var(--font-ui)",fontWeight:700,textTransform:"capitalize"}}>
              {actionIcon[a]} {a}
            </button>)}
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn label="Cancel" onClick={()=>setModal(false)}/>
          <Btn label="Create Task" color="var(--green)" border="rgba(57,211,83,.35)" bg="rgba(57,211,83,.1)"
            onClick={()=>{
              setTasks(p=>[...p,{...newTask,id:Date.now(),enabled:true,next:"—",lastRun:"Never"}]);
              setModal(false);
              notify(`Task "${newTask.name}" created`);
            }}/>
        </div>
      </Card>
    </div>}
  </div>;
}

// ─── Properties ──────────────────────────────────────────────────────────────
function TabProperties({notify}){
  const [props,setProps]=useState(PROPERTIES);
  const update=(section,key,val)=>setProps(p=>({...p,[section]:{...p[section],[key]:{...p[section][key],val}}}));
  return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:700}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <div style={{fontSize:16,fontWeight:800}}>Server Properties</div>
        <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)",marginTop:2}}>Edits commit to server.properties via GitHub Contents API</div>
      </div>
      <Btn label="💾 Save & Commit" color="var(--green)" border="rgba(57,211,83,.4)" bg="rgba(57,211,83,.08)"
        onClick={()=>notify("server.properties saved + committed to repo")}/>
    </div>
    {Object.entries(props).map(([section,fields])=><Card key={section}>
      <CardHead><span style={{color:"var(--green)"}}>⬡</span> {section}</CardHead>
      <div style={{padding:"6px 8px"}}>
        {Object.entries(fields).map(([key,field])=><div key={key}
          style={{display:"flex",alignItems:"center",gap:12,padding:"9px 10px",borderRadius:6,transition:"background .1s"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,fontFamily:"var(--font-mono)"}}>{key}</div>
            <div style={{fontSize:11,color:"var(--text3)"}}>{field.desc}</div>
          </div>
          <div style={{flexShrink:0}}>
            {field.type==="toggle"
              ?<div onClick={()=>update(section,key,!field.val)} style={{
                  width:40,height:22,borderRadius:11,background:field.val?"var(--green2)":"var(--border2)",
                  cursor:"pointer",position:"relative",transition:"background .2s"}}>
                  <div style={{position:"absolute",top:3,left:field.val?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
                </div>
              :field.type==="select"
              ?<select value={field.val} onChange={e=>update(section,key,e.target.value)} style={{
                  padding:"5px 8px",borderRadius:6,border:"1px solid var(--border2)",
                  background:"var(--bg3)",color:"var(--text)",fontFamily:"var(--font-mono)",fontSize:12}}>
                  {field.opts.map(o=><option key={o}>{o}</option>)}
                </select>
              :<input type={field.type==="number"?"number":"text"} value={field.val}
                  onChange={e=>update(section,key,e.target.value)} style={{
                    padding:"5px 10px",borderRadius:6,border:"1px solid var(--border2)",
                    background:"var(--bg3)",color:"var(--text)",fontFamily:"var(--font-mono)",
                    fontSize:12,width:field.type==="number"?80:200}}/>}
          </div>
        </div>)}
      </div>
    </Card>)}
  </div>;
}

// ─── Files, Players, Users, Settings (compact) ───────────────────────────────
function TabFiles({server,notify}){
  const [expanded,setExpanded]=useState(null);
  return <Card>
    <div style={{padding:"11px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:12,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>/{server.name}/</span>
      <div style={{flex:1}}/>
      <Btn label="+ Upload" color="var(--green)" border="rgba(57,211,83,.35)" bg="rgba(57,211,83,.08)" onClick={()=>notify("Upload via GitHub Contents API")}/>
    </div>
    <div style={{padding:8}}>
      {FILES.map(f=><div key={f.name}>
        <div onClick={()=>f.type==="folder"&&setExpanded(expanded===f.name?null:f.name)}
          style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:6,cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <span style={{fontSize:16,flexShrink:0}}>{f.type==="folder"?(expanded===f.name?"📂":"📁"):"📄"}</span>
          <span style={{flex:1,fontSize:13,fontFamily:"var(--font-mono)",color:f.type==="folder"?"var(--blue)":"var(--text)"}}>{f.name}</span>
          <span style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>{f.size}</span>
          <span style={{fontSize:11,color:"var(--text3)",width:60,textAlign:"right"}}>{f.modified}</span>
          {f.type==="file"&&<div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
            <Btn small label="Edit" onClick={()=>notify(`Editing ${f.name}`)}/>
            <Btn small label="⤓" onClick={()=>notify(`Downloading ${f.name}`)}/>
          </div>}
        </div>
        {f.type==="folder"&&expanded===f.name&&f.children&&
          <div style={{marginLeft:28,borderLeft:"1px solid var(--border)",paddingLeft:8}}>
            {f.children.map(c=><div key={c} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--bg3)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <span style={{fontSize:13}}>📄</span>
              <span style={{fontSize:12,fontFamily:"var(--font-mono)",color:"var(--text2)",flex:1}}>{c}</span>
              <Btn small label="Edit" onClick={()=>notify(`Editing ${c}`)}/>
            </div>)}
          </div>}
      </div>)}
    </div>
  </Card>;
}

function TabPlayers({server,notify}){
  return <div style={{display:"flex",flexDirection:"column",gap:12}}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
      {[{l:"Online",v:server.players,c:"var(--green)"},{l:"Max",v:server.maxPlayers,c:"var(--blue)"},{l:"Banned",v:2,c:"var(--red)"}].map(s=>
        <Card key={s.l} style={{padding:"14px 16px"}}>
          <div style={{fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{s.l}</div>
          <div style={{fontSize:24,fontWeight:800,color:s.c}}>{s.v}</div>
        </Card>)}
    </div>
    <Card>
      <CardHead>Online Players</CardHead>
      {PLAYERS.map(p=><div key={p.name} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid var(--border)"}}>
        <div style={{width:34,height:34,borderRadius:7,background:"var(--bg3)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"var(--text2)"}}>
          {p.name[0].toUpperCase()}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <span style={{fontSize:14,fontWeight:700}}>{p.name}</span>
            {p.op&&<Tag label="OP" color="var(--purple)"/>}
            <Tag label={p.rank} color={p.rank==="Admin"||p.rank==="Owner"?"var(--green)":p.rank==="VIP"?"var(--yellow)":"var(--blue)"}/>
          </div>
          <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>{p.uuid}</div>
        </div>
        <div style={{textAlign:"right",marginRight:12}}>
          <div style={{fontSize:12,fontWeight:700,color:p.ping<50?"var(--green)":p.ping<100?"var(--yellow)":"var(--red)",fontFamily:"var(--font-mono)"}}>{p.ping}ms</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn small label="Kick" color="var(--yellow)" border="rgba(210,153,34,.3)" bg="rgba(210,153,34,.08)" onClick={()=>notify(`Kicked ${p.name}`)}/>
          <Btn small label="Ban" color="var(--red)" border="rgba(248,81,73,.3)" bg="rgba(248,81,73,.08)" onClick={()=>notify(`Banned ${p.name}`)}/>
          {!p.op&&<Btn small label="OP" color="var(--purple)" border="rgba(188,140,255,.3)" bg="rgba(188,140,255,.08)" onClick={()=>notify(`Opped ${p.name}`)}/>}
        </div>
      </div>)}
    </Card>
  </div>;
}

function TabUsers({notify}){
  const roleColor={Owner:"var(--green)",Admin:"var(--blue)",Moderator:"var(--purple)",Member:"var(--text3)"};
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{fontSize:16,fontWeight:800}}>Team Members</div>
      <Btn label="+ Invite" color="var(--green)" border="rgba(57,211,83,.35)" bg="rgba(57,211,83,.1)" onClick={()=>notify("Invite link generated!")}/>
    </div>
    <Card>
      {USERS.map((u,i)=><div key={u.name} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",
        borderBottom:i<USERS.length-1?"1px solid var(--border)":"none"}}>
        <div style={{width:38,height:38,borderRadius:10,
          background:`linear-gradient(135deg,${["#39d353","#58a6ff","#bc8cff","#d29922"][i%4]}44,${["#26a641","#1f6feb","#8957e5","#9e6a03"][i%4]}88)`,
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff"}}>
          {u.avatar}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14,fontWeight:700}}>{u.name}</span>
            <Tag label={u.role} color={roleColor[u.role]||"var(--text3)"}/>
          </div>
          <div style={{fontSize:12,color:"var(--text3)"}}>{u.email} · joined {u.joined}</div>
        </div>
        <span style={{fontSize:11,color:"var(--text2)",marginRight:12}}>{u.servers} servers</span>
        {u.name!=="you"&&<div style={{display:"flex",gap:6}}>
          <Btn small label="Edit" onClick={()=>notify(`Editing ${u.name}`)}/>
          <Btn small label="Remove" color="var(--red)" border="rgba(248,81,73,.3)" bg="rgba(248,81,73,.08)" onClick={()=>notify(`Removed ${u.name}`)}/>
        </div>}
      </div>)}
    </Card>
  </div>;
}

function TabSettings({notify}){
  const sections=[
    {title:"GitHub Integration",fields:[
      {label:"Repository",val:"your-org/nodecraft",type:"text"},
      {label:"GitHub PAT Token",val:"ghp_••••••••••••••••",type:"password"},
      {label:"Actions Runner",val:"ubuntu-latest",type:"select",opts:["ubuntu-latest","ubuntu-22.04","windows-latest"]},
      {label:"Branch",val:"main",type:"text"},
    ]},
    {title:"Server Defaults",fields:[
      {label:"Default RAM",val:"2G",type:"text"},
      {label:"Default Java",val:"java21",type:"select",opts:["java17","java21"]},
      {label:"Auto-restart on Crash",val:true,type:"toggle"},
      {label:"Backup Interval",val:"6h",type:"select",opts:["1h","3h","6h","12h","24h"]},
      {label:"Expose Console (bore.pub)",val:true,type:"toggle"},
    ]},
  ];
  return <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:640}}>
    {sections.map(sec=><Card key={sec.title}>
      <CardHead>{sec.title}</CardHead>
      <div style={{padding:"10px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {sec.fields.map(f=><div key={f.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <label style={{fontSize:13,color:"var(--text2)",fontWeight:600,flex:1}}>{f.label}</label>
          {f.type==="toggle"
            ?<div style={{width:40,height:22,borderRadius:11,background:f.val?"var(--green2)":"var(--border2)",cursor:"pointer",position:"relative"}}>
                <div style={{position:"absolute",top:3,left:f.val?20:3,width:16,height:16,borderRadius:"50%",background:"#fff"}}/>
              </div>
            :f.type==="select"
            ?<select defaultValue={f.val} style={{padding:"6px 8px",borderRadius:6,border:"1px solid var(--border2)",background:"var(--bg3)",color:"var(--text)",fontFamily:"var(--font-mono)",fontSize:12}}>
                {f.opts.map(o=><option key={o}>{o}</option>)}
              </select>
            :<input defaultValue={f.val} type={f.type==="password"?"password":"text"} style={{
                padding:"6px 10px",borderRadius:6,border:"1px solid var(--border2)",
                background:"var(--bg3)",color:"var(--text)",fontSize:12,fontFamily:"var(--font-mono)",width:200}}/>}
        </div>)}
      </div>
    </Card>)}
    <Btn label="💾 Save Settings" color="var(--green)" border="rgba(57,211,83,.4)" bg="rgba(57,211,83,.08)"
      onClick={()=>notify("Settings saved + pushed to repo config")}/>
  </div>;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Panel(){
  const [tab,setTab]=useState("dashboard");
  const [servers,setServers]=useState(SERVERS);
  const [activeServer,setActiveServer]=useState(SERVERS[0]);
  const [notification,setNotification]=useState(null);

  const notify=(msg,type="success")=>{
    setNotification({msg,type});
    setTimeout(()=>setNotification(null),3500);
  };

  const NAV=[
    {id:"dashboard",icon:"⬡",label:"Dashboard"},
    {id:"console",icon:"⌨",label:"Console"},
    {id:"analytics",icon:"📈",label:"Analytics",badge:"NEW"},
    {id:"plugins",icon:"🧩",label:"Plugins",badge:"NEW"},
    {id:"files",icon:"◫",label:"Files"},
    {id:"players",icon:"◈",label:"Players"},
    {id:"schedules",icon:"⏱",label:"Schedules",badge:"NEW"},
    {id:"properties",icon:"📋",label:"Properties",badge:"NEW"},
    {id:"users",icon:"◉",label:"Users"},
    {id:"settings",icon:"⚙",label:"Settings"},
  ];

  const TITLES={
    dashboard:"Dashboard",console:`Console · ${activeServer.name}`,
    analytics:`Analytics · ${activeServer.name}`,plugins:"Plugin Marketplace",
    files:`Files · ${activeServer.name}`,players:`Players · ${activeServer.name}`,
    schedules:"Scheduled Tasks",properties:`Properties · ${activeServer.name}`,
    users:"Team Members",settings:"Settings",
  };
  const SUBS={
    dashboard:`${servers.filter(s=>s.status==="online").length} online · ${servers.reduce((a,s)=>a+s.players,0)} players · GitHub Actions`,
    console:`${activeServer.type} ${activeServer.version} · :${activeServer.port} · up ${activeServer.uptime}`,
    analytics:"TPS · player count · RAM/CPU over time",
    plugins:`${PLUGINS.filter(p=>p.installed).length} installed · ${PLUGINS.filter(p=>!p.installed).length} available`,
    files:"GitHub Contents API · commits on save",
    players:`${activeServer.players} online · ${activeServer.maxPlayers} max · TPS ${activeServer.tps}`,
    schedules:"GitHub Actions cron triggers",
    properties:"server.properties · auto-commits via Contents API",
    users:`${USERS.length} members · GitHub OAuth`,
    settings:"GitHub integration & node defaults",
  };

  return <div style={{display:"flex",height:"100vh",background:"var(--bg)",fontFamily:"var(--font-ui)",overflow:"hidden"}}>
    <style>{CSS}</style>
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,
      background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.025) 2px,rgba(0,0,0,.025) 4px)"}}/>

    {notification&&<div style={{position:"fixed",top:18,right:18,zIndex:1000,
      background:notification.type==="success"?"rgba(57,211,83,.12)":"rgba(248,81,73,.12)",
      border:`1px solid ${notification.type==="success"?"#39d353":"#f85149"}`,
      borderRadius:8,padding:"9px 16px",color:notification.type==="success"?"var(--green)":"var(--red)",
      fontFamily:"var(--font-mono)",fontSize:12,animation:"slideIn .2s ease",backdropFilter:"blur(12px)"}}>
      {notification.type==="success"?"✓":"✗"} {notification.msg}
    </div>}

    {/* Sidebar */}
    <div style={{width:206,background:"var(--bg2)",borderRight:"1px solid var(--border)",
      display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"16px 14px 13px",borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#39d353,#26a641)",borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,
            boxShadow:"0 0 18px rgba(57,211,83,.35)"}}>⛏</div>
          <div>
            <div style={{fontSize:15,fontWeight:800,letterSpacing:-.5}}>NodeCraft</div>
            <div style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>v1.0 · github.io</div>
          </div>
        </div>
      </div>

      <div style={{padding:"10px 7px 6px"}}>
        <div style={{fontSize:10,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:1.5,padding:"0 8px 7px"}}>Nodes</div>
        {servers.map(s=><div key={s.id} onClick={()=>{setActiveServer(s);setTab("console");}}
          style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:6,cursor:"pointer",marginBottom:2,
            background:activeServer.id===s.id?"rgba(57,211,83,.08)":"transparent",
            border:activeServer.id===s.id?"1px solid rgba(57,211,83,.2)":"1px solid transparent"}}>
          <Dot status={s.status}/>
          <span style={{fontSize:12,fontWeight:600,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
            color:activeServer.id===s.id?"var(--green)":"var(--text2)"}}>{s.name}</span>
          <span style={{fontSize:10,color:"var(--text3)",fontFamily:"var(--font-mono)"}}>{s.players}</span>
        </div>)}
        <div onClick={()=>notify("New server workflow triggered!")}
          style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:6,cursor:"pointer",
            border:"1px dashed var(--border2)",opacity:.5,marginTop:4}}>
          <span style={{color:"var(--text3)",fontSize:15,lineHeight:1}}>+</span>
          <span style={{fontSize:12,color:"var(--text3)"}}>New server</span>
        </div>
      </div>

      <div style={{flex:1}}/>

      <div style={{padding:"6px 7px",borderTop:"1px solid var(--border)"}}>
        {NAV.map(n=><div key={n.id} onClick={()=>setTab(n.id)}
          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 9px",borderRadius:6,cursor:"pointer",
            background:tab===n.id?"rgba(57,211,83,.1)":"transparent",
            color:tab===n.id?"var(--green)":"var(--text2)",marginBottom:1}}>
          <span style={{fontSize:12,width:16,textAlign:"center"}}>{n.icon}</span>
          <span style={{fontSize:12,fontWeight:tab===n.id?700:500,flex:1}}>{n.label}</span>
          {n.badge&&<span style={{fontSize:8,padding:"1px 4px",borderRadius:3,
            background:"rgba(88,166,255,.18)",color:"var(--blue)",fontWeight:800,letterSpacing:.5}}>{n.badge}</span>}
        </div>)}
      </div>

      <div style={{padding:"10px 14px",borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#39d353,#1a7f37)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>Y</div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:700}}>you</div>
          <div style={{fontSize:10,color:"var(--green)",fontFamily:"var(--font-mono)"}}>Owner</div>
        </div>
      </div>
    </div>

    {/* Main */}
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"12px 22px",borderBottom:"1px solid var(--border)",
        display:"flex",alignItems:"center",gap:14,background:"var(--bg2)",flexShrink:0}}>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800}}>{TITLES[tab]}</div>
          <div style={{fontSize:11,color:"var(--text3)",fontFamily:"var(--font-mono)",marginTop:2}}>{SUBS[tab]}</div>
        </div>
        <div style={{display:"flex",gap:7}}>
          {[{l:`${servers.filter(s=>s.status==="online").length}/4 Online`,c:"var(--green)"},
            {l:`${servers.reduce((a,s)=>a+s.players,0)} Players`,c:"var(--blue)"},
            {l:"⚡ Actions OK",c:"var(--purple)"}].map(p=>
            <div key={p.l} style={{padding:"4px 10px",borderRadius:20,background:"var(--bg3)",
              border:`1px solid ${p.c}33`,fontSize:10,color:p.c,fontFamily:"var(--font-mono)",fontWeight:700}}>{p.l}</div>)}
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:20}}>
        {tab==="dashboard"&&<TabDashboard servers={servers} setServers={setServers} setActiveServer={setActiveServer} setTab={setTab} notify={notify}/>}
        {tab==="console"&&<TabConsole server={activeServer} notify={notify}/>}
        {tab==="analytics"&&<TabAnalytics server={activeServer}/>}
        {tab==="plugins"&&<TabPlugins notify={notify}/>}
        {tab==="files"&&<TabFiles server={activeServer} notify={notify}/>}
        {tab==="players"&&<TabPlayers server={activeServer} notify={notify}/>}
        {tab==="schedules"&&<TabSchedules notify={notify}/>}
        {tab==="properties"&&<TabProperties notify={notify}/>}
        {tab==="users"&&<TabUsers notify={notify}/>}
        {tab==="settings"&&<TabSettings notify={notify}/>}
      </div>
    </div>
  </div>;
}
