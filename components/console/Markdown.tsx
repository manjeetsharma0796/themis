"use client";
// Renders an AI message as markdown — headings, lists, tables (gfm), links, and
// syntax-highlighted code blocks — styled to the courtroom-terminal theme.
// react-markdown escapes HTML (no dangerouslySetInnerHTML), so it's XSS-safe.
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

const components: Components = {
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-brass underline underline-offset-2">
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => <h1 className="font-serif text-lg font-medium">{children}</h1>,
  h2: ({ children }) => <h2 className="font-serif text-base font-medium">{children}</h2>,
  h3: ({ children }) => <h3 className="font-serif text-sm font-medium">{children}</h3>,
  strong: ({ children }) => <strong className="font-semibold text-parchment">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-hairline-soft" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-hairline pl-3 text-muted">{children}</blockquote>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) return <code className={className}>{children}</code>;
    return (
      <code className="rounded bg-ink px-1 py-0.5 font-mono text-[0.85em] text-brass">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded bg-ink p-3 font-mono text-[12px] leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-hairline-soft px-2 py-1 text-left font-medium text-parchment">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-hairline-soft px-2 py-1">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
