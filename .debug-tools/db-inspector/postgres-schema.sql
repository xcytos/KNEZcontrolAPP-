-- PostgreSQL Schema Inspector for Document Manager
-- Database: postgres (Supabase)
-- Host: db.sspsljqdhesqezrmspcj.supabase.co

-- ========================================
-- SCHEMA INSPECTION
-- ========================================

-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Documents table schema (21 columns)
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'documents' 
ORDER BY ordinal_position;

-- Document versions table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'document_versions' 
ORDER BY ordinal_position;

-- Document checkpoint links table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'document_checkpoint_links' 
ORDER BY ordinal_position;

-- ========================================
-- DATA STATISTICS
-- ========================================

-- Total document count
SELECT COUNT(*) as total_documents FROM documents;

-- Documents by type
SELECT 
    doc_type,
    COUNT(*) as count
FROM documents 
GROUP BY doc_type 
ORDER BY count DESC;

-- Documents by session
SELECT 
    session_id,
    COUNT(*) as doc_count
FROM documents 
GROUP BY session_id 
ORDER BY doc_count DESC 
LIMIT 20;

-- Documents by project
SELECT 
    project_name,
    project_id,
    COUNT(*) as doc_count
FROM documents 
GROUP BY project_name, project_id 
ORDER BY doc_count DESC;

-- Large documents (filesystem storage)
SELECT 
    document_id,
    title,
    is_large,
    file_path,
    content_size
FROM documents 
WHERE is_large = true;

-- ========================================
-- SPECIFIC SESSION QUERIES
-- ========================================

-- CA009 documents
SELECT 
    document_id,
    title,
    doc_type,
    created_at,
    version_number
FROM documents 
WHERE session_id = '196bb472-848f-43df-aadb-ec39b81cc410'
ORDER BY created_at DESC;

-- DA003 documents
SELECT 
    document_id,
    title,
    doc_type,
    created_at,
    version_number
FROM documents 
WHERE session_id = 'DA003'
ORDER BY created_at DESC;

-- ========================================
-- VERSION TRACKING
-- ========================================

-- Documents with multiple versions
SELECT 
    d.document_id,
    d.title,
    d.version_number,
    COUNT(v.version_id) as version_count
FROM documents d
LEFT JOIN document_versions v ON d.document_id = v.document_id
GROUP BY d.document_id, d.title, d.version_number
HAVING COUNT(v.version_id) > 0
ORDER BY version_count DESC;

-- ========================================
-- CHECKPOINT INTEGRATION
-- ========================================

-- Documents linked to checkpoints
SELECT 
    dcl.checkpoint_id,
    COUNT(dcl.document_id) as doc_count
FROM document_checkpoint_links dcl
GROUP BY dcl.checkpoint_id
ORDER BY doc_count DESC;

-- ========================================
-- DATA QUALITY CHECKS
-- ========================================

-- Documents without session_id (orphans)
SELECT COUNT(*) as orphan_documents 
FROM documents 
WHERE session_id IS NULL OR session_id = '';

-- Documents with tags
SELECT COUNT(*) as docs_with_tags 
FROM documents 
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- Documents with embeddings
SELECT COUNT(*) as docs_with_embeddings 
FROM documents 
WHERE embedding IS NOT NULL;

-- Recent documents (last 7 days)
SELECT 
    DATE(created_at) as date,
    COUNT(*) as docs_created
FROM documents 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
