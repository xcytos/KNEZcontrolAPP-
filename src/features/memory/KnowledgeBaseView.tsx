import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { KnowledgeDoc } from '../../domain/DataContracts';
import { useToast } from '../../components/ui/Toast';

export const KnowledgeBaseView: React.FC = () => {
  const { showToast } = useToast();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftTags, setDraftTags] = useState("manual-upload");

  const fetchDocs = () => {
    setLoading(true);
    knezClient.listKnowledge()
      .then(setDocs)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async () => {
    const title = draftTitle.trim();
    const content = draftContent.trim();
    if (!title || !content) {
      showToast("Title and content are required", "warning");
      return;
    }
    setUploading(true);
    try {
      await knezClient.addKnowledge({
        title,
        content,
        tags: draftTags.split(",").map(t => t.trim()).filter(Boolean)
      });
      showToast("Document indexed", "success");
      setComposerOpen(false);
      setDraftTitle("");
      setDraftContent("");
      fetchDocs();
    } catch (e) {
      showToast("Failed to index document", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 bg-zinc-900/30">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Vector Index</h3>
        <button 
          onClick={() => setComposerOpen(true)}
          disabled={uploading}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          + Add Document
        </button>
      </div>

      {composerOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 p-5 rounded-lg w-full max-w-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-zinc-200">Add Knowledge Document</div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Title"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                placeholder="Content"
                rows={8}
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
              <input
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                placeholder="Tags (comma-separated)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded"
              >
                {uploading ? "Indexing..." : "Index"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && docs.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">Loading index...</div>
      ) : docs.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-800 rounded">
           No documents in knowledge base.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-y-auto">
          {docs.map(doc => (
            <div key={doc.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                 <div className="font-bold text-zinc-200 text-sm">{doc.title}</div>
                 <div className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                   doc.status === 'indexed' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'
                 }`}>
                   {doc.status}
                 </div>
              </div>
              <div className="text-xs text-zinc-500 line-clamp-2 mb-2">
                {doc.content}
              </div>
              <div className="flex gap-2">
                {doc.tags.map(tag => (
                  <span key={tag} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
