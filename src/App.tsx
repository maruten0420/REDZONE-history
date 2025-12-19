import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { Plus, Minus, Save, Upload, Link as LinkIcon, Trash2, ExternalLink, X, Edit2, RotateCcw, FileClock, ChevronDown, Lock, Unlock, Info, HelpCircle, Hand, ChevronLeft, ChevronRight } from 'lucide-react';

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

// カード幅設定 (CSSとJSで共有)
const CARD_WIDTH_MOBILE = 160; 
const CARD_WIDTH_PC = 240;     
const BREAKPOINT = 768; // md breakpoint

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'technique', label: 'テクニック', color: 'bg-blue-50 border-blue-200' },
  { key: 'author', label: '作者', color: 'bg-green-50 border-green-200' },
  { key: 'other', label: 'その他', color: 'bg-gray-50 border-gray-200' },
];

const BORDER_OPTIONS: { key: BorderColorType; label: string; class: string; bgClass: string }[] = [
  { key: 'default', label: '標準 (灰)', class: 'border-slate-300', bgClass: 'bg-white/85' },
  { key: 'red', label: '日時不詳 (赤)', class: 'border-red-500', bgClass: 'bg-red-50/85' },
  { key: 'blue', label: '予備 (青)', class: 'border-blue-500', bgClass: 'bg-blue-50/85' },
];

const DEFAULT_EVENTS: EventData[] = [];

// --- Global Styles for Card Positioning ---
const CardStyles = () => (
  <style>{`
    .timeline-card {
      /* デフォルト(スマホ) */
      --card-width: ${CARD_WIDTH_MOBILE}px;
      width: var(--card-width);
      /* 0%なら左端(0px), 100%なら右端(100% - cardWidth) */
      left: calc((100% - var(--card-width)) * var(--x-ratio));
    }
    
    @media (min-width: ${BREAKPOINT}px) {
      .timeline-card {
        --card-width: ${CARD_WIDTH_PC}px;
      }
    }
  `}</style>
);

// --- Components ---

export default function App() {
  const [events, setEvents] = useState<EventData[]>(DEFAULT_EVENTS);
  const [loading, setLoading] = useState(true);
  const [hasLocalData, setHasLocalData] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const scrollTargetDaysRef = useRef<number | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<EventData | null>(null);
  const [highlightedConnection, setHighlightedConnection] = useState<{source: string, target: string} | null>(null);
  
  // チュートリアル・バージョン管理
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0); // 0: ノード・カード, 1: 作成・編集
  const [version, setVersion] = useState<string>('');

  // タイトルの設定
  useEffect(() => {
    document.title = "RED ZONE Chronicle Map";
  }, []);

  // パス解決ヘルパー
  const getResourcePath = (filename: string) => {
    const path = window.location.pathname;
    const repoName = 'REDZONE-history';
    // ベースパスの特定
    const basePath = path.includes(`/${repoName}/`) ? `/${repoName}/` : '/';
    return `${basePath}${filename}`.replace('//', '/');
  };

  // 初回ロード時の処理（データ読み込み & バージョン取得 & チュートリアル判定）
  useEffect(() => {
    const initApp = async () => {
      // 1. チュートリアル既読チェック
      const hasSeenTutorial = localStorage.getItem('tutorial-seen');
      if (!hasSeenTutorial) {
        setShowTutorial(true);
      }

      // 2. ローカルデータの存在確認
      const saved = localStorage.getItem('timeline-data');
      if (saved) setHasLocalData(true);

      // 3. バージョン情報の取得
      try {
        const versionPath = getResourcePath('version.txt');
        const res = await fetch(versionPath);
        if (res.ok) {
          const text = await res.text();
          setVersion(text.trim());
        }
      } catch (e) {
        console.warn("Version file not found");
      }

      // 4. メインデータの取得
      try {
        const jsonPath = getResourcePath('timeline_data.json');
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

    initApp();
  }, []);

  // データ変更時にローカルストレージにバックアップ
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
    setZoom(prev => Math.min(5.0, +(prev + 0.1).toFixed(1)));
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
      const jsonPath = getResourcePath('timeline_data.json');
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

  // チュートリアル操作
  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('tutorial-seen', 'true');
    setTutorialStep(0);
  };

  const nextStep = () => setTutorialStep(prev => Math.min(1, prev + 1));
  const prevStep = () => setTutorialStep(prev => Math.max(0, prev - 1));

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Loading history...</div>;
  }

  const zoomOptions = [];
  for (let i = 0.5; i < 5.0; i += 0.1) {
    zoomOptions.push(parseFloat(i.toFixed(1)));
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      <CardStyles />

      {/* Tutorial Overlay */}
      {showTutorial && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={closeTutorial}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <HelpCircle className="text-blue-500" />
                操作ガイド {tutorialStep + 1}/2
              </h2>
              <button onClick={closeTutorial} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            {/* Page 1: ノード・カード */}
            {tutorialStep === 0 && (
              <div className="space-y-4 animate-in slide-in-from-right duration-300">
                <h3 className="font-bold text-slate-700 text-lg">ノード・カードについて</h3>
                
                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                      <Hand size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">ダブルタップで移動モード</span>
                      カードは誤操作防止のため固定されています。ダブルクリック（スマホはダブルタップ）するとロックが外れ、横に動かしたり編集したりできます。
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="bg-green-50 p-2 rounded-lg text-green-600 shrink-0">
                      <Info size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">長押しで詳細表示</span>
                      カードをマウスオーバー（スマホは長押し）すると、画面上部に詳細説明が表示されます。
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-purple-50 p-2 rounded-lg text-purple-600 shrink-0">
                      <LinkIcon size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">ノードのハイライト</span>
                      線をマウスオーバー（スマホは長押し）すると、つながっているカードが光ります。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Page 2: 作成・編集 */}
            {tutorialStep === 1 && (
              <div className="space-y-4 animate-in slide-in-from-right duration-300">
                <h3 className="font-bold text-slate-700 text-lg">作成・編集について</h3>

                <div className="space-y-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600 shrink-0">
                      <Plus size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">新規作成</span>
                      画面右上の「+新規作成」ボタンから新しいカードを追加できます。
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-orange-50 p-2 rounded-lg text-orange-600 shrink-0">
                      <Edit2 size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">編集画面</span>
                      カードのロックを解除（ダブルタップ）すると、鉛筆マークの編集ボタンが表示されます。
                      編集画面の外側をクリックすると「終了しますか？」と確認が出るので安心です。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-2">
              <button 
                onClick={prevStep} 
                disabled={tutorialStep === 0}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="flex-1 flex gap-2">
                {tutorialStep === 0 ? (
                  <button 
                    onClick={nextStep}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    次へ
                  </button>
                ) : (
                   <button 
                    onClick={closeTutorial}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    閉じる
                  </button>
                )}
              </div>

               <button 
                onClick={nextStep} 
                disabled={tutorialStep === 1}
                className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Overlay (Top) */}
      {hoveredEvent && hoveredEvent.description && (
        <div className="absolute top-16 left-0 right-0 z-50 p-4 pointer-events-none flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-slate-800/90 text-white p-4 rounded-lg shadow-xl max-w-lg w-full backdrop-blur-sm border border-slate-700">
            <div className="flex items-center gap-2 mb-1 border-b border-slate-600 pb-2">
              <Info size={16} className="text-blue-300" />
              <span className="font-bold text-sm">{hoveredEvent.title}</span>
              <span className="text-xs text-slate-400 ml-auto font-mono">{hoveredEvent.date}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {hoveredEvent.description}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <header className="flex-none border-b border-slate-200 bg-white p-2 md:p-4 flex flex-wrap items-center justify-between shadow-sm z-40 relative gap-2 md:gap-4">
        <div className="flex items-center gap-2 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex flex-col">
            <h1 className="text-lg md:text-xl font-bold text-slate-700 tracking-tight hidden sm:block">RED ZONE Chronicle Map</h1>
            {version && <span className="text-[10px] text-slate-400 hidden sm:block font-mono -mt-1">{version}</span>}
          </div>
          
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
            onClick={() => { setTutorialStep(0); setShowTutorial(true); }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded transition-colors"
            title="操作説明を表示"
          >
            <HelpCircle size={16} />
          </button>

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
          
          <div className="absolute inset-0 pr-32 pl-4">
            <div className="relative w-full h-full">
              
              <ConnectionLayer 
                events={events} 
                visibleEvents={visibleEvents} 
                getDateY={getDateY} 
                onHighlight={setHighlightedConnection}
              />

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
                  onHoverStart={() => setHoveredEvent(event)}
                  onHoverEnd={() => setHoveredEvent(null)}
                  isHighlighted={highlightedConnection ? (highlightedConnection.source === event.id || highlightedConnection.target === event.id) : false}
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
  getDateY,
  onHighlight
}: { 
  events: EventData[]; 
  visibleEvents: EventData[];
  getDateY: (d: string) => number;
  onHighlight: (data: {source: string, target: string} | null) => void;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [cardHeights, setCardHeights] = useState<Record<string, number>>({});
  
  const longPressTimerRef = useRef<number | null>(null);

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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < BREAKPOINT;
  const cardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH_PC;

  const getX = (xOffset: number) => {
    if (width === 0) return 0;
    const availableWidth = width - cardWidth;
    return (availableWidth * (xOffset / 100)) + (cardWidth / 2);
  };

  const isVisible = (id: string) => visibleEvents.some(e => e.id === id);

  const handleStartHighlight = (sourceId: string, targetId: string) => {
    onHighlight({source: sourceId, target: targetId});
  };

  const handleEndHighlight = () => {
    onHighlight(null);
  };

  const handleTouchStartNode = (sourceId: string, targetId: string) => {
    longPressTimerRef.current = window.setTimeout(() => {
      handleStartHighlight(sourceId, targetId);
    }, 1000);
  };

  const handleTouchEndNode = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    handleEndHighlight();
  };

  return (
    <svg ref={svgRef} className="absolute inset-0 w-full h-full z-10 overflow-visible pointer-events-none">
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
            <g key={`${event.id}-${link.targetId}-${i}`} className="group">
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth="20"
                style={{ vectorEffect: 'non-scaling-stroke', pointerEvents: 'stroke' }}
                onMouseEnter={() => handleStartHighlight(event.id, link.targetId)}
                onMouseLeave={handleEndHighlight}
                onTouchStart={() => handleTouchStartNode(event.id, link.targetId)}
                onTouchEnd={handleTouchEndNode}
              />
              <path
                d={d}
                fill="none"
                stroke={link.color || '#cbd5e1'}
                strokeWidth="5"
                strokeOpacity="0.8"
                strokeLinecap="round"
                className="transition-all duration-300 group-hover:stroke-yellow-400 group-hover:stroke-opacity-100 group-hover:stroke-[6px]"
                style={{ vectorEffect: 'non-scaling-stroke', pointerEvents: 'none' }}
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
  onHoverStart, 
  onHoverEnd,
  isHighlighted,
}: { 
  event: EventData; 
  top: number; 
  onEdit: () => void; 
  onDragEnd: (id: string, x: number) => void;
  isActive: boolean;
  onActivate: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  isHighlighted: boolean;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [currentX, setCurrentX] = useState(event.xOffset);
  const startXRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const colWidthRef = useRef<number>(0);
  
  const longPressTimerRef = useRef<number | null>(null);

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
    
    const cardWidth = cardElement?.offsetWidth || CARD_WIDTH_PC;

    if (parentColumn) {
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
    longPressTimerRef.current = window.setTimeout(() => {
      onHoverStart();
    }, 500); 

    if (isLocked) {
      onActivate();
      return;
    }
    e.stopPropagation();
    handleStart(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    onHoverEnd();
  };

  const handleTouchMoveLocal = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    onHoverEnd();
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
      className={`absolute flex flex-col items-center select-none transition-shadow touch-manipulation timeline-card ${getZIndex()} ${!isLocked ? 'cursor-grab' : ''}`}
      style={{ 
        top, 
      }}
    >
      <style>{`
        #card-${event.id} {
          left: calc((100% - ${CARD_WIDTH_MOBILE}px) * ${currentX / 100});
        }
        @media (min-width: ${BREAKPOINT}px) {
          #card-${event.id} {
            left: calc((100% - ${CARD_WIDTH_PC}px) * ${currentX / 100});
          }
        }
      `}</style>

      <div className={`card-inner w-full rounded-xl border-2 p-2 md:p-3 transition-all min-h-[50px] relative backdrop-blur-sm ${colorStyle.class} ${colorStyle.bgClass} ${
        isDragging 
          ? 'shadow-xl' 
          : 'shadow-md hover:shadow-lg'
      } ${!isLocked ? 'ring-2 ring-yellow-400 ring-offset-2' : ''} ${
        isHighlighted ? 'ring-4 ring-yellow-300 ring-offset-2 scale-105 transition-transform' : ''
      }`}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMoveLocal}
      >
        
        <div 
          className="absolute -top-3 -right-3 bg-white border border-slate-200 rounded-full p-1.5 shadow-sm cursor-pointer hover:bg-slate-50 z-50"
          onClick={handleToggleLock}
          onTouchEnd={(e) => { e.stopPropagation(); handleToggleLock(e as any); }}
        >
          {isLocked ? <Lock size={12} className="text-slate-400" /> : <Unlock size={12} className="text-yellow-500" />}
        </div>

        <div className="flex justify-between items-start mb-1.5">
          <span className="text-[9px] md:text-[10px] font-mono text-slate-500 bg-white/70 px-1.5 py-0.5 rounded border border-slate-200">{event.date}</span>
          
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
            
            {!isLocked && (
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition-colors animate-in fade-in duration-200"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <Edit2 size={14} />
              </button>
            )}
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
  const handleBackdropClick = () => {
    if (confirm('編集を終了しますか？\n保存されていない変更は破棄されます。')) {
      onClose();
    }
  };

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={handleBackdropClick}>
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
                    className="w-40 text-xs p-1.5 border border-slate-200 rounded bg-white truncate"
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
                    className="w-8 h-7 p-0 border-0 rounded cursor-pointer shrink-0"
                  />
                  <button 
                    onClick={() => handleRemoveLink(idx)}
                    className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-200 shrink-0"
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
