import React, { useEffect, useState } from 'react';
import { BookImportJob, BookImportSourceType, CEFRLevel, DetectedChapter, PlanConfig } from '../types';
import { contentImportApi } from '../services/contentImportApi';
import { getAdminApiErrorMessage } from '../services/adminApi';
import { Check, ChevronDown, ChevronUp, FileText, Loader2, Plus, Save, Send, Trash2, X } from 'lucide-react';

interface ContentImportsProps {
  plans: PlanConfig[];
}

const blankImport = (): Partial<BookImportJob> => ({
  sourceType: 'TEXT',
  title: '',
  author: '',
  level: 'A1',
  requiredPlan: ['FREE'],
  coverUrl: 'https://picsum.photos/300/450',
  rawText: '',
  detectedChapters: []
});

const timestampLabel = (value: unknown) => {
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate().toLocaleString();
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'number') return new Date(value).toLocaleString();
  return '—';
};

const ContentImports: React.FC<ContentImportsProps> = ({ plans }) => {
  const [imports, setImports] = useState<BookImportJob[]>([]);
  const [current, setCurrent] = useState<Partial<BookImportJob> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const result = await contentImportApi.listImports();
      setImports(result.imports);
    } catch (error) {
      alert(getAdminApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const open = async (job: BookImportJob) => {
    setIsLoading(true);
    try {
      const result = await contentImportApi.getImport(job.id);
      setCurrent(result.import);
    } catch (error) {
      alert(getAdminApiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const metadata = () => ({
    title: current?.title,
    author: current?.author,
    level: current?.level,
    requiredPlan: current?.requiredPlan,
    coverUrl: current?.coverUrl,
    originalFileName: current?.originalFileName
  });

  const saveMetadata = async () => {
    if (!current) return;
    setIsSaving(true);
    try {
      const result = current.id
        ? await contentImportApi.updateMetadata(current.id, metadata())
        : await contentImportApi.createImport((current.sourceType || 'TEXT') as BookImportSourceType, metadata());
      setCurrent(result.import);
      await refresh();
    } catch (error) {
      alert(getAdminApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const processText = async () => {
    if (!current?.id) return;
    setIsSaving(true);
    try {
      const result = await contentImportApi.setText(current.id, current.rawText || '');
      setCurrent(result.import);
      await refresh();
    } catch (error) {
      const code = (error as { code?: string }).code;
      alert(code === 'functions/failed-precondition' && current.sourceType !== 'TEXT' ? 'IMAGE/PDF extraction is not implemented yet.' : getAdminApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const updateChapter = (index: number, patch: Partial<DetectedChapter>) => setCurrent(previous => previous ? {
    ...previous,
    detectedChapters: (previous.detectedChapters || []).map((chapter, chapterIndex) => chapterIndex === index ? { ...chapter, ...patch } : chapter)
  } : previous);

  const moveChapter = (index: number, direction: -1 | 1) => setCurrent(previous => {
    if (!previous) return previous;
    const chapters = [...(previous.detectedChapters || [])];
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return previous;
    [chapters[index], chapters[target]] = [chapters[target], chapters[index]];
    return { ...previous, detectedChapters: chapters.map((chapter, order) => ({ ...chapter, order })) };
  });

  const saveChapters = async () => {
    if (!current?.id) return;
    setIsSaving(true);
    try {
      const result = await contentImportApi.updateChapters(current.id, current.detectedChapters || []);
      setCurrent(result.import);
      await refresh();
    } catch (error) {
      alert(getAdminApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const publish = async () => {
    if (!current?.id) return;
    setIsSaving(true);
    try {
      const result = await contentImportApi.publishImport(current.id);
      alert(result.alreadyPublished ? `Already published as ${result.bookId}.` : `Published as ${result.bookId}.`);
      setCurrent((await contentImportApi.getImport(current.id)).import);
      await refresh();
    } catch (error) {
      alert(getAdminApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = async () => {
    if (!current?.id || !confirm('Cancel this import?')) return;
    setIsSaving(true);
    try {
      const result = await contentImportApi.cancelImport(current.id);
      setCurrent(result.import);
      await refresh();
    } catch (error) {
      alert(getAdminApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlan = (planId: string) => setCurrent(previous => {
    if (!previous) return previous;
    const selected = previous.requiredPlan || [];
    return { ...previous, requiredPlan: selected.includes(planId) ? selected.filter(id => id !== planId) : [...selected, planId] };
  });

  if (current) {
    const chapters = current.detectedChapters || [];
    const canEdit = ['DRAFT', 'REVIEW_REQUIRED', 'READY_TO_PUBLISH'].includes(current.status || 'DRAFT');
    return <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold dark:text-white">Content Import</h2><p className="text-sm text-gray-500">Step 1 Metadata → Step 2 Source → Step 3 Preview → Step 4 Review → Step 5 Publish</p></div>
        <button onClick={() => setCurrent(null)} className="p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white"><X size={18} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm font-bold text-gray-500">Source type
          <select disabled={!!current.id} value={current.sourceType || 'TEXT'} onChange={event => setCurrent({ ...current, sourceType: event.target.value as BookImportSourceType })} className="mt-1 w-full p-2 border rounded dark:bg-gray-900 dark:text-white">
            <option value="TEXT">TEXT</option><option value="IMAGE">IMAGE (planned)</option><option value="PDF">PDF (planned)</option>
          </select>
        </label>
        <label className="text-sm font-bold text-gray-500">Status<input readOnly value={current.status || 'DRAFT'} className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-900 dark:text-white" /></label>
        <label className="text-sm font-bold text-gray-500">Title<input value={current.title || ''} onChange={event => setCurrent({ ...current, title: event.target.value })} disabled={!canEdit} className="mt-1 w-full p-2 border rounded dark:bg-gray-900 dark:text-white" /></label>
        <label className="text-sm font-bold text-gray-500">Author<input value={current.author || ''} onChange={event => setCurrent({ ...current, author: event.target.value })} disabled={!canEdit} className="mt-1 w-full p-2 border rounded dark:bg-gray-900 dark:text-white" /></label>
        <label className="text-sm font-bold text-gray-500">Level<select value={current.level || 'A1'} onChange={event => setCurrent({ ...current, level: event.target.value as CEFRLevel })} disabled={!canEdit} className="mt-1 w-full p-2 border rounded dark:bg-gray-900 dark:text-white">{['A1','A2','B1','B2','C1','C2'].map(level => <option key={level}>{level}</option>)}</select></label>
        <label className="text-sm font-bold text-gray-500">Cover URL<input value={current.coverUrl || ''} onChange={event => setCurrent({ ...current, coverUrl: event.target.value })} disabled={!canEdit} className="mt-1 w-full p-2 border rounded dark:bg-gray-900 dark:text-white" /></label>
      </div>
      <div><p className="text-sm font-bold text-gray-500 mb-2">Required plans</p><div className="flex flex-wrap gap-2">{plans.map(plan => <button type="button" disabled={!canEdit} onClick={() => togglePlan(plan.id)} key={plan.id} className={`px-3 py-2 rounded border text-sm font-bold ${(current.requiredPlan || []).includes(plan.id) ? 'bg-brand-600 text-white border-brand-600' : 'dark:text-white'}`}>{(current.requiredPlan || []).includes(plan.id) && <Check size={14} className="inline mr-1" />}{plan.id}</button>)}</div></div>
      {canEdit && <button disabled={isSaving} onClick={saveMetadata} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold flex items-center"><Save size={16} className="mr-2" />Save metadata</button>}
      {current.id && <>
        <div className="border-t pt-5 dark:border-gray-700">
          <h3 className="font-bold dark:text-white mb-2">Source text</h3>
          {current.sourceType === 'TEXT' ? <textarea rows={12} value={current.rawText || ''} disabled={!canEdit} onChange={event => setCurrent({ ...current, rawText: event.target.value })} className="w-full p-3 border rounded font-mono text-sm dark:bg-gray-900 dark:text-white" placeholder="Paste book text here…" /> : <p className="p-4 rounded bg-yellow-50 text-yellow-800">{current.sourceType} extraction is represented but not implemented in Phase 3A. No OCR is performed.</p>}
          {canEdit && <button disabled={isSaving || current.sourceType !== 'TEXT'} onClick={processText} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center"><FileText size={16} className="mr-2" />Normalize and detect chapters</button>}
        </div>
        <div className="border-t pt-5 dark:border-gray-700 space-y-3">
          <div className="flex justify-between items-center"><div><h3 className="font-bold dark:text-white">Review chapters</h3><p className="text-sm text-gray-500">Rename, reorder, edit, add, or delete before publishing.</p></div>{canEdit && <button onClick={() => setCurrent({ ...current, detectedChapters: [...chapters, { tempId: `chapter-${Date.now()}`, title: 'New chapter', content: '', order: chapters.length }] })} className="px-3 py-2 bg-green-600 text-white rounded font-bold"><Plus size={16} className="inline mr-1" />Add</button>}</div>
          {chapters.map((chapter, index) => <div key={chapter.tempId} className="p-4 rounded-xl border dark:border-gray-700 space-y-2">
            <div className="flex gap-2"><input value={chapter.title} disabled={!canEdit} onChange={event => updateChapter(index, { title: event.target.value })} className="flex-1 p-2 border rounded dark:bg-gray-900 dark:text-white font-bold" /><button disabled={!canEdit || index === 0} onClick={() => moveChapter(index, -1)} className="p-2 border rounded dark:text-white"><ChevronUp size={16} /></button><button disabled={!canEdit || index === chapters.length - 1} onClick={() => moveChapter(index, 1)} className="p-2 border rounded dark:text-white"><ChevronDown size={16} /></button><button disabled={!canEdit} onClick={() => setCurrent({ ...current, detectedChapters: chapters.filter((_, chapterIndex) => chapterIndex !== index).map((item, order) => ({ ...item, order })) })} className="p-2 text-red-600 border rounded"><Trash2 size={16} /></button></div>
            <textarea rows={7} value={chapter.content} disabled={!canEdit} onChange={event => updateChapter(index, { content: event.target.value })} className="w-full p-3 border rounded font-mono text-sm dark:bg-gray-900 dark:text-white" />
          </div>)}
          {canEdit && <button disabled={isSaving} onClick={saveChapters} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-bold">Save chapter review</button>}
        </div>
        <div className="flex flex-wrap gap-3 border-t pt-5 dark:border-gray-700"><button disabled={isSaving || current.status !== 'READY_TO_PUBLISH'} onClick={publish} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center"><Send size={16} className="mr-2" />Publish</button>{canEdit && <button disabled={isSaving} onClick={cancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 dark:text-white rounded-lg font-bold">Cancel import</button>}{isSaving && <Loader2 className="animate-spin text-brand-500" />}{current.publishedBookId && <span className="text-sm font-bold text-green-600 self-center">Published book: {current.publishedBookId}</span>}</div>
      </>}
    </div>;
  }

  return <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
    <div className="flex justify-between items-center mb-6"><div><h2 className="text-xl font-bold dark:text-white">Content Imports</h2><p className="text-sm text-gray-500">Server-managed source, preview, and publication workflow.</p></div><button onClick={() => setCurrent(blankImport())} className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center"><Plus size={18} className="mr-2" />Create import</button></div>
    {isLoading ? <Loader2 className="animate-spin text-brand-500" /> : <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-gray-50 dark:bg-gray-900/50"><tr><th className="p-3">Title</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3">Published</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{imports.map(job => <tr key={job.id}><td className="p-3 font-bold dark:text-white">{job.title || 'Untitled import'}</td><td className="p-3 dark:text-gray-300">{job.sourceType}</td><td className="p-3"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">{job.status}</span></td><td className="p-3 text-sm dark:text-gray-300">{timestampLabel(job.createdAt)}</td><td className="p-3 text-sm dark:text-gray-300">{job.publishedBookId || '—'}</td><td className="p-3"><button onClick={() => void open(job)} className="px-3 py-2 bg-brand-600 text-white rounded font-bold">Open</button></td></tr>)}{imports.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No imports yet.</td></tr>}</tbody></table></div>}
  </div>;
};

export default ContentImports;
