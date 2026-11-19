// A3 test helper — staged fake OpenAI-compatible provider.
// Answers each analysis stage with valid deterministic plan JSON.
import http from "node:http";

const planStage1 = {
  objectives: [
    { title: "Launch a bilingual portfolio site", detail: null, classification: "EXPLICIT", sourceQuotes: ["bilingual portfolio site"] },
    { title: "Showcase five service pages", detail: null, classification: "EXPLICIT", sourceQuotes: ["5 pages"] },
  ],
  scope: [
    { title: "Home, about, services, contact pages", detail: null, classification: "EXPLICIT", sourceQuotes: ["5 pages"] },
    { title: "Admin panel for content", detail: null, classification: "EXPLICIT", sourceQuotes: ["admin"] },
  ],
  deliverables: [
    { title: "Deployed website", detail: null, classification: "EXPLICIT", sourceQuotes: ["portfolio site"] },
  ],
  excluded: [
    { title: "Native mobile apps", detail: null, classification: "SUGGESTION", sourceQuotes: [] },
  ],
  optionalAddons: [
    { title: "Blog section", detail: null, classification: "SUGGESTION", sourceQuotes: [] },
  ],
};

const planStage2 = {
  modules: [
    {
      name: "Design",
      classification: "EXPLICIT",
      sourceQuotes: ["portfolio site"],
      tasks: [
        {
          title: "Design system and wireframes",
          description: "Colors, type, layout grid",
          priority: "HIGH",
          estimatedDays: 2,
          classification: "EXPLICIT",
          sourceQuotes: ["portfolio site"],
          aiSuggestion: false,
          dependsOn: [],
          subtasks: [
            { title: "Moodboard", classification: "INFERRED", sourceQuotes: [] },
          ],
        },
      ],
    },
    {
      name: "Development",
      classification: "EXPLICIT",
      sourceQuotes: ["admin"],
      tasks: [
        {
          title: "Build public pages",
          description: null,
          priority: "MEDIUM",
          estimatedDays: 3,
          classification: "EXPLICIT",
          sourceQuotes: ["5 pages"],
          aiSuggestion: false,
          dependsOn: ["Design system and wireframes"],
          subtasks: [],
        },
        {
          title: "Build admin panel",
          description: null,
          priority: "HIGH",
          estimatedDays: 4,
          classification: "EXPLICIT",
          sourceQuotes: ["admin"],
          aiSuggestion: false,
          dependsOn: [],
          subtasks: [
            { title: "Auth", classification: "INFERRED", sourceQuotes: [] },
            { title: "Content editor", classification: "INFERRED", sourceQuotes: [] },
          ],
        },
        {
          title: "Performance audit",
          description: null,
          priority: "LOW",
          estimatedDays: 1,
          classification: "SUGGESTION",
          sourceQuotes: [],
          aiSuggestion: true,
          dependsOn: [],
          subtasks: [],
        },
      ],
    },
  ],
};

const planStage3 = {
  milestones: [
    { title: "Design approved", afterDays: 2, classification: "INFERRED", sourceQuotes: [] },
    { title: "Site launched", afterDays: 10, classification: "INFERRED", sourceQuotes: [] },
  ],
  risks: [
    { title: "Content delay from client", detail: null, classification: "INFERRED", sourceQuotes: [] },
  ],
  assumptions: [
    { title: "Hosting provided by client", detail: null, classification: "SUGGESTION", sourceQuotes: [] },
  ],
  missingInfo: [
    { title: "Brand assets availability", detail: null, classification: "SUGGESTION", sourceQuotes: [] },
  ],
};


const sowPlan = {
  introduction: "This Scope of Work covers a bilingual portfolio website with an admin panel.",
  objectives: [
    { text: "Launch a bilingual portfolio site", sourceQuotes: ["bilingual portfolio site"] },
    { text: "Provide content management via admin", sourceQuotes: ["admin"] },
  ],
  included: [
    { text: "Five public pages (home, about, services, contact, admin)", sourceQuotes: ["5 pages"] },
    { text: "Admin panel for content", sourceQuotes: ["admin"] },
  ],
  deliverables: [
    { text: "Deployed bilingual website", sourceQuotes: ["portfolio site"] },
    { text: "Admin credentials and handover", sourceQuotes: [] },
  ],
  excluded: [
    { text: "Native mobile applications", sourceQuotes: [] },
  ],
  assumptions: [
    { text: "Client provides branding assets", sourceQuotes: [] },
  ],
  clarifications: [
    { text: "Which hosting provider should be used?", sourceQuotes: [] },
  ],
  optionalAddons: [
    { text: "Blog module", sourceQuotes: [] },
  ],
  timelineNote: "Approximately 10 working days after content handover.",
  paymentNote: "",
};

const singleModule = planStage2.modules[0];

const splitPlan = { proposals: [
  { title: "Gather page content" },
  { title: "Draft page layouts" },
  { title: "Review with client" },
] };

function pickStage(prompt) {
  if (prompt.includes("review-first proposal")) return "split";
  if (prompt.includes("project assistant")) return "chat";
  if (prompt.includes("Scope of Work")) return "sow";
  if (prompt.includes("Module to re-plan")) return "module";
  if (prompt.includes("Extract ONLY these fields")) return "stage1";
  if (prompt.includes('"milestones"') && prompt.includes("risks")) return "stage3";
  if (prompt.includes('"modules"')) return "stage2";
  return "chat";
}

const server = http.createServer((req, res) => {
  if (!req.url.endsWith("/chat/completions")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }
  const auth = req.headers.authorization ?? "";
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (auth !== "Bearer test-key-123") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Invalid API key" } }));
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "bad json" } }));
      return;
    }
    const prompt = (parsed.messages ?? [])
      .map((m) => m.content ?? "")
      .join("\n");
    const stage = pickStage(prompt);
    const content =
      stage === "split"
        ? JSON.stringify(splitPlan)
        : stage === "sow"
        ? JSON.stringify(sowPlan)
        : stage === "stage1"
        ? JSON.stringify(planStage1)
        : stage === "stage2"
          ? JSON.stringify(planStage2)
          : stage === "stage3"
            ? JSON.stringify(planStage3)
            : stage === "module"
              ? JSON.stringify(singleModule)
              : "OK";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { role: "assistant", content } }],
      }),
    );
  });
});

server.listen(5999, () => console.log("a3 fake provider listening on 5999"));
