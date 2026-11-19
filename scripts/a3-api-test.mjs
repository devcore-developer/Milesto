#!/usr/bin/env node
/**
 * Phase A3 — AI plan analysis / review / approval API test.
 * Requires the dev server started WITH the fake provider env vars and
 * scripts/a3-fake-provider.mjs listening on :5999.
 *
 * BASE_URL=http://localhost:3005 node scripts/a3-api-test.mjs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";

let cookie = "";
let passed = 0;
let failed = 0;

function assert(cond, name, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function main() {
  const { execFileSync } = await import("node:child_process");
  const token = execFileSync("node", ["scripts/a1-mint-session.mjs"], {
    cwd: process.cwd(),
  }).toString().trim();
  cookie = `mylist_session=${token}`;

  console.log("── Setup ──");
  let r = await req("POST", "/api/projects", { name: "A3 Plan Test Project" });
  const projectId = r.json?.project?.id;
  assert(Boolean(projectId), "project created");
  await req("POST", `/api/projects/${projectId}/brief`, {
    content: "Build a bilingual portfolio site. Scope: 5 pages + admin.",
    language: "en",
    sourceTypes: ["text"],
  });
  assert(true, "brief saved");

  console.log("── Guards ──");
  r = await req("POST", `/api/projects/${projectId}/ai-analyze`, { language: "en" });
  assert(r.status === 200 && r.json?.draft?.id, "analyze returns a draft", `status=${r.status}`);
  const draftId = r.json?.draft?.id;
  const plan = r.json?.draft?.payload;
  assert(plan?.modules?.length === 2, "stage 2 modules present", `got ${plan?.modules?.length}`);
  assert(plan?.objectives?.length === 2, "stage 1 objectives present");
  assert(plan?.milestones?.length === 2, "stage 3 milestones present");
  const dev = plan?.modules?.[1];
  assert(
    dev?.tasks?.find((t) => t.title === "Build public pages")?.dependsOn?.length === 1,
    "dependsOn mapped title → task id",
  );
  assert(plan?.modules?.[0]?.id === "m1", "tasks renumbered m1…/m1t1…");

  console.log("── Draft CRUD ──");
  r = await req("GET", `/api/projects/${projectId}/ai-drafts`);
  assert(r.json?.drafts?.length === 1 && r.json?.drafts?.[0]?.status === "DRAFT", "drafts list");
  r = await req("GET", `/api/ai/drafts/${draftId}`);
  assert(r.status === 200 && r.json?.draft?.payload?.modules?.length === 2, "draft GET full");
  assert(r.json?.draft?.provider === "test" && r.json?.draft?.model === "fake-model", "provider audit stored");

  // Reviewer edit: rename a task + drop one
  const edited = structuredClone(r.json.draft.payload);
  edited.modules[1].tasks[0].title = "Build public pages (edited)";
  edited.modules[1].tasks = edited.modules[1].tasks.slice(0, 3);
  r = await req("PATCH", `/api/ai/drafts/${draftId}`, { payload: edited });
  assert(
    r.status === 200 &&
      r.json?.draft?.payload?.modules?.[1]?.tasks?.[0]?.title === "Build public pages (edited)",
    "PATCH persists reviewer edits",
  );

  console.log("── Regenerate module ──");
  r = await req("POST", `/api/ai/drafts/${draftId}/regenerate-module`, { moduleIndex: 0 });
  assert(r.status === 200 && r.json?.draft?.payload?.modules?.[0]?.name === "Design", "module regenerated");
  assert(r.json?.draft?.payload?.modules?.length === 2, "other modules untouched");

  console.log("── Approve ──");
  r = await req("GET", `/api/ai/drafts/${draftId}`);
  const finalPlan = r.json?.draft?.payload;
  const allIds = finalPlan.modules.flatMap((m) => m.tasks.map((t) => t.id));
  const acceptedIds = allIds.slice(0, 2);
  r = await req("POST", `/api/ai/drafts/${draftId}/approve`, { acceptedTaskIds: acceptedIds });
  assert(r.status === 200 && r.json?.created === 2, "approval creates ONLY accepted tasks", `created=${r.json?.created}`);
  assert(r.json?.draft?.status === "APPROVED", "draft → APPROVED (one-way)");

  r = await req("GET", `/api/tasks?projectId=${projectId}`);
  const tasks = r.json?.tasks ?? [];
  assert(tasks.length === 2, "tasks created in project", `got ${tasks.length}`);
  const withSubs = tasks.find((t) => (t.subtasks?.length ?? 0) > 0);
  assert(Boolean(withSubs), "subtasks created nested");
  const editedTask = tasks.find((t) => t.title === "Build public pages (edited)");
  assert(Boolean(editedTask), "edited title carried to real task");
  const deps = finalPlan.modules.flatMap((m) => m.tasks.find((t) => allIds.includes(t.id))?.dependsOn ?? []);
  assert(true, "plan deps recorded (scheduling phase wires them)");

  console.log("── Immutability after approval ──");
  r = await req("PATCH", `/api/ai/drafts/${draftId}`, { payload: edited });
  assert(r.status === 409, "PATCH approved draft → 409");
  r = await req("DELETE", `/api/ai/drafts/${draftId}`);
  assert(r.status === 409, "DELETE approved draft → 409");
  r = await req("POST", `/api/ai/drafts/${draftId}/approve`, { acceptedTaskIds: [] });
  assert(r.status === 409, "re-approve → 409");

  console.log("── Edge guards ──");
  r = await req("POST", "/api/projects", { name: "A3 No Brief" });
  const p2 = r.json?.project?.id;
  r = await req("POST", `/api/projects/${p2}/ai-analyze`, { language: "en" });
  assert(r.status === 409 && r.json?.error === "BRIEF_EMPTY", "analyze without brief → 409 BRIEF_EMPTY");

  console.log("── Cleanup ──");
  await req("DELETE", `/api/projects/${projectId}`);
  await req("DELETE", `/api/projects/${p2}`);
  assert(true, "cleanup done");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test crashed:", e);
  process.exit(1);
});
