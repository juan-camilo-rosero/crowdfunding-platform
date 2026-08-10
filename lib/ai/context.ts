import { formatCurrency, formatDate } from "@/lib/format";

/**
 * Builds the data the assistant is allowed to talk about.
 *
 * THIS FILE IS THE SECURITY BOUNDARY OF THE CHAT. Two rules make it work, and
 * neither is negotiable:
 *
 *  1. `investorIds` is derived on the SERVER from auth.uid() — never from the
 *     request body. The route handler resolves it with `resolveInvestorIds`
 *     below and passes it in. A client that puts an investor_id, a project id
 *     or a whole "context" object in its payload is ignored: the schema in
 *     lib/ai/chat-request.ts strips it, and nothing here reads the request.
 *  2. Every query runs under the caller's own session, so RLS filters it a
 *     second time. No service role is used anywhere in this feature — it would
 *     bypass the only barrier standing between one investor and another's data.
 *
 * The consequence: there is no path by which another investor's rows enter the
 * conversation. The model cannot leak what was never put in front of it.
 */

/** Minimal shape of the Supabase client this module needs. Keeps it mockable. */
type QueryBuilder = {
  select: (columns: string) => QueryBuilder;
  eq: (column: string, value: unknown) => QueryBuilder;
  in: (column: string, values: unknown[]) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  then: Promise<{ data: unknown[] | null; error: unknown }>["then"];
};

export type ChatContextClient = {
  from: (table: string) => QueryBuilder;
};

/** Caps, so a large portfolio cannot blow up the prompt. */
const MAX_TRANSACTIONS = 40;
const MAX_DOCUMENTS = 30;
const MAX_CATALOG_PROJECTS = 40;

export type ContextPosition = {
  projectId: string;
  projectName: string;
  status: string | null;
  progress: number | null;
  currentCapital: number;
  contributed: number;
  returnedCapital: number;
  yieldReceived: number;
  /** Free text, quoted verbatim — never normalised (CLAUDE.md). */
  agreedReturn: string | null;
  capitalType: string | null;
};

export type ContextTransaction = {
  date: string | null;
  type: string | null;
  amount: number;
  projectName: string | null;
};

export type ContextDocument = {
  name: string;
  docType: string | null;
  date: string | null;
  projectName: string | null;
};

export type ContextRequest = {
  amount: number;
  status: string | null;
  requestedAt: string | null;
  fromProjectName: string | null;
  toProjectName: string | null;
};

export type ContextCatalogProject = {
  name: string;
  city: string | null;
  type: string | null;
  status: string | null;
  progress: number | null;
  inFundraising: boolean;
};

export type InvestorChatContext = {
  positions: ContextPosition[];
  transactions: ContextTransaction[];
  documents: ContextDocument[];
  requests: ContextRequest[];
  /** PUBLIC portfolio data. Available to everyone; not private to anybody. */
  catalog: ContextCatalogProject[];
  totals: {
    currentCapital: number;
    contributed: number;
    returnedCapital: number;
    yieldReceived: number;
    activeProjects: number;
  };
};

export const EMPTY_CHAT_CONTEXT: InvestorChatContext = {
  positions: [],
  transactions: [],
  documents: [],
  requests: [],
  catalog: [],
  totals: {
    currentCapital: 0,
    contributed: 0,
    returnedCapital: 0,
    yieldReceived: 0,
    activeProjects: 0,
  },
};

/**
 * The investor rows linked to this user id.
 *
 * The explicit user_id filter matters: RLS lets an admin read every `investors`
 * row, so without it an admin would pull the whole platform into their prompt.
 *
 * lib/auth/session.ts has a cached version of this, but it is bound to the
 * cookie client. The chat endpoint also serves Bearer tokens, so it needs one
 * that takes whichever client the request produced.
 */
export async function resolveInvestorIds(
  client: ChatContextClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await client
    .from("investors")
    .select("id")
    .eq("user_id", userId);

  if (error || !data) return [];
  return (data as { id: string }[]).map((row) => row.id);
}

const num = (value: unknown): number => Number(value ?? 0) || 0;

type RawProject = {
  id: string;
  name: string | null;
  city: string | null;
  type: string | null;
  status: string | null;
  progress: number | null;
  in_fundraising: boolean | null;
};

/**
 * Everything the assistant may cite, for ONE investor.
 *
 * `investorIds` MUST come from the session. An empty array short-circuits to
 * the public catalogue rather than querying without a scope — which is exactly
 * what would leak everything.
 */
export async function buildInvestorContext(
  client: ChatContextClient,
  investorIds: string[]
): Promise<InvestorChatContext> {
  // The catalogue is public and useful even with no position, so it is fetched
  // either way.
  const projectsResult = await client
    .from("projects")
    .select("id, name, city, type, status, progress, in_fundraising")
    .order("name", { ascending: true })
    .limit(MAX_CATALOG_PROJECTS);

  const projects = (projectsResult.data ?? []) as RawProject[];
  const projectNames = new Map(
    projects.map((project) => [project.id, project.name ?? "Proyecto sin nombre"])
  );

  const catalog: ContextCatalogProject[] = projects.map((project) => ({
    name: project.name ?? "Proyecto sin nombre",
    city: project.city,
    type: project.type,
    status: project.status,
    progress: project.progress,
    inFundraising: !!project.in_fundraising,
  }));

  if (investorIds.length === 0) {
    return { ...EMPTY_CHAT_CONTEXT, catalog };
  }

  // One parallel batch: these do not depend on each other.
  const [positionsResult, contributionsResult, transactionsResult, documentsResult, requestsResult] =
    await Promise.all([
      client
        .from("investor_project_position")
        .select(
          "project_id, contributed, current_capital, returned_capital, yield_received"
        )
        .in("investor_id", investorIds),
      // The agreed return lives here and is quoted verbatim.
      client
        .from("capital_contributions")
        .select("project_id, agreed_return, capital_type")
        .in("investor_id", investorIds),
      client
        .from("transactions")
        .select("date, type, amount, project_id")
        .in("investor_id", investorIds)
        .order("date", { ascending: false })
        .limit(MAX_TRANSACTIONS),
      // Metadata only — never a file URL, never contents.
      client
        .from("documents")
        .select("name, doc_type, date, project_id")
        .order("date", { ascending: false })
        .limit(MAX_DOCUMENTS),
      client
        .from("reassignment_requests")
        .select("amount, status, requested_at, from_project_id, to_project_id")
        .in("investor_id", investorIds)
        .order("requested_at", { ascending: false }),
    ]);

  // Agreed return and capital type, per project.
  const termsByProject = new Map<string, { agreedReturn: string | null; capitalType: string | null }>();
  for (const row of (contributionsResult.data ?? []) as {
    project_id: string | null;
    agreed_return: string | null;
    capital_type: string | null;
  }[]) {
    if (!row.project_id || termsByProject.has(row.project_id)) continue;
    termsByProject.set(row.project_id, {
      agreedReturn: row.agreed_return,
      capitalType: row.capital_type,
    });
  }

  const positions: ContextPosition[] = [];
  for (const row of (positionsResult.data ?? []) as {
    project_id: string | null;
    contributed: number | string | null;
    current_capital: number | string | null;
    returned_capital: number | string | null;
    yield_received: number | string | null;
  }[]) {
    if (!row.project_id) continue;
    const project = projects.find((candidate) => candidate.id === row.project_id);
    const terms = termsByProject.get(row.project_id);

    positions.push({
      projectId: row.project_id,
      projectName: projectNames.get(row.project_id) ?? "Proyecto sin nombre",
      status: project?.status ?? null,
      progress: project?.progress ?? null,
      currentCapital: num(row.current_capital),
      contributed: num(row.contributed),
      returnedCapital: num(row.returned_capital),
      yieldReceived: num(row.yield_received),
      agreedReturn: terms?.agreedReturn ?? null,
      capitalType: terms?.capitalType ?? null,
    });
  }

  positions.sort((a, b) => b.currentCapital - a.currentCapital);

  const transactions: ContextTransaction[] = (
    (transactionsResult.data ?? []) as {
      date: string | null;
      type: string | null;
      amount: number | string | null;
      project_id: string | null;
    }[]
  ).map((row) => ({
    date: row.date,
    type: row.type,
    amount: num(row.amount),
    projectName: row.project_id ? (projectNames.get(row.project_id) ?? null) : null,
  }));

  const documents: ContextDocument[] = (
    (documentsResult.data ?? []) as {
      name: string | null;
      doc_type: string | null;
      date: string | null;
      project_id: string | null;
    }[]
  ).map((row) => ({
    name: row.name ?? "Documento",
    docType: row.doc_type,
    date: row.date,
    projectName: row.project_id ? (projectNames.get(row.project_id) ?? null) : null,
  }));

  const requests: ContextRequest[] = (
    (requestsResult.data ?? []) as {
      amount: number | string | null;
      status: string | null;
      requested_at: string | null;
      from_project_id: string | null;
      to_project_id: string | null;
    }[]
  ).map((row) => ({
    amount: num(row.amount),
    status: row.status,
    requestedAt: row.requested_at,
    fromProjectName: row.from_project_id
      ? (projectNames.get(row.from_project_id) ?? null)
      : null,
    toProjectName: row.to_project_id
      ? (projectNames.get(row.to_project_id) ?? null)
      : null,
  }));

  const totals = positions.reduce(
    (accumulator, position) => ({
      currentCapital: accumulator.currentCapital + position.currentCapital,
      contributed: accumulator.contributed + position.contributed,
      returnedCapital: accumulator.returnedCapital + position.returnedCapital,
      yieldReceived: accumulator.yieldReceived + position.yieldReceived,
      activeProjects:
        accumulator.activeProjects + (position.currentCapital > 0 ? 1 : 0),
    }),
    { ...EMPTY_CHAT_CONTEXT.totals }
  );

  return { positions, transactions, documents, requests, catalog, totals };
}

/** The name of the project this investor has most capital in, if any. */
export function primaryProjectName(context: InvestorChatContext): string | null {
  return context.positions[0]?.projectName ?? null;
}

const NONE = "(ninguno)";

/**
 * Renders the context as plain text for the prompt.
 *
 * Figures are pre-formatted with the project's own helpers so the model never
 * has to compute or reformat a number — the fastest way to a wrong figure would
 * be to hand it raw decimals and hope.
 */
export function renderInvestorContext(context: InvestorChatContext): string {
  const lines: string[] = [];

  lines.push("== RESUMEN DE SU POSICIÓN ==");
  if (context.positions.length === 0) {
    lines.push(
      "Este usuario no tiene capital en ningún proyecto todavía. Dilo tal cual si pregunta; no es un error."
    );
  } else {
    lines.push(`Invertido actualmente: ${formatCurrency(context.totals.currentCapital)}`);
    lines.push(`Total aportado históricamente: ${formatCurrency(context.totals.contributed)}`);
    lines.push(`Capital devuelto: ${formatCurrency(context.totals.returnedCapital)}`);
    lines.push(`Rendimiento recibido: ${formatCurrency(context.totals.yieldReceived)}`);
    lines.push(`Proyectos con capital vigente: ${context.totals.activeProjects}`);
  }

  lines.push("", "== SUS PROYECTOS ==");
  if (context.positions.length === 0) {
    lines.push(NONE);
  } else {
    for (const position of context.positions) {
      const details = [
        `estado: ${position.status ?? "sin dato"}`,
        `avance de obra: ${position.progress ?? "sin dato"}%`,
        `capital vigente: ${formatCurrency(position.currentCapital)}`,
        `aportado: ${formatCurrency(position.contributed)}`,
        `devuelto: ${formatCurrency(position.returnedCapital)}`,
        `rendimiento recibido: ${formatCurrency(position.yieldReceived)}`,
        // Verbatim: "15% anual", "Participación 8%". Never converted.
        `retorno pactado: ${position.agreedReturn ?? "sin dato"}`,
        `tipo de capital: ${position.capitalType ?? "sin dato"}`,
      ].join(" · ");
      lines.push(`- ${position.projectName} — ${details}`);
    }
  }

  lines.push("", "== SUS MOVIMIENTOS (los más recientes) ==");
  if (context.transactions.length === 0) {
    lines.push(NONE);
  } else {
    for (const transaction of context.transactions) {
      lines.push(
        `- ${transaction.date ? formatDate(transaction.date) : "sin fecha"} · ${
          transaction.type ?? "sin tipo"
        } · ${formatCurrency(transaction.amount)} · ${
          transaction.projectName ?? "sin proyecto"
        }`
      );
    }
  }

  lines.push("", "== SUS SOLICITUDES DE REASIGNACIÓN ==");
  if (context.requests.length === 0) {
    lines.push(NONE);
  } else {
    for (const request of context.requests) {
      lines.push(
        `- ${request.requestedAt ? formatDate(request.requestedAt) : "sin fecha"} · ${formatCurrency(
          request.amount
        )} · de ${request.fromProjectName ?? "sin dato"} a ${
          request.toProjectName ?? "sin dato"
        } · estado: ${request.status ?? "sin dato"}`
      );
    }
  }

  lines.push(
    "",
    "== SUS DOCUMENTOS (solo nombres; no puedes abrirlos ni enviarlos) =="
  );
  if (context.documents.length === 0) {
    lines.push(NONE);
  } else {
    for (const document of context.documents) {
      lines.push(
        `- ${document.name} · ${document.docType ?? "sin tipo"} · ${
          document.date ? formatDate(document.date) : "sin fecha"
        } · ${document.projectName ?? "sin proyecto"}`
      );
    }
  }

  lines.push("", "== PORTAFOLIO PÚBLICO DE INVESTORS 180 ==");
  if (context.catalog.length === 0) {
    lines.push(NONE);
  } else {
    for (const project of context.catalog) {
      lines.push(
        `- ${project.name} · ${project.city ?? "sin ciudad"} · ${
          project.type ?? "sin tipo"
        } · estado: ${project.status ?? "sin dato"} · avance: ${
          project.progress ?? "sin dato"
        }%${project.inFundraising ? " · EN CAPTACIÓN" : ""}`
      );
    }
  }

  return lines.join("\n");
}
