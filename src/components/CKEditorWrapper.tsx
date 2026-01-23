import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
import { useEffect, useRef, useState } from 'react';

interface CKEditorWrapperProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CKEditorWrapper({
  content,
  onChange,
  placeholder = 'Start typing your document...',
  disabled = false
}: CKEditorWrapperProps) {
  const editorRef = useRef<ClassicEditor | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleReady = (editor: ClassicEditor) => {
    editorRef.current = editor;
    setIsReady(true);

    // Focus the editor when ready
    if (!disabled) {
      editor.editing.view.focus();
    }
  };

  const handleChange = (_event: any, editor: ClassicEditor) => {
    const data = editor.getData();
    onChange(data);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        editorRef.current = null;
      }
    };
  }, []);

  return (
    <div className={`ckeditor-wrapper ${disabled ? 'disabled' : ''} ${isReady ? 'ready' : 'loading'}`}>
      <CKEditor
        editor={ClassicEditor}
        data={content}
        onReady={handleReady}
        onChange={handleChange}
        disabled={disabled}
        config={{
          placeholder,
          toolbar: {
            items: [
              'heading',
              '|',
              'bold',
              'italic',
              'underline',
              'strikethrough',
              '|',
              'bulletedList',
              'numberedList',
              '|',
              'link',
              'blockQuote',
              'insertTable',
              '|',
              'undo',
              'redo'
            ],
            shouldNotGroupWhenFull: true
          },
          heading: {
            options: [
              { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
              { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
              { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
              { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
            ]
          },
          list: {
            properties: {
              styles: true,
              startIndex: true,
              reversed: true
            }
          },
          table: {
            contentToolbar: [
              'tableColumn',
              'tableRow',
              'mergeTableCells',
              'tableProperties',
              'tableCellProperties'
            ]
          },
          language: 'en'
        }}
      />
      {!isReady && (
        <div className="ckeditor-loading">
          <div className="loading-spinner"></div>
          <p>Loading editor...</p>
        </div>
      )}
    </div>
  );
}
