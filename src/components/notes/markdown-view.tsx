"use client";

import * as React from "react";
import { parseInlineTokens, parseMarkdown, safeHref } from "@/lib/markdown";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInlineTokens(text).map((token, index) => {
        switch (token.kind) {
          case "bold":
            return <strong key={index}>{token.value}</strong>;
          case "italic":
            return <em key={index}>{token.value}</em>;
          case "code":
            return (
              <code
                key={index}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
              >
                {token.value}
              </code>
            );
          case "link": {
            const href = safeHref(token.href);
            if (!href) return <span key={index}>{token.value}</span>;
            return (
              <a
                key={index}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-primary underline underline-offset-2"
              >
                {token.value}
              </a>
            );
          }
          default:
            return <span key={index}>{token.value}</span>;
        }
      })}
    </>
  );
}

/**
 * Safe markdown rendering: the parser returns plain data and every node is a
 * React element — raw HTML is never injected, so the output is sanitized by
 * construction (Phase 6 §3).
 */
export function MarkdownView({ content, className = "" }: { content: string; className?: string }) {
  const blocks = React.useMemo(() => parseMarkdown(content), [content]);
  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      {blocks.length === 0 ? (
        <p className="text-muted-foreground">Empty note.</p>
      ) : (
        blocks.map((block, index) => {
          switch (block.kind) {
            case "heading":
              if (block.level <= 1) {
                return (
                  <h1 key={index} className="mb-2 mt-4 text-xl font-semibold first:mt-0">
                    <Inline text={block.text} />
                  </h1>
                );
              }
              if (block.level === 2) {
                return (
                  <h2 key={index} className="mb-2 mt-4 text-lg font-semibold first:mt-0">
                    <Inline text={block.text} />
                  </h2>
                );
              }
              return (
                <h3
                  key={index}
                  className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0"
                >
                  <Inline text={block.text} />
                </h3>
              );
            case "paragraph":
              return (
                <p key={index} className="my-2 first:mt-0 last:mb-0">
                  <Inline text={block.text} />
                </p>
              );
            case "code":
              return (
                <pre
                  key={index}
                  className="my-3 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
                >
                  {block.text}
                </pre>
              );
            case "quote":
              return (
                <blockquote
                  key={index}
                  className="my-3 border-l-2 border-border pl-3 text-muted-foreground"
                >
                  <Inline text={block.text} />
                </blockquote>
              );
            case "ul":
              return (
                <ul key={index} className="my-2 list-disc space-y-1 pl-5">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ul>
              );
            case "ol":
              return (
                <ol key={index} className="my-2 list-decimal space-y-1 pl-5">
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Inline text={item} />
                    </li>
                  ))}
                </ol>
              );
            case "hr":
              return <hr key={index} className="my-4 border-border" />;
            default:
              return null;
          }
        })
      )}
    </div>
  );
}