const OWNER = import.meta.env.VITE_GITHUB_OWNER;
const REPO = import.meta.env.VITE_GITHUB_REPO;
const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

// ── Trigger a workflow (start/stop/backup) ───────────────────────────────────
export async function triggerWorkflow(workflow, inputs = {}) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ ref: "main", inputs }),
    }
  );
  if (!res.ok) throw new Error(`Failed to trigger ${workflow}: ${res.status}`);
  return true;
}

// ── Get all workflow runs ────────────────────────────────────────────────────
export async function getWorkflowRuns(workflow) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${workflow}/runs?per_page=5`,
    { headers }
  );
  const data = await res.json();
  return data.workflow_runs || [];
}

// ── Get logs for a run ───────────────────────────────────────────────────────
export async function getRunLogs(runId) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/logs`,
    { headers }
  );
  if (!res.ok) return null;
  // Returns a zip — we get the redirect URL instead
  return res.url;
}

// ── Cancel a run (stop server) ───────────────────────────────────────────────
export async function cancelRun(runId) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/cancel`,
    { method: "POST", headers }
  );
  return res.status === 202;
}

// ── Get jobs for a run (for live console output) ─────────────────────────────
export async function getRunJobs(runId) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/runs/${runId}/jobs`,
    { headers }
  );
  const data = await res.json();
  return data.jobs || [];
}

// ── Get step logs (console output) ──────────────────────────────────────────
export async function getJobLogs(jobId) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/jobs/${jobId}/logs`,
    { headers }
  );
  if (!res.ok) return "";
  return await res.text();
}

// ── List files in repo ───────────────────────────────────────────────────────
export async function listFiles(path = "") {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { headers }
  );
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ── Get file content ─────────────────────────────────────────────────────────
export async function getFile(path) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    { headers }
  );
  const data = await res.json();
  return {
    content: atob(data.content.replace(/\n/g, "")),
    sha: data.sha,
  };
}

// ── Save file content ────────────────────────────────────────────────────────
export async function saveFile(path, content, sha, message = "Update file") {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message,
        content: btoa(content),
        sha,
      }),
    }
  );
  return res.ok;
}

// ── Get server status from latest run ───────────────────────────────────────
export async function getServerStatus() {
  const runs = await getWorkflowRuns("start-server.yml");
  if (!runs.length) return { status: "offline", runId: null };
  const latest = runs[0];
  if (latest.status === "in_progress" || latest.status === "queued") {
    return { status: latest.status === "queued" ? "starting" : "online", runId: latest.id };
  }
  return { status: "offline", runId: null };
}
