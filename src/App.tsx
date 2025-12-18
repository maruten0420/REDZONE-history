import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { Plus, Minus, Save, Upload, Link as LinkIcon, Trash2, ExternalLink, X, Edit2, RotateCcw, FileClock, ChevronDown, Lock, Unlock } from 'lucide-react';

// --- Types ---

type Category = 'technique' | 'author' | 'other';
type BorderColorType = 'default' | 'red' | 'blue';

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
  xOffset: number; // 0 to 100 (percentage within column)
  borderColor?: BorderColorType;
}

// --- Constants & Helpers ---

const START_YEAR = 2009;
const END_YEAR = 2025;
const START_DATE = new Date(`${START_YEAR}-01-01`).getTime();
const END_DATE = new Date(`${END_YEAR}-12-31`).getTime();
const TOTAL_DAYS = (END_DATE - START_DATE) / (1000 * 60 * 60 * 24);
const HEADER_HEIGHT = 60; 

// カード幅定数 (px) - CSSクラスと合わせる必要があります
const CARD_WIDTH_MOBILE = 160; // w-40
const CARD_WIDTH_PC = 240;     // md:w-60

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'technique', label: 'テクニック', color: 'bg-blue-50 border-blue-200' },
  { key: 'author', label: '作者', color: 'bg-green-50 border-green-200' },
  { key: 'other', label: 'その他', color: 'bg-gray-50 border-gray-200' },
];

const BORDER_OPTIONS: { key: BorderColorType; label: string; class: string; bgClass: string }[] = [
  { key: 'default', label: '標準 (灰)', class: 'border-slate-300', bgClass: 'bg-white' },
  { key: 'red', label: '日時不詳 (赤)', class: 'border-red-500', bgClass: 'bg-red-50' },
  { key: 'blue', label: '予備 (青)', class: 'border-blue-500', bgClass: 'bg-blue-50' },
];

const DEFAULT_EVENTS: EventData[] = [];

// --- Components ---

export default function App() {
  const [events, setEvents] = useState<EventData[]>(DEFAULT_EVENTS);
  const [loading, setLoading] = useState(true);
  const [hasLocalData, setHasLocalData] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const scrollTargetDaysRef = useRef<number | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const getJsonPath = () => {
    const path = window.location.pathname;
    const repoName = 'REDZONE-history';
    if (path.includes(`/${repoName}/`)) {
      return `/${repoName}/timeline_data.json`;
    }
    return '/timeline_data.json';
  };

  useEffect(() => {
    const initData = async () => {
      const saved = localStorage.getItem('timeline-data');
      if (saved) setHasLocalData(true);

      try {
        const jsonPath = getJsonPath();
        console.log('Fetching JSON from:', jsonPath);

        const response = await fetch(jsonPath);
        if (response.ok) {
          const data = await response.json();
          const fixedData = data.map((item: any) => ({
            ...item, 
            xOffset: item.xOffset ?? 50,
            borderColor: item.borderColor ?? 'default'
          }));
          setEvents(fixedData);
        } else {
          console.error("JSON file not found at:", jsonPath);
          if (saved) {
            setEvents(JSON.parse(saved));
          }
        }
      } catch (error) {
        console.error("Failed to fetch timeline data:", error);
        if (saved) {
          setEvents(JSON.parse(saved));
        }
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, []);

  useEffect(() => {
    if (!loading && events.length > 0) {
      localStorage.setItem('timeline-data', JSON.stringify(events));
      setHasLocalData(true);
    }
  }, [events, loading]);

  const [zoom, setZoom] = useState<number>(1.0);
  const [activeCategory, setActiveCategory] = useState<Category>('technique');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);

  const getDateY = (dateStr: string) => {
    const date = new Date(dateStr).getTime();
    const daysSinceStart = (date - START_DATE) / (1000 * 60 * 60 * 24);
    return Math.max(0, daysSinceStart * zoom) + HEADER_HEIGHT;
  };

  const timelineHeight = useMemo(() => {
    return TOTAL_DAYS * zoom + 600;
  }, [zoom]);

  const visibleEvents = useMemo(() => 
    events.filter(e => e.category === activeCategory),
  [events, activeCategory]);

  useEffect(() => {
    if (!loading && scrollContainerRef.current) {
      const targetDate = new Date('2017-01-01').getTime();
      const days = (targetDate - START_DATE) / (1000 * 60 * 60 * 24);
      const top = Math.max(0, days * zoom);
      
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: top, behavior: 'smooth' });
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useLayoutEffect(() => {
    if (scrollTargetDaysRef.current !== null && scrollContainerRef.current) {
      const targetDays = scrollTargetDaysRef.current;
      const newScrollTop = targetDays * zoom + HEADER_HEIGHT;
      scrollContainerRef.current.scrollTop = newScrollTop;
      scrollTargetDaysRef.current = null;
    }
  }, [zoom]);

  const saveCurrentScrollPosition = () => {
    if (scrollContainerRef.current) {
      const scrollTop = scrollContainerRef.current.scrollTop;
      const currentDays = Math.max(0, (scrollTop - HEADER_HEIGHT) / zoom);
      scrollTargetDaysRef.current = currentDays;
    }
  };

  const handleZoomIn = () => {
    saveCurrentScrollPosition();
    setZoom(prev => Math.min(3.0, +(prev + 0.1).toFixed(1)));
  };

  const handleZoomOut = () => {
    saveCurrentScrollPosition();
    setZoom(prev => Math.max(0.5, +(prev - 0.1).toFixed(1)));
  };

  const handleZoomSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    saveCurrentScrollPosition();
    setZoom(parseFloat(e.target.value));
  };

  const handleAddEvent = () => {
    const newEvent: EventData = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      date: `${new Date().getFullYear()}-01-01`,
      category: activeCategory,
      links: [],
      xOffset: 50,
      borderColor: 'default'
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

  const handleDragEnd = (id: string, newXOffset: number) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, xOffset: Math.max(0, Math.min(100, newXOffset)) } : e));
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(events, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_data.json`;
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
          const fixedData = json.map(item => ({
            ...item, 
            xOffset: item.xOffset ?? 50,
            borderColor: item.borderColor ?? 'default'
          }));
          setEvents(fixedData);
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

  const handleResetToOfficial = async () => {
    if (!confirm('ローカルの変更を破棄して、サーバー(GitHub)の最新データを読み込みますか？')) return;
    
    setLoading(true);
    try {
      const jsonPath = getJsonPath();
      const response = await fetch(jsonPath);
      
      if (response.ok) {
        const data = await response.json();
        const fixedData = data.map((item: any) => ({
          ...item, 
          xOffset: item.xOffset ?? 50,
          borderColor: item.borderColor ?? 'default'
        }));
        setEvents(fixedData);
        localStorage.removeItem('timeline-data'); 
        setHasLocalData(false);
        alert('データを最新に更新しました！');
      } else {
        alert(`データが見つかりませんでした。\n参照先: ${jsonPath}`);
      }
    } catch (e) {
      alert(`読み込みエラーが発生しました: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLocal = () => {
    if (!confirm('編集中のデータ（ローカルキャッシュ）を復元しますか？\n現在の表示内容は上書きされます。')) return;
    const saved = localStorage.getItem('timeline-data');
    if (saved) {
      setEvents(JSON.parse(saved));
    }
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Loading history...</div>;
  }

  const zoomOptions = [];
  for (let i = 0.5; i <= 3.0; i += 0.1) {
    zoomOptions.push(parseFloat(i.toFixed(1)));
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <header className="flex-none border-b border-slate-200 bg-white p-2 md:p-4 flex flex-wrap items-center justify-between shadow-sm z-40 relative gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <h1 className="text-lg md:text-xl font-bold text-slate-700 tracking-tight hidden sm:block">Chronicle Map</h1>
          
          <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 overflow-x-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 md:px-4 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                  activeCategory === cat.key
                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-slate-100 rounded border border-slate-200">
            <button 
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-l transition-colors"
              title="縮小"
            >
              <Minus size={14} />
            </button>
            <div className="relative border-l border-r border-slate-200 bg-white h-full flex items-center">
              <select 
                value={zoom} 
                onChange={handleZoomSelect}
                className="appearance-none bg-transparent pl-2 pr-6 py-1 text-xs font-mono text-center w-16 focus:outline-none cursor-pointer"
              >
                {zoomOptions.map(z => (
                  <option key={z} value={z}>x{z.toFixed(1)}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1 text-slate-400 pointer-events-none" />
            </div>
            <button 
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-r transition-colors"
              title="拡大"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
          <button 
            onClick={handleResetToOfficial}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded transition-colors"
            title="GitHubの最新データに戻す"
          >
            <RotateCcw size={16} />
          </button>

          {hasLocalData && (
            <button 
              onClick={handleRestoreLocal}
              className="flex items-center gap-1 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded transition-colors border border-transparent hover:border-amber-200"
              title="編集中のデータを復元"
            >
              <FileClock size={16} />
              <span className="hidden lg:inline">復元</span>
            </button>
          )}

          <label className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
            <Upload size={16} />
            <span className="hidden sm:inline">読込</span>
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Save size={16} />
            <span className="hidden sm:inline">保存</span>
          </button>
          <button
            onClick={handleAddEvent}
            className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">新規作成</span>
          </button>
        </div>
      </header>

      {/* Main Timeline Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto relative bg-slate-100"
      >
        <div 
          className="relative w-full mx-auto bg-white shadow-xl origin-top min-h-full"
          style={{ height: timelineHeight }}
        >
          <BackgroundGrid zoom={zoom} startYear={START_YEAR} endYear={END_YEAR} />
          
          <div className="absolute inset-0">
            <div className="relative w-full h-full">
              
              <ConnectionLayer events={events} visibleEvents={visibleEvents} getDateY={getDateY} />

              <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 p-2 text-center font-bold text-slate-600 shadow-sm">
                {CATEGORIES.find(c => c.key === activeCategory)?.label}
              </div>
              
              {visibleEvents.map((event) => (
                <DraggableEventCard
                  key={event.id}
                  event={event}
                  top={getDateY(event.date)}
                  onEdit={() => handleEditEvent(event)}
                  onDragEnd={handleDragEnd}
                  isActive={activeCardId === event.id}
                  onActivate={() => setActiveCardId(event.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

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

const BackgroundGrid = ({ zoom, startYear, endYear }: { zoom: number; startYear: number; endYear: number }) => {
  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-0">
      {years.map((year) => {
        const date = new Date(`${year}-01-01`).getTime();
        const days = (date - START_DATE) / (1000 * 60 * 60 * 24);
        const top = Math.max(0, days * zoom) + HEADER_HEIGHT;

        const nextDate = new Date(`${year + 1}-01-01`).getTime();
        const nextDays = (nextDate - START_DATE) / (1000 * 60 * 60 * 24);
        const nextTop = Math.max(0, nextDays * zoom) + HEADER_HEIGHT;
        
        const yearHeight = nextTop - top;

        return (
          <div key={year} className="absolute w-full border-t border-slate-400" style={{ top }}>
            <span className="absolute -top-3 left-2 text-xs font-bold text-slate-500 bg-white/80 px-1 rounded">
              {year}
            </span>
            {zoom > 0.1 && Array.from({ length: 11 }).map((_, m) => {
              const mTop = (yearHeight / 12) * (m + 1);
               return <div key={m} className="absolute w-full border-t border-slate-200" style={{ top: mTop }} />;
            })}
          </div>
        );
      })}
    </div>
  );
};

const ConnectionLayer = ({ 
  events, 
  visibleEvents,
  getDateY 
}: { 
  events: EventData[]; 
  visibleEvents: EventData[];
  getDateY: (d: string) => number 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const updateWidth = () => {
      if (svgRef.current) {
        setWidth(svgRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (svgRef.current) observer.observe(svgRef.current);
    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    const updateHeights = () => {
      const newHeights: Record<string, number> = {};
      visibleEvents.forEach(event => {
        const el = document.getElementById(`card-${event.id}`);
        if (el) {
          const inner = el.querySelector('.card-inner');
          if (inner) {
             newHeights[event.id] = inner.clientHeight;
          }
        }
      });
      setCardHeights(newHeights);
    };

    updateHeights();
    const observer = new ResizeObserver(updateHeights);
    visibleEvents.forEach(event => {
      const el = document.getElementById(`card-${event.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [visibleEvents, width]);

  // デバイス幅を取得してカード幅を決定
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_PC;

  // 0% -> 左端 (0px), 100% -> 右端 (ContainerWidth - CardWidth)
  const getX = (xOffset: number) => {
    if (width === 0) return 0;
    const availableWidth = width - cardWidth;
    // カード中心の座標を返す
    return (availableWidth * (xOffset / 100)) + (cardWidth / 2);
  };

  const isVisible = (id: string) => visibleEvents.some(e => e.id === id);

  return (
    <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
      {visibleEvents.map(event => (
        event.links.map((link, i) => {
          if (!isVisible(link.targetId)) return null;

          const target = events.find(e => e.id === link.targetId);
          if (!target || width === 0) return null;

          const sourceHeight = cardHeights[event.id] || 50;
          const y1 = getDateY(event.date) + sourceHeight; 
          const y2 = getDateY(target.date) - 6;
          
          const x1 = getX(event.xOffset);
          const x2 = getX(target.xOffset);
          
          const distY = Math.abs(y2 - y1);
          const handleOffset = Math.max(50, distY * 0.4); 

          const cp1y = y1 + handleOffset;
          const cp2y = y2 - handleOffset;

          const d = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;

          return (
            <g key={`${event.id}-${link.targetId}-${i}`}>
              <path
                d={d}
                fill="none"
                stroke={link.color || '#cbd5e1'}
                strokeWidth="3"
                strokeOpacity="0.8"
                strokeLinecap="round"
                style={{ vectorEffect: 'non-scaling-stroke' }}
              />
            </g>
          );
        })
      ))}
    </svg>
  );
};

const DraggableEventCard = ({ 
  event, 
  top, 
  onEdit, 
  onDragEnd,
  isActive,
  onActivate,
}: { 
  event: EventData; 
  top: number; 
  onEdit: () => void; 
  onDragEnd: (id: string, x: number) => void;
  isActive: boolean;
  onActivate: () => void;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [currentX, setCurrentX] = useState(event.xOffset);
  const startXRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const colWidthRef = useRef<number>(0);

  const colorStyle = BORDER_OPTIONS.find(c => c.key === (event.borderColor || 'default')) || BORDER_OPTIONS[0];

  useEffect(() => {
    if (!isDragging) {
      setCurrentX(event.xOffset);
    }
  }, [event.xOffset, isDragging]);

  const handleToggleLock = (e: React.MouseEvent | React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;
    e.stopPropagation();
    setIsLocked(prev => !prev);
    onActivate();
  };

  const handleStart = (clientX: number) => {
    onActivate();
    if (isLocked) return;

    const cardElement = document.getElementById(`card-${event.id}`);
    const parentColumn = cardElement?.parentElement;
    
    // カード幅の取得（レスポンシブ）
    const cardWidth = cardElement?.offsetWidth || CARD_WIDTH_PC;

    if (parentColumn) {
      // 親の幅からカードの幅を引いたものが「移動可能距離」
      colWidthRef.current = parentColumn.clientWidth - cardWidth;
    }

    setIsDragging(true);
    startXRef.current = clientX;
    startOffsetRef.current = currentX;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) {
      onActivate();
      return;
    }
    e.stopPropagation(); 
    e.preventDefault(); 
    handleStart(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLocked) {
      onActivate();
      return;
    }
    e.stopPropagation();
    handleStart(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      if (colWidthRef.current <= 0) return;
      const deltaXPixels = clientX - startXRef.current;
      const deltaPercent = (deltaXPixels / colWidthRef.current) * 100;
      const newOffset = Math.min(100, Math.max(0, startOffsetRef.current + deltaPercent));
      setCurrentX(newOffset);
    };

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault(); 
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleMove(e.touches[0].clientX);
    };

    const handleUp = () => {
      setIsDragging(false);
      onDragEnd(event.id, currentX);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, event.id, onDragEnd, currentX]);

  const getZIndex = () => {
    if (isDragging) return 'z-50';
    if (isActive) return 'z-40';
    return 'z-20 hover:z-30';
  };

  return (
    <div
      id={`card-${event.id}`}
      onDoubleClick={handleToggleLock}
      className={`absolute flex flex-col items-center select-none transition-shadow touch-manipulation ${getZIndex()} ${!isLocked ? 'cursor-grab' : ''} w-40 md:w-60`}
      style={{ 
        top, 
        // インラインスタイルからはleftを削除し、内部styleタグで制御
      }}
    >
      {/* widthとleftをstyleタグで明示的に指定して計算を合わせる */}
      <style>{`
        #card-${event.id} {
          left: calc((100% - 160px) * ${currentX / 100});
        }
        @media (min-width: 768px) {
          #card-${event.id} {
            left: calc((100% - 240px) * ${currentX / 100});
          }
        }
      `}</style>

      <div className={`card-inner w-full rounded-xl border-2 p-2 md:p-3 transition-all min-h-[50px] relative ${colorStyle.class} ${colorStyle.bgClass} ${
        isDragging 
          ? 'shadow-xl' 
          : 'shadow-md hover:shadow-lg'
      } ${!isLocked ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}
        // マウスイベント・タッチイベントはここで受け取る
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        
        <div 
          className="absolute -top-3 -right-3 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm cursor-pointer hover:bg-slate-50 z-50"
          onClick={handleToggleLock}
          onTouchEnd={(e) => { e.stopPropagation(); handleToggleLock(e as any); }}
        >
          {isLocked ? <Lock size={12} className="text-slate-400" /> : <Unlock size={12} className="text-yellow-500" />}
        </div>

        <div className="flex justify-between items-start mb-1.5">
          <span className="text-[9px] md:text-[10px] font-mono text-slate-500 bg-white/50 px-1.5 py-0.5 rounded border border-slate-200">{event.date}</span>
          <div className="flex gap-1 mr-2">
            {event.url && (
              <a 
                href={event.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-400 hover:text-blue-600 p-0.5 rounded hover:bg-blue-50 transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <ExternalLink size={14} />
              </a>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
        
        <h3 className="font-bold text-slate-800 text-xs md:text-sm leading-tight mb-2 text-center whitespace-pre-wrap">{event.title || 'No Title'}</h3>
        
        {!isLocked && <div className="w-8 md:w-10 h-1 bg-yellow-400/50 rounded-full mx-auto" />}
      </div>

      <div className={`w-3 h-3 bg-white border-2 rounded-full absolute -top-1.5 shadow-sm ${colorStyle.class}`} style={{left: '50%', transform: 'translateX(-50%)'}} />
      <div className={`w-3 h-3 bg-white border-2 rounded-full absolute -bottom-1.5 left-1/2 -translate-x-1/2 shadow-sm z-30 pointer-events-none ${colorStyle.class}`} style={{left: '50%', transform: 'translateX(-50%)'}} />
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit2 size={18} />
            イベント編集
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">カード枠色</label>
            <div className="flex gap-2">
              {BORDER_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleChange('borderColor', opt.key)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${
                    opt.bgClass
                  } ${
                    formData.borderColor === opt.key 
                      ? `${opt.class} ring-2 ring-offset-1 ring-blue-400`
                      : 'border-transparent hover:border-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">日付</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">カテゴリ</label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value as Category)}
                className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              >
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">タイトル</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="イベント名を入力"
              className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">詳細 (Markdown風)</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="詳細な説明を入力..."
              rows={4}
              className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">参考URL</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={formData.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://..."
                className="flex-1 p-2 border border-slate-200 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              {formData.url && (
                <a href={formData.url} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100">
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
             {/* 横位置スライダー（微調整用） */}
             <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between">
                <span>横位置の微調整 (ドラッグでも可能)</span>
                <span>{Math.round(formData.xOffset || 50)}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={formData.xOffset || 50} 
                onChange={(e) => handleChange('xOffset', parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-500">接続 (Links)</label>
              <button 
                type="button" 
                onClick={handleAddLink}
                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
              >
                <Plus size={14} /> 追加
              </button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {formData.links.map((link, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-100">
                  <LinkIcon size={14} className="text-slate-400" />
                  <select
                    value={link.targetId}
                    onChange={(e) => handleLinkChange(idx, 'targetId', e.target.value)}
                    className="flex-1 text-xs p-1.5 border border-slate-200 rounded bg-white"
                  >
                    <option value="">接続先を選択...</option>
                    {allEvents
                      .filter(e => e.id !== formData.id)
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
                    className="w-8 h-7 p-0 border-0 rounded cursor-pointer"
                  />
                  <button 
                    onClick={() => handleRemoveLink(idx)}
                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-200"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {formData.links.length === 0 && (
                <div className="text-center py-4 bg-slate-50 rounded border border-dashed border-slate-200 text-xs text-slate-400">
                  接続線はありません
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between rounded-b-xl">
          <button
            onClick={() => onDelete(formData.id)}
            className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <Trash2 size={16} />
            削除
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-white border border-transparent hover:border-slate-300 rounded-lg transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => onSave(formData)}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
            >
              保存する
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
