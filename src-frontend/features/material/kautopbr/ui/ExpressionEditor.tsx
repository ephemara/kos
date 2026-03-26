import { useCallback, useRef, useEffect } from 'react';
import { cn } from '@/ui/primitives/cn';

export interface ExpressionEditorProps {
  /** Current expression value */
  value: string;
  /** Callback when expression changes */
  onChange?: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ExpressionEditor Component
 * 
 * A code editor for procedural animation expressions with syntax highlighting.
 * Highlights:
 * - Functions (sin, cos, perlin, etc.) in purple
 * - Numbers in blue
 * - Operators (+, -, *, /, ^) in orange
 * - Variable 't' in green
 * - Parentheses in gray
 * 
 * Uses a simple regex-based syntax highlighter for performance.
 * For more advanced highlighting, consider integrating CodeMirror or Monaco.
 */
export function ExpressionEditor({
  value,
  onChange,
  placeholder = 'Enter expression...',
  className,
}: ExpressionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and highlight layer
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Apply syntax highlighting
  const highlightSyntax = useCallback((code: string): string => {
    if (!code) return '';

    // Escape HTML
    let highlighted = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight functions (sin, cos, tan, abs, sqrt, pow, min, max, clamp, lerp, perlin, simplex, worley, fbm)
    highlighted = highlighted.replace(
      /\b(sin|cos|tan|abs|sqrt|pow|min|max|clamp|lerp|perlin|simplex|worley|fbm)\b/g,
      '<span class="text-purple-400">$1</span>'
    );

    // Highlight variable 't'
    highlighted = highlighted.replace(
      /\bt\b/g,
      '<span class="text-green-400">t</span>'
    );

    // Highlight numbers (including decimals)
    highlighted = highlighted.replace(
      /\b(\d+\.?\d*)\b/g,
      '<span class="text-blue-400">$1</span>'
    );

    // Highlight operators
    highlighted = highlighted.replace(
      /([+\-*\/^])/g,
      '<span class="text-orange-400">$1</span>'
    );

    // Highlight parentheses and commas
    highlighted = highlighted.replace(
      /([(),])/g,
      '<span class="text-gray-500">$1</span>'
    );

    return highlighted;
  }, []);

  // Update highlight layer when value changes
  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.innerHTML = highlightSyntax(value) || '<span class="text-gray-600">// ' + placeholder + '</span>';
    }
  }, [value, placeholder, highlightSyntax]);

  return (
    <div className={cn('relative', className)}>
      {/* Syntax Highlight Layer (behind textarea) */}
      <div
        ref={highlightRef}
        className="absolute inset-0 px-3 py-2 font-mono text-sm text-transparent pointer-events-none overflow-hidden whitespace-pre-wrap break-words bg-gray-900 rounded-md border border-gray-700"
        style={{
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
        aria-hidden="true"
      />

      {/* Textarea (transparent text, visible cursor) */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={handleScroll}
        placeholder={placeholder}
        className={cn(
          'relative w-full px-3 py-2 font-mono text-sm bg-transparent text-transparent caret-white',
          'border border-gray-700 rounded-md resize-none overflow-auto',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
          'placeholder:text-gray-600',
          'selection:bg-blue-500/30'
        )}
        style={{
          lineHeight: '1.5',
          wordBreak: 'break-word',
          minHeight: '80px',
          maxHeight: '200px',
        }}
        spellCheck={false}
      />

      {/* Overlay to show actual highlighted text */}
      <div
        className="absolute inset-0 px-3 py-2 font-mono text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words"
        style={{
          lineHeight: '1.5',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: highlightSyntax(value) || `<span class="text-gray-600">// ${placeholder}</span>` }}
      />
    </div>
  );
}
