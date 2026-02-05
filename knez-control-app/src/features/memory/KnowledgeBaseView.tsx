import React, { useEffect, useState } from 'react';
import { knezClient } from '../../services/KnezClient';
import { KnowledgeDoc } from '../../domain/DataContracts';
import { useToast } from '../../components/ui/Toast';

export const KnowledgeBaseView: React.FC = () => {
  const { showToast } = useToast();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

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
    // Mock upload flow
    const title = prompt("Document Title:");
    if (!title) return;
    const content = prompt("Document Content (Text):");
    if (!content) return;

    setUploading(true);
    try {
      await knezClient.addKnowledge({
        title,
        content,
        tags: ["manual-upload"]
      });
      showToast("Document indexed", "success");
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
          onClick={handleUpload}
          disabled={uploading}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          {uploading ? "Indexing..." : "+ Add Document"}
        </button>
      </div>

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
