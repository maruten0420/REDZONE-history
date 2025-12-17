import React, { useState, useMemo } from 'react';
import { Plus, ZoomIn, ZoomOut, Save, Upload, Link as LinkIcon, Trash2, ExternalLink, X, Edit2 } from 'lucide-react';

// --- Types ---

type Category = 'technique' | 'author' | 'other';

interface LinkData {
  targetId: string;
  color: string;
}

interface EventData {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  category: Category;
  url?: string;
  links: LinkData[];
}

// --- Constants & Helpers ---

const START_YEAR = 2009;
const END_YEAR = 2025;
const START_DATE = new Date(`${START_YEAR}-01-01`).getTime();
const END_DATE = new Date(`${END_YEAR}-12-31`).getTime();
const TOTAL_DAYS = (END_DATE - START_DATE) / (1000 * 60 * 60 * 24);

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'technique', label: 'テクニック (Technique)', color: 'bg-blue-50 border-blue-200' },
  { key: 'author', label: '作者 (Author)', color: 'bg-green-50 border-green-200' },
  { key: 'other', label: 'その他 (Others)', color: 'bg-gray-50 border-gray-200' },
];

const INITIAL_EVENTS: EventData[] = [
  {
    id: '1',
    title: '界隈の黎明',
    description: '全ての始まりとされる出来事。',
    date: '2009-05-15',
    category: 'other',
    links: [],
  },
  {
    id: '2',
    title: '伝説的作者Aの登場',
    description: '後のスタイルに多大な影響を与えた。',
    date: '2010-02-10',
    category: 'author',
    links: [{ targetId: '1', color: '#888888' }],
    url: 'https://example.com'
  },
  {
    id: '3',
    title: '画期的手法B',
    description: '音声編集の常識を覆した技術。',
    date: '2010-08-20',
    category: 'technique',
    links: [{ targetId: '2', color: '#ff0000' }],
  },
];

// --- Components ---

export default function App() {
  const [events, setEvents] = useState<EventData[]>(INITIAL_EVENTS);
  const [zoom, setZoom] = useState<number>(2); // pixels per day
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);

  // --- Layout Calculations ---
  
  // Convert date string to Y position (px)
  const getDateY = (dateStr: string) => {
    const date = new Date(dateStr).getTime();
    const daysSinceStart = (date - START_DATE) / (1000 * 60 * 60 * 24);
    return Math.max(0, daysSinceStart * zoom) + 50; // +50 for header padding
  };

  const timelineHeight = useMemo(() => {
    return TOTAL_DAYS * zoom + 200; // Extra padding at bottom
  }, [zoom]);

  // --- Handlers ---

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };

  const handleAddEvent = () => {
    const newEvent: EventData = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      date: `${new Date().getFullYear()}-01-01`,
      category: 'technique',
      links: [],
    };
    setEditingEvent(newEvent);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: EventData) => {
    setEditingEvent({ ...event });
    setIsModalOpen(true);
  };

  const handleSaveEvent = (savedEvent: EventData) => {
    setEvents((prev) => {
      const exists = prev.find((e) => e.id === savedEvent.id);
      if (exists) {
        return prev.map((e) => (e.id === savedEvent.id ? savedEvent : e));
      } else {
        return [...prev, savedEvent];
      }
    });
    setIsModalOpen(false);
    setEditingEvent(null);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('本当に削除しますか？')) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setIsModalOpen(false);
      setEditingEvent(null);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setEvents(json);
        } else {
          alert('Invalid JSON format');
        }
      } catch (err) {
        alert('Failed to parse JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Rendering ---

  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden">
      {/* Header / Toolbar */}
      <header className="flex-none border-b border-slate-200 bg-slate-50 p-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-700 tracking-tight">Chronicle Map</h1>
          
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded border border-slate-300">
            <ZoomOut size={16} className="text-slate-500" />
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={zoom}
              onChange={handleZoomChange}
              className="w-32 accent-blue-600"
            />
            <ZoomIn size={16} className="text-slate-500" />
            <span className="text-xs text-slate-500 w-12 text-right">{zoom.toFixed(1)}x</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition-colors">
            <Upload size={16} />
            <span>読込</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
          >
            <Save size={16} />
            <span>保存</span>
          </button>
          <button
            onClick={handleAddEvent}
            className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={18} />
            新規作成
          </button>
        </div>
      </header>

      {/* Main Timeline Area */}
      <div className="flex-1 overflow-auto relative bg-slate-100">
        <div 
          className="relative min-w-[800px] w-full mx-auto bg-white shadow-xl origin-top"
          style={{ height: timelineHeight }}
        >
          {/* Background Grid & Years */}
          <BackgroundGrid 
            zoom={zoom} 
            startYear={START_YEAR} 
            endYear={END_YEAR} 
            totalDays={TOTAL_DAYS}
          />

          {/* Connection Lines Layer (SVG) */}
          <ConnectionLayer events={events} getDateY={getDateY} />

          {/* Columns Container */}
          <div className="absolute inset-0 flex">
            {CATEGORIES.map((cat) => (
              <div key={cat.key} className="flex-1 relative border-r border-slate-200 last:border-r-0 group">
                {/* Column Header */}
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 p-2 text-center font-bold text-slate-600 shadow-sm">
                  {cat.label}
                </div>
                
                {/* Events in this column */}
                {events
                  .filter((e) => e.category === cat.key)
                  .map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      top={getDateY(event.date)}
                      onEdit={() => handleEditEvent(event)}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && editingEvent && (
        <EventModal
          event={editingEvent}
          allEvents={events}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
}

// --- Sub Components ---

const BackgroundGrid = ({ zoom, startYear, endYear }: { zoom: number; startYear: number; endYear: number; totalDays: number }) => {
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {years.map((year) => {
        const date = new Date(`${year}-01-01`).getTime();
        const days = (date - START_DATE) / (1000 * 60 * 60 * 24);
        const top = Math.max(0, days * zoom) + 50;

        return (
          <div key={year} className="absolute w-full border-t border-slate-300" style={{ top }}>
            <span className="absolute -top-3 left-2 text-xs font-bold text-slate-400 bg-white px-1">
              {year}
            </span>
            {/* Months (Optional, show if zoom is high enough) */}
            {zoom > 2 && Array.from({ length: 11 }).map((_, m) => {
              // Approximate months for visual grid
              const mTop = top + ((365 / 12) * (m + 1)) * zoom;
               return <div key={m} className="absolute w-full border-t border-slate-100" style={{ top: mTop }} />;
            })}
          </div>
        );
      })}
    </div>
  );
};

const ConnectionLayer = ({ events, getDateY }: { events: EventData[]; getDateY: (d: string) => number }) => {
  const getX = (cat: Category) => {
    switch(cat) {
      case 'technique': return '16.66%';
      case 'author': return '50%';
      case 'other': return '83.33%';
    }
  };

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      {events.map(event => (
        event.links.map((link, i) => {
          const target = events.find(e => e.id === link.targetId);
          if (!target) return null;

          const y1 = getDateY(event.date) + 20;
          const y2 = getDateY(target.date) + 20;
          const x1 = getX(event.category);
          const x2 = getX(target.category);
          
          return (
            <line
              key={`${event.id}-${link.targetId}-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={link.color || '#cbd5e1'}
              strokeWidth="2"
              strokeDasharray="4"
              opacity="0.6"
            />
          );
        })
      ))}
    </svg>
  );
};

const EventCard = ({ event, top, onEdit }: { event: EventData; top: number; onEdit: () => void }) => {
  return (
    <div
      onClick={onEdit}
      className={`absolute left-4 right-4 p-3 rounded border shadow-sm cursor-pointer hover:shadow-md transition-all hover:scale-[1.02] bg-white border-slate-200 group z-10`}
      style={{ top }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-slate-400 bg-slate-50 px-1 rounded">{event.date}</span>
        {event.url && <ExternalLink size={12} className="text-blue-400" />}
      </div>
      <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1">{event.title || '(No Title)'}</h3>
      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed whitespace-pre-wrap">
        {event.description}
      </p>
      
      {/* Node connectors visualization (dots) */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

const EventModal = ({ 
  event, 
  allEvents,
  onClose, 
  onSave, 
  onDelete 
}: { 
  event: EventData; 
  allEvents: EventData[];
  onClose: () => void; 
  onSave: (e: EventData) => void;
  onDelete: (id: string) => void;
}) => {
  const [formData, setFormData] = useState<EventData>({ ...event });

  const handleChange = (field: keyof EventData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLink = () => {
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, { targetId: '', color: '#888888' }]
    }));
  };

  const handleLinkChange = (index: number, field: keyof LinkData, value: string) => {
    const newLinks = [...formData.links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setFormData(prev => ({ ...prev, links: newLinks }));
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = formData.links.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, links: newLinks }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit2 size={18} />
            イベント編集
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">日付</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">カテゴリ</label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as Category)}
                className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">タイトル</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="イベント名を入力"
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">詳細 (Markdown風)</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="詳細な説明を入力..."
              rows={4}
              className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">参考URL (任意)</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={formData.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://..."
                className="flex-1 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              {formData.url && (
                <a href={formData.url} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500">接続 (Links)</label>
              <button 
                type="button" 
                onClick={handleAddLink}
                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={14} /> 追加
              </button>
            </div>
            
            <div className="space-y-2">
              {formData.links.map((link, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded">
                  <LinkIcon size={14} className="text-slate-400" />
                  <select
                    value={link.targetId}
                    onChange={(e) => handleLinkChange(idx, 'targetId', e.target.value)}
                    className="flex-1 text-xs p-1 border border-slate-300 rounded"
                  >
                    <option value="">接続先を選択...</option>
                    {allEvents
                      .filter(e => e.id !== formData.id) // Cannot link to self
                      .map(e => (
                      <option key={e.id} value={e.id}>
                        {e.date} : {e.title}
                      </option>
                    ))}
                  </select>
                  <input 
                    type="color" 
                    value={link.color}
                    onChange={(e) => handleLinkChange(idx, 'color', e.target.value)}
                    className="w-8 h-6 p-0 border-0 rounded cursor-pointer"
                  />
                  <button 
                    onClick={() => handleRemoveLink(idx)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {formData.links.length === 0 && (
                <p className="text-xs text-slate-400 italic">接続されているイベントはありません。</p>
              )}
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between rounded-b-lg">
          <button
            onClick={() => onDelete(formData.id)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 size={16} />
            削除
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-white border border-transparent hover:border-slate-300 rounded transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => onSave(formData)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 shadow-sm transition-colors"
            >
              保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}