/**
 * Rich Text Editor with Markdown Support
 * Uses Tiptap for WYSIWYG editing with ribbon toolbar
 * Supports markdown preview and export
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextStyle from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useCallback } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  showPreview?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  showPreview = false
}: RichTextEditorProps) {
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline'
        }
      }),
      Image,
      TextStyle,
      Color
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-lg mx-auto focus:outline-none'
      }
    }
  });

  // Apply text formatting
  const setLink = useCallback(() => {
    if (!editor) return;

    const url = window.prompt('Enter URL:');
    if (url === null) return;

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;

    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const setColor = useCallback((color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  if (!editor) {
    return <div className="editor-loading">Loading editor...</div>;
  }

  const ToolbarButton = ({
    onClick,
    active,
    disabled,
    children,
    title
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`toolbar-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="rich-text-editor">
      {/* View Mode Toggle */}
      <div className="editor-view-toggle">
        <button
          className={viewMode === 'edit' ? 'active' : ''}
          onClick={() => setViewMode('edit')}
        >
          Edit
        </button>
        {showPreview && (
          <>
            <button
              className={viewMode === 'split' ? 'active' : ''}
              onClick={() => setViewMode('split')}
            >
              Split
            </button>
            <button
              className={viewMode === 'preview' ? 'active' : ''}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
          </>
        )}
      </div>

      {/* Ribbon Toolbar */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <div className="editor-toolbar">
          {/* Text Style */}
          <div className="toolbar-group">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              title="Bold (Ctrl+B)"
            >
              <strong>B</strong>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              title="Italic (Ctrl+I)"
            >
              <em>I</em>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')}
              title="Strikethrough"
            >
              <s>S</s>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive('code')}
              title="Code"
            >
              {'<>'}
            </ToolbarButton>
          </div>

          {/* Headings */}
          <div className="toolbar-group">
            <select
              value={
                editor.isActive('heading', { level: 1 })
                  ? 'h1'
                  : editor.isActive('heading', { level: 2 })
                  ? 'h2'
                  : editor.isActive('heading', { level: 3 })
                  ? 'h3'
                  : 'p'
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'p') {
                  editor.chain().focus().setParagraph().run();
                } else if (value === 'h1') {
                  editor.chain().focus().toggleHeading({ level: 1 }).run();
                } else if (value === 'h2') {
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                } else if (value === 'h3') {
                  editor.chain().focus().toggleHeading({ level: 3 }).run();
                }
              }}
              className="toolbar-select"
            >
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>
          </div>

          {/* Lists */}
          <div className="toolbar-group">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              title="Bullet List"
            >
              • List
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              title="Numbered List"
            >
              1. List
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              title="Quote"
            >
              " Quote
            </ToolbarButton>
          </div>

          {/* Alignment & Indent */}
          <div className="toolbar-group">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              active={editor.isActive('codeBlock')}
              title="Code Block"
            >
              {'</>'}
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHorizontalRule().run()}
              title="Horizontal Rule"
            >
              ―
            </ToolbarButton>
          </div>

          {/* Links & Media */}
          <div className="toolbar-group">
            <ToolbarButton onClick={setLink} active={editor.isActive('link')} title="Link">
              🔗
            </ToolbarButton>
            <ToolbarButton onClick={addImage} title="Image">
              🖼️
            </ToolbarButton>
          </div>

          {/* Text Color */}
          <div className="toolbar-group">
            <input
              type="color"
              onChange={(e) => setColor(e.target.value)}
              className="toolbar-color"
              title="Text Color"
            />
          </div>

          {/* Undo/Redo */}
          <div className="toolbar-group">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Redo (Ctrl+Y)"
            >
              ↷
            </ToolbarButton>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div className={`editor-container ${viewMode === 'split' ? 'split-view' : ''}`}>
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="editor-content">
            <EditorContent editor={editor} />
          </div>
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="editor-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline ? (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded" {...props}>
                      {children}
                    </code>
                  );
                },
                a({ href, children }) {
                  return (
                    <a href={href} className="text-blue-500 underline" target="_blank" rel="noopener">
                      {children}
                    </a>
                  );
                }
              }}
            >
              {editor.getText()}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Character Count */}
      <div className="editor-footer">
        <span>{editor.storage.characterCount?.characters() || 0} characters</span>
        <span>{editor.storage.characterCount?.words() || 0} words</span>
      </div>
    </div>
  );
}

export default RichTextEditor;
