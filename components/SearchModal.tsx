"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  SearchIcon,
  TaskboardIcon,
  DocsIcon,
  MemoriesIcon,
  BugsIcon,
  ProjectsIcon,
  CloseIcon,
} from "@/components/icons";

interface SearchResult {
  id: string;
  title: string;
  type: string;
  snippet: string;
}

interface SearchResults {
  tasks: SearchResult[];
  docs: SearchResult[];
  memories: SearchResult[];
  bugs: SearchResult[];
  projects: SearchResult[];
}

const emptyResults: SearchResults = {
  tasks: [],
  docs: [],
  memories: [],
  bugs: [],
  projects: [],
};

const categoryConfig: {
  key: keyof SearchResults;
  label: string;
  icon: typeof SearchIcon;
  href: string;
}[] = [
  { key: "tasks", label: "Tasks", icon: TaskboardIcon, href: "/taskboard" },
  { key: "docs", label: "Docs", icon: DocsIcon, href: "/docs" },
  { key: "memories", label: "Memories", icon: MemoriesIcon, href: "/memories" },
  { key: "bugs", label: "Bugs", icon: BugsIcon, href: "/bugs" },
  { key: "projects", label: "Projects", icon: ProjectsIcon, href: "/projects" },
];

export default function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Open/close with Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults(emptyResults);
    }
  }, [open]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults(emptyResults);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    search(val);
  }

  function handleNavigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  }

  const hasResults = categoryConfig.some(
    (cat) => results[cat.key].length > 0
  );

  if (!open) return null;

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        className="bg-surface border-border"
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 12,
          border: "1px solid",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <SearchIcon size={18} className="text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search across tasks, docs, memories, bugs, projects..."
            className="text-text"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 15,
              color: "inherit",
            }}
          />
          <button
            onClick={() => setOpen(false)}
            className="text-text-muted"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              color: "inherit",
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Results area */}
        <div
          style={{
            maxHeight: 400,
            overflowY: "auto",
            padding: query.length >= 2 ? "8px 0" : 0,
          }}
        >
          {loading && (
            <div
              className="text-text-muted"
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              Searching...
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div
              className="text-text-muted"
              style={{
                padding: "20px 16px",
                textAlign: "center",
                fontSize: 13,
              }}
            >
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading &&
            categoryConfig.map((cat) => {
              const items = results[cat.key];
              if (items.length === 0) return null;
              const Icon = cat.icon;
              return (
                <div key={cat.key} style={{ marginBottom: 4 }}>
                  <div
                    className="text-text-secondary"
                    style={{
                      padding: "8px 16px 4px",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {cat.label}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(cat.href)}
                      className="bg-surface-hover"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        width: "100%",
                        padding: "8px 16px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Icon size={16} className="text-accent" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="text-text"
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          className="text-text-muted"
                          style={{
                            fontSize: 12,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.snippet}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
        </div>

        {/* Footer hint */}
        {query.length < 2 && (
          <div
            className="text-text-muted"
            style={{
              padding: "12px 16px",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Type at least 2 characters to search
          </div>
        )}
      </div>
    </div>
  );
}
