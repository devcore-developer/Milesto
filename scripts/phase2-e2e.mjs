// Phase 2 E2E — exercises every projects/timeline API surface.
// Usage: BASE_URL=http://localhost:3005 node scripts/phase2-e2e.mjs
// Prints PASS/FAIL per step, exits 1 on failure.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TIMEOUT_MS = 20_000;
let cookie = "";
let failures = 0;

function check(name, cond, extra = "") {
  if (cond) console.log(`PASS ${name}`);
  else {
    failures++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const dayIso = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.toISOString().slice(0, 10)}T12:00:00.000Z`;
};

async function main() {
  const started = Date.now();
  const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
  // wait for server (max 45s)
  let state = null;
  for (let i = 0; i < 45; i++) {
    try {
      const r = await api("GET", "/api/auth/state");
      state = r.json;
      if (r.status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  check(`server up (${elapsed()})`, !!state);
  check("needsSetup", state?.needsSetup === true, JSON.stringify(state));

  // setup owner
  let r = await api("POST", "/api/auth/setup", {
    name: "Phase Two Tester", email: "p2@test.local", password: "Passw0rd!X",
  });
  check("setup 200", r.status === 200, JSON.stringify(r.json));

  // category + tasks
  r = await api("POST", "/api/categories", { name: "P2Cat" });
  check("category created", r.status === 201, JSON.stringify(r.json));
  const catId = r.json?.category?.id;

  const mkTask = async (title) => {
    const res = await api("POST", "/api/tasks", { title });
    return res.json?.task;
  };
  const taskA = await mkTask("Design homepage");
  const taskB = await mkTask("Build components");
  const taskC = await mkTask("Standalone task");
  check("tasks created", !!taskA && !!taskB && !!taskC);

  // create project P1
  r = await api("POST", "/api/projects", {
    name: "Website Redesign",
    description: "Full revamp of the company website",
    status: "ACTIVE",
    priority: "HIGH",
    startDate: dayIso(-10),
    deadline: dayIso(20),
  });
  check("project created", r.status === 201, JSON.stringify(r.json));
  const p1 = r.json?.project;
  check("P1 defaults", p1?.taskTotal === 0 && p1?.progressPct === 0 && p1?.overdue === false);
  check("P1 daysRemaining ~20", p1?.daysRemaining >= 19 && p1?.daysRemaining <= 21, String(p1?.daysRemaining));

  // validation error
  r = await api("POST", "/api/projects", { name: "" });
  check("validation 400", r.status === 400 && r.json?.error === "VALIDATION");

  // unauthorized
  const saved = cookie; cookie = "";
  r = await api("GET", "/api/projects");
  check("unauth 401", r.status === 401);
  cookie = saved;

  // link tasks A & B
  r = await api("PATCH", `/api/tasks/${taskA.id}`, { projectId: p1.id });
  check("link taskA", r.status === 200 && r.json?.task?.projectId === p1.id);
  r = await api("PATCH", `/api/tasks/${taskB.id}`, { projectId: p1.id });
  check("link taskB", r.status === 200 && r.json?.task?.project?.name === "Website Redesign");

  // invalid project id rejected
  r = await api("PATCH", `/api/tasks/${taskC.id}`, { projectId: "nonexistent" });
  check("invalid project 400", r.status === 400 && r.json?.error === "PROJECT_NOT_FOUND");

  // detail: 2 tasks
  r = await api("GET", `/api/projects/${p1.id}`);
  let proj = r.json?.project;
  check("detail taskTotal 2", proj?.taskTotal === 2, JSON.stringify(proj?.taskTotal));
  check("detail has tasks array", Array.isArray(proj?.tasks) && proj.tasks.length === 2);

  // complete task A → 50%
  await api("PATCH", `/api/tasks/${taskA.id}`, { status: "COMPLETED" });
  r = await api("GET", "/api/projects");
  proj = r.json?.projects?.find((p) => p.id === p1.id);
  check("progress 50", proj?.progressPct === 50 && proj?.taskDone === 1, JSON.stringify({ d: proj?.taskDone, t: proj?.taskTotal }));

  // create task directly inside project
  r = await api("POST", "/api/tasks", { title: "Polish UI", projectId: p1.id });
  check("create task in project", r.status === 201 && r.json?.task?.projectId === p1.id);
  const taskD = r.json?.task;

  // filters
  r = await api("GET", "/api/projects?status=ACTIVE");
  check("filter status=ACTIVE → 1", r.json?.projects?.length === 1);
  r = await api("GET", "/api/projects?q=redesign");
  check("search q=redesign → 1", r.json?.projects?.length === 1);
  r = await api("GET", "/api/projects?priority=LOW");
  check("filter priority=LOW → 0", r.json?.projects?.length === 0);

  // overdue project P2
  r = await api("POST", "/api/projects", {
    name: "Late Project", status: "ACTIVE", deadline: dayIso(-3), startDate: dayIso(-30),
  });
  const p2 = r.json?.project;
  check("P2 overdue", p2?.overdue === true && p2?.daysRemaining < 0, JSON.stringify(p2));

  // update P1
  r = await api("PATCH", `/api/projects/${p1.id}`, { name: "Website Redesign v2", status: "ON_HOLD" });
  check("update project", r.status === 200 && r.json?.project?.name === "Website Redesign v2" && r.json?.project?.status === "ON_HOLD");

  // unlink taskB
  r = await api("PATCH", `/api/tasks/${taskB.id}`, { projectId: null });
  check("unlink taskB", r.status === 200 && r.json?.task?.projectId === null);
  r = await api("GET", `/api/projects/${p1.id}`);
  check("after unlink total 2", r.json?.project?.taskTotal === 2);

  // notes update
  r = await api("PATCH", `/api/projects/${p1.id}`, { notes: "Client prefers dark blue" });
  check("notes saved", r.json?.project?.notes === "Client prefers dark blue");

  // logout / login
  await api("POST", "/api/auth/logout");
  r = await api("GET", "/api/projects");
  check("after logout 401", r.status === 401);
  r = await api("POST", "/api/auth/login", { email: "p2@test.local", password: "Passw0rd!X" });
  check("login again", r.status === 200);

  // delete P1 & P2 — tasks survive
  r = await api("DELETE", `/api/projects/${p1.id}`);
  check("delete P1", r.status === 200);
  r = await api("DELETE", `/api/projects/${p2.id}`);
  check("delete P2", r.status === 200);
  r = await api("GET", `/api/projects/${p1.id}`);
  check("P1 gone 404", r.status === 404);
  r = await api("GET", "/api/tasks");
  const titles = (r.json?.tasks ?? []).map((t) => t.title);
  check("tasks kept after project delete", titles.includes("Design homepage"), JSON.stringify(titles));
  check("kept tasks unlinked", (r.json?.tasks ?? []).every((t) => t.projectId === null));

  // delete task D
  await api("DELETE", `/api/tasks/${taskD.id}`);

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("SCRIPT ERROR", e); process.exit(1); });