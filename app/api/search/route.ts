import { NextRequest, NextResponse } from "next/server";
import { getData } from "@/lib/db";

interface SearchResult {
  id: string;
  title: string;
  type: string;
  snippet: string;
}

function getSnippet(text: string, query: string, maxLength = 120): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, maxLength);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  let snippet = text.slice(start, end).replace(/\n/g, " ");
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

function matches(text: string | undefined, query: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({
      tasks: [],
      docs: [],
      memories: [],
      bugs: [],
      projects: [],
    });
  }

  const data = await getData();
  const query = q.toLowerCase();

  // Search tasks (title, description)
  const tasks: SearchResult[] = [];
  for (const task of data.tasks) {
    if (tasks.length >= 5) break;
    if (matches(task.title, query) || matches(task.description, query)) {
      const matchField = matches(task.title, query)
        ? task.title
        : task.description;
      tasks.push({
        id: task.id,
        title: task.title,
        type: "task",
        snippet: getSnippet(matchField, q),
      });
    }
  }

  // Search docs (title, content)
  const docs: SearchResult[] = [];
  for (const doc of data.docs) {
    if (docs.length >= 5) break;
    if (matches(doc.title, query) || matches(doc.content, query)) {
      const matchField = matches(doc.title, query)
        ? doc.title
        : doc.content;
      docs.push({
        id: doc.id,
        title: doc.title,
        type: "doc",
        snippet: getSnippet(matchField, q),
      });
    }
  }

  // Search memories (conversation + long-term, title and content)
  const memories: SearchResult[] = [];
  for (const mem of data.conversationMemories) {
    if (memories.length >= 5) break;
    if (matches(mem.title, query) || matches(mem.content, query)) {
      const matchField = matches(mem.title, query)
        ? mem.title
        : mem.content;
      memories.push({
        id: mem.id,
        title: mem.title,
        type: "memory",
        snippet: getSnippet(matchField, q),
      });
    }
  }
  for (const mem of data.longTermMemories) {
    if (memories.length >= 5) break;
    if (matches(mem.title, query) || matches(mem.content, query)) {
      const matchField = matches(mem.title, query)
        ? mem.title
        : mem.content;
      memories.push({
        id: mem.id,
        title: mem.title,
        type: "memory",
        snippet: getSnippet(matchField, q),
      });
    }
  }

  // Search bugs (title, stepsToReproduce)
  const bugs: SearchResult[] = [];
  for (const bug of data.bugs) {
    if (bugs.length >= 5) break;
    if (matches(bug.title, query) || matches(bug.stepsToReproduce, query)) {
      const matchField = matches(bug.title, query)
        ? bug.title
        : bug.stepsToReproduce;
      bugs.push({
        id: bug.id,
        title: bug.title,
        type: "bug",
        snippet: getSnippet(matchField, q),
      });
    }
  }

  // Search projects (name, description)
  const projects: SearchResult[] = [];
  for (const project of data.projects) {
    if (projects.length >= 5) break;
    if (matches(project.name, query) || matches(project.description, query) || matches(project.goal, query) || matches(project.desiredOutcome, query)) {
      const matchField = matches(project.name, query)
        ? project.name
        : matches(project.description, query)
        ? project.description
        : matches(project.goal, query)
        ? project.goal!
        : project.desiredOutcome!;
      projects.push({
        id: project.id,
        title: project.name,
        type: "project",
        snippet: getSnippet(matchField, q),
      });
    }
  }

  return NextResponse.json({ tasks, docs, memories, bugs, projects });
}
