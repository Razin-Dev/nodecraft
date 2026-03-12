// Environment variables from .env
const ENV_TOKEN = () => import.meta.env.VITE_GITHUB_TOKEN || "";
const ENV_OWNER = () => import.meta.env.VITE_GITHUB_OWNER || "";
const ENV_REPO = () => import.meta.env.VITE_GITHUB_REPO || "";

// LocalStorage values (user can override)
const OWNER = () => localStorage.getItem("nc_owner") || ENV_OWNER();
const REPO  = () => localStorage.getItem("nc_repo")  || ENV_REPO();
const TOKEN = () => localStorage.getItem("nc_token") || ENV_TOKEN();

// Pterodactyl configuration
const PTERO_URL = () => localStorage.getItem("nc_ptero_url") || import.meta.env.VITE_PTERODACTYL_URL || "";
const PTERO_KEY = () => localStorage.getItem("nc_ptero_key") || import.meta.env.VITE_PTERODACTYL_API_KEY || "";

// GitHub API headers
const gh = { Authorization:`Bearer ${TOKEN()}`, Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28" };

// Check if using Pterodactyl backend
export const isUsingPterodactyl = () => !!PTERO_URL() && !!PTERO_KEY();

// Get Pterodactyl headers
const pteroHeaders = () => ({ 
  Authorization: `Bearer ${PTERO_KEY()}`,
  Accept: "application/json",
  "Content-Type": "application/json"
});

// ============ MODRINTH API ============
const MODRINTH_API = "https://api.modrinth.com/v2";

export async function searchModrinth(query, type = "mod", gameVersion = "1.21") {
  // type: "plugin" or "mod"
  const category = type === "plugin" ? "mod" : "mod";
  const searchQuery = query || "";
  const url = `${MODRINTH_API}/search?query=${encodeURIComponent(searchQuery)}&game_version=${gameVersion}&facets=[["categories:${category}"]]&limit=20`;
  const res = await fetch(url);
  const data = await res.json();
  return data.hits || [];
}

export async function getModrinthProject(projectId) {
  const res = await fetch(`${MODRINTH_API}/project/${projectId}`);
  return res.json();
}

export async function getModrinthVersions(projectId) {
  const res = await fetch(`${MODRINTH_API}/project/${projectId}/version`);
  return res.json();
}

export async function getModrinthFiles(projectId, versionId) {
  const res = await fetch(`${MODRINTH_API}/project/${projectId}/version/${versionId}`);
  return res.json();
}

// ============ CURSEFORGE API ============
const CURSEFORGE_API = "https://api.curseforge.com/v1";
const CURSEFORGE_KEY = "$2a$10$8K1p/a0dL/.6/JItqV4nz.6.sLM4wDqE4P3hP.zJpkRdKxJ3wC3JS"; // Public API key

export async function searchCurseForge(query, gameVersion = "1.21") {
  const res = await fetch(`${CURSEFORGE_API}/mods/search?searchText=${encodeURIComponent(query)}&gameVersion=${gameVersion}&index=0&pageSize=20`, {
    headers: { "x-api-key": CURSEFORGE_KEY }
  });
  return res.json();
}

export async function getCurseForgeMod(modId) {
  const res = await fetch(`${CURSEFORGE_API}/mods/${modId}`, {
    headers: { "x-api-key": CURSEFORGE_KEY }
  });
  return res.json();
}

export async function getCurseForgeFiles(modId) {
  const res = await fetch(`${CURSEFORGE_API}/mods/${modId}/files`, {
    headers: { "x-api-key": CURSEFORGE_KEY }
  });
  return res.json();
}

// GitHub Actions API Functions
export async function triggerWorkflow(workflow, inputs={}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/actions/workflows/${workflow}/dispatches`,
    { method:"POST", headers:gh, body:JSON.stringify({ref:"main",inputs}) });
  if(!res.ok) throw new Error(`Failed: ${res.status}`);
}
export async function getWorkflowRuns(workflow, perPage=5) {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/actions/workflows/${workflow}/runs?per_page=${perPage}`, {headers:gh});
  const d = await res.json(); return d.workflow_runs||[];
}
export async function getRun(runId) {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/actions/runs/${runId}`, {headers:gh});
  return res.json();
}
export async function cancelRun(runId) {
  await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/actions/runs/${runId}/cancel`, {method:"POST",headers:gh});
}
export async function getRunJobs(runId) {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/actions/runs/${runId}/jobs`, {headers:gh});
  const d = await res.json(); return d.jobs||[];
}
export async function getJobLogs(jobId) {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/actions/jobs/${jobId}/logs`, {headers:gh});
  if(!res.ok) return ""; return res.text();
}
export async function startServer(inputs) {
  await triggerWorkflow("start-server.yml", inputs);
  await new Promise(r=>setTimeout(r,4000));
  const runs = await getWorkflowRuns("start-server.yml",1);
  return runs[0]?.id||null;
}
export async function getRunStatus(runId) {
  if(!runId) return "offline";
  try { const r=await getRun(runId); if(r.status==="queued") return "starting"; if(r.status==="in_progress") return "online"; return "offline"; }
  catch { return "offline"; }
}
export async function listFiles(path="") {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`, {headers:gh});
  const d = await res.json(); return Array.isArray(d)?d:[];
}
export async function getFile(path) {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`, {headers:gh});
  const d = await res.json(); if(!d.content) return null;
  return { content:decodeURIComponent(escape(atob(d.content.replace(/\n/g,"")))), sha:d.sha };
}
export async function saveFile(path, content, sha, message="Update via NodeCraft") {
  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`,
    { method:"PUT", headers:gh, body:JSON.stringify({message,content:btoa(unescape(encodeURIComponent(content))),sha}) });
  return res.ok;
}
export async function validateToken() {
  if (isUsingPterodactyl()) {
    // Validate Pterodactyl connection
    const res = await fetch(`${PTERO_URL()}/api/application/users`, {headers: pteroHeaders()});
    if(!res.ok) return null; 
    return { login: "Pterodactyl User", ptero: true };
  }
  const res = await fetch("https://api.github.com/user", {headers:gh});
  if(!res.ok) return null; return res.json();
}

export async function sendCommand(command) {
  if (isUsingPterodactyl()) {
    return await pteroSendCommand(command);
  }
  
  // GitHub Actions command - sanitize to prevent injection
  const sanitized = command.replace(/[;&|`$(){}]/g, '');
  if (sanitized !== command) {
    console.warn('Command contained invalid characters, sanitized');
    command = sanitized;
  }
  
  // Limit command length
  if (command.length > 500) {
    command = command.slice(0, 500);
  }

  const path = ".nodecraft/command.txt";
  let sha = undefined;

  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`, { headers: gh });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch { /* Ignore */ }

  const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`, {
    method: "PUT",
    headers: gh,
    body: JSON.stringify({
      message: `Send command: ${command}`,
      content: btoa(unescape(encodeURIComponent(command))),
      sha: sha
    })
  });
  return res.ok;
}

export async function getStats(runId) {
  if (isUsingPterodactyl()) {
    return await pteroGetStats(runId);
  }
  
  if (!runId) return null;
  const path = `.nodecraft/stats/${runId}.json`;
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER()}/${REPO()}/contents/${path}`, { headers: gh });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content) return null;
    return JSON.parse(decodeURIComponent(escape(atob(data.content.replace(/\n/g, "")))));
  } catch {
    return null;
  }
}

export async function triggerInstallMod(inputs) {
  await triggerWorkflow("install-mod.yml", inputs);
}

// ==================== PTERODACTYL FUNCTIONS ====================

// Get all servers from Pterodactyl
export async function pteroGetServers() {
  if (!isUsingPterodactyl()) return [];
  try {
    const res = await fetch(`${PTERO_URL()}/api/application/servers`, {headers: pteroHeaders()});
    if (!res.ok) return [];
    const data = await res.json();
    
    // Get allocations for each server to get IP
    const servers = data.data || [];
    const serversWithAllocations = await Promise.all(servers.map(async (server) => {
      const allocationsRes = await fetch(`${PTERO_URL()}/api/application/servers/${server.attributes.identifier}/allocations`, {headers: pteroHeaders()});
      const allocationsData = await allocationsRes.json();
      const defaultAlloc = allocationsData.data?.find(a => a.attributes.is_default) || allocationsData.data?.[0];
      
      return {
        ...server,
        ip: defaultAlloc?.attributes?.ip || "--",
        port: defaultAlloc?.attributes?.port || 25565,
        location: server.attributes?.nest?.name || "--"
      };
    }));
    
    return serversWithAllocations;
  } catch (e) {
    console.error("Pterodactyl error:", e);
    return [];
  }
}

// Create a new server on Pterodactyl
export async function pteroCreateServer(name, options = {}) {
  const { 
    egg = 'paper', 
    version = '1.20.4', 
    ram = 2, 
    disk = 10,
    location = 1 
  } = options;
  
  if (!isUsingPterodactyl()) throw new Error("Pterodactyl not configured");
  
  try {
    // Get nests
    const nestsRes = await fetch(`${PTERO_URL()}/api/application/nests`, {headers: pteroHeaders()});
    if (!nestsRes.ok) throw new Error("Failed to get nests");
    const nests = await nestsRes.json();
    
    // Find Minecraft Java nest
    let minecraftNest = nests.data.find(n => 
      n.attributes.name.toLowerCase().includes('minecraft') && 
      n.attributes.name.toLowerCase().includes('java')
    );
    
    if (!minecraftNest) {
      // Try finding any Minecraft nest
      minecraftNest = nests.data.find(n => n.attributes.name.toLowerCase().includes('minecraft'));
    }
    
    if (!minecraftNest) {
      throw new Error("Minecraft nest not found on Pterodactyl panel");
    }
    
    const nestId = minecraftNest.attributes.id;
    
    // Get eggs for the nest
    const eggsRes = await fetch(`${PTERO_URL()}/api/application/nests/${nestId}/eggs`, {headers: pteroHeaders()});
    if (!eggsRes.ok) throw new Error("Failed to get eggs");
    const eggs = await eggsRes.json();
    
    // Find appropriate egg based on server type
    let selectedEgg = eggs.data.find(e => 
      e.attributes.name.toLowerCase().includes(egg.toLowerCase())
    );
    
    // Fallback to Paper, then Spigot, then any
    if (!selectedEgg) {
      selectedEgg = eggs.data.find(e => e.attributes.name.toLowerCase().includes('paper'));
    }
    if (!selectedEgg) {
      selectedEgg = eggs.data.find(e => e.attributes.name.toLowerCase().includes('spigot'));
    }
    if (!selectedEgg) {
      selectedEgg = eggs.data[0];
    }
    
    if (!selectedEgg) throw new Error("No suitable egg found");
    
    // Get locations
    const locationsRes = await fetch(`${PTERO_URL()}/api/application/locations`, {headers: pteroHeaders()});
    const locationsData = await locationsRes.json();
    const locations = locationsData.data || [];
    
    // Create server
    const serverData = {
      name: name,
      nest_id: nestId,
      egg_id: selectedEgg.attributes.id,
      location_id: location || (locations[0]?.attributes.id || 1),
      allocation_limit: 1,
      memory_limit: ram * 1024, // Convert GB to MB
      disk_limit: disk * 1024,
      cpu_limit: 100,
      environment: {
        SERVER_JARFILE: "server.jar",
        MINECRAFT_VERSION: version,
        BUILD_TYPE: "latest"
      },
      startup: selectedEgg.attributes.startup || "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
      oom_disabled: true,
      docker_image: selectedEgg.attributes.docker_image || "ghcr.io/pterodactyl/yolk:java_21"
    };
    
    const createRes = await fetch(`${PTERO_URL()}/api/application/servers`, {
      method: "POST",
      headers: pteroHeaders(),
      body: JSON.stringify(serverData)
    });
    
    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create server: ${errText}`);
    }
    
    const server = await createRes.json();
    return server.data;
  } catch (e) {
    console.error("Pterodactyl create error:", e);
    throw e;
  }
}

// Start server on Pterodactyl
export async function pteroStartServer(serverId) {
  if (!isUsingPterodactyl()) return false;
  const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/power`, {
    method: "POST",
    headers: pteroHeaders(),
    body: JSON.stringify({ signal: "start" })
  });
  return res.ok;
}

// Stop server on Pterodactyl
export async function pteroStopServer(serverId) {
  if (!isUsingPterodactyl()) return false;
  const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/power`, {
    method: "POST",
    headers: pteroHeaders(),
    body: JSON.stringify({ signal: "stop" })
  });
  return res.ok;
}

// Restart server on Pterodactyl
export async function pteroRestartServer(serverId) {
  if (!isUsingPterodactyl()) return false;
  const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/power`, {
    method: "POST",
    headers: pteroHeaders(),
    body: JSON.stringify({ signal: "restart" })
  });
  return res.ok;
}

// Delete server on Pterodactyl
export async function pteroDeleteServer(serverId) {
  if (!isUsingPterodactyl()) return false;
  const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/force`, {
    method: "DELETE",
    headers: pteroHeaders()
  });
  return res.ok;
}

// Get server status from Pterodactyl
export async function pteroGetServerStatus(serverId) {
  if (!isUsingPterodactyl()) return "offline";
  try {
    const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/resources`, {headers: pteroHeaders()});
    if (!res.ok) return "offline";
    const data = await res.json();
    const state = data.attributes?.state;
    // Pterodactyl states: 0=offline, 1=starting, 2=running, 3=stopping
    if (state === 0) return "offline";
    if (state === 1) return "starting";
    if (state === 2) return "online";
    if (state === 3) return "stopping";
    return "offline";
  } catch {
    return "offline";
  }
}

// Get server stats from Pterodactyl
export async function pteroGetStats(serverId) {
  if (!isUsingPterodactyl()) return null;
  try {
    const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/resources`, {headers: pteroHeaders()});
    if (!res.ok) return null;
    const data = await res.json();
    const attrs = data.attributes;
    const memoryBytes = attrs.resources.memory_bytes || 0;
    const maxMemory = attrs.limits.memory || 1;
    
    return {
      ram: Math.round((memoryBytes / (maxMemory * 1024 * 1024)) * 100),
      cpu: Math.round(attrs.resources.cpu_absolute * 10) || 0,
      players: attrs.resources.players || 0,
      disk: Math.round((attrs.resources.disk_bytes || 0) / (1024 * 1024 * 1024) * 100),
      networkRx: attrs.resources.network_rx_bytes || 0,
      networkTx: attrs.resources.network_tx_bytes || 0
    };
  } catch {
    return null;
  }
}

// Send command to Pterodactyl server
export async function pteroSendCommand(command, serverId) {
  if (!isUsingPterodactyl()) return false;
  
  // If no serverId provided, get first server
  if (!serverId) {
    const servers = await pteroGetServers();
    if (servers.length === 0) return false;
    serverId = servers[0].attributes.identifier;
  }
  
  const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/command`, {
    method: "POST",
    headers: pteroHeaders(),
    body: JSON.stringify({ command })
  });
  return res.ok;
}

// Get server console (websocket URL)
export async function pteroGetConsole(serverId) {
  if (!isUsingPterodactyl()) return null;
  try {
    const res = await fetch(`${PTERO_URL()}/api/application/servers/${serverId}/websocket`, {headers: pteroHeaders()});
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.attributes || null;
  } catch {
    return null;
  }
}

// Get all locations from Pterodactyl
export async function pteroGetLocations() {
  if (!isUsingPterodactyl()) return [];
  try {
    const res = await fetch(`${PTERO_URL()}/api/application/locations`, {headers: pteroHeaders()});
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

// Get all eggs from Pterodactyl
export async function pteroGetEggs() {
  if (!isUsingPterodactyl()) return [];
  try {
    const nestsRes = await fetch(`${PTERO_URL()}/api/application/nests`, {headers: pteroHeaders()});
    if (!nestsRes.ok) return [];
    const nests = await nestsRes.json();
    
    const mcNest = nests.data.find(n => 
      n.attributes.name.toLowerCase().includes('minecraft')
    );
    if (!mcNest) return [];
    
    const eggsRes = await fetch(`${PTERO_URL()}/api/application/nests/${mcNest.attributes.id}/eggs`, {headers: pteroHeaders()});
    if (!eggsRes.ok) return [];
    const eggs = await eggsRes.json();
    return eggs.data || [];
  } catch {
    return [];
  }
}
