"use client";

import type { ReactNode } from "react";

// Minimal, dependency-free Markdown renderer for knowledge notes.
//
// Security model (sanitized by construction):
// 1. Everything is rendered as React elements — React escapes all text by
//    design. There is no dangerouslySetInnerHTML anywhere in this file.
// 2. Links are only emitted when the URL matches a strict http(s) pattern;
//    anything else degrades to plain text.

const SAFE_URL = /^https?:\/\/\S+$/i;

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]]+\]\([^)\s]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(INLINE_PATTERN.source, "g"); // fresh instance per call
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (linkMatch && SAFE_URL.test(linkMatch[2])) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>
        );
      } else if (linkMatch) {
        nodes.push(linkMatch[1]);
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderBlocks(lines: string[], keyPrefix: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const nextKey = () => `${keyPrefix}-b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const buffer: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buffer.push(lines[i]);
        i += 1;
      }
      i += 1; // skip the closing fence
      blocks.push(
        <pre key={nextKey()} className="overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs">
          <code className="font-mono">{buffer.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={nextKey()} className="border-border" />);
      i += 1;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const className =
        level <= 1
          ? "text-base font-semibold text-foreground"
          : level === 2
            ? "text-sm font-semibold text-foreground"
            : "text-sm font-medium text-foreground";
      const Tag = level <= 1 ? "h3" : level === 2 ? "h4" : "h5";
      blocks.push(
        <Tag key={nextKey()} className={className}>
          {renderInline(heading[2], `${keyPrefix}-h${key}`)}
        </Tag>
      );
      i += 1;
      continue;
    }

    // Blockquote (grouped)
    if (/^\s*>\s?/.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buffer.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={nextKey()} className="border-l-2 border-border pl-3 italic text-muted-foreground">
          {renderInline(buffer.join(" "), `${keyPrefix}-q${key}`)}
        </blockquote>
      );
      continue;
    }

    // Unordered list (grouped)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={nextKey()} className="list-disc space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `${keyPrefix}-u${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (grouped)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={nextKey()} className="list-decimal space-y-1 pl-5">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, `${keyPrefix}-o${key}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (merge consecutive plain lines, keep intentional line breaks)
    const buffer: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*(#{1,6}\s|>|[-*]\s|\d+\.\s|-{3,}|\*{3,}|```)/.test(lines[i])
    ) {
      buffer.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={nextKey()} className="leading-relaxed">
        {buffer.map((l, idx) => (
          <span key={idx}>
            {idx > 0 ? <br /> : null}
            {renderInline(l, `${keyPrefix}-p${key}-${idx}`)}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
}

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className={className ?? "space-y-2.5 text-sm text-muted-foreground"}>
      {renderBlocks(lines, "md")}
    </div>
  );
}