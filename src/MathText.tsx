import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Props {
  /** The text to render. May contain LaTeX wrapped in $ or $$. */
  children: string;
  className?: string;
  /** If true, renders as an inline <span> instead of a block */
  inline?: boolean;
}

/**
 * Renders text with KaTeX math support.
 * Inline math: $...$  |  Display math: $$...$$
 */
export default function MathText({ children, className = '', inline = false }: Props) {
  if (!children) return null;

  const Tag = inline ? 'span' : 'div';

  return (
    <Tag className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Strip the outer <p> so it doesn't break button/span layouts
          p: ({ children: c }) => <>{c}</>,
        }}
      >
        {children}
      </ReactMarkdown>
    </Tag>
  );
}
