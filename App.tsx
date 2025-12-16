import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cn } from './utils/cn';
import { GenerationState } from './types';
import { mockGenerateImageApi, smartCropFromClick, fileToBase64, getDominantColor } from './services/imageProcessor';
import { generateImageVariation, upscaleImage, downloadImage } from './services/geminiService';
import { userApi, inviteApi } from './services/api';
import { generateInviteShareText } from './utils/inviteTemplate';
import {
  PhotoIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  ArchiveBoxArrowDownIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  HomeIcon,
  ClockIcon,
  CheckIcon,
  PencilSquareIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SignalIcon,
  WifiIcon,
  Battery100Icon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  WrenchScrewdriverIcon,
  CpuChipIcon,
  ArrowUpTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon
} from '@heroicons/react/24/outline';

// ---------------------------------------------------------------------------
// 1. CONFIGURATION & TYPES
// ---------------------------------------------------------------------------

// 提示词配置已移至 config/prompts.json 和 config/prompts.ts

// Updated Colors for Yohji Theme - Monochrome & Cyan
const ROOM_CATEGORIES = {
  residential: {
    label: '家装空间',
    icon: <HomeIcon className="w-5 h-5" />,
    type: 'flat',
    options: ['客厅', '家用餐厅', '厨房', '卧室', '家用卫生间', '书房 / 工作区', '玄关', '阳台', '儿童房', '多功能房'],
    colorClass: 'bg-black text-white border-zinc-800 font-bold',
    hoverClass: 'hover:border-accent hover:text-accent'
  },
  commercial: {
    label: '工装空间',
    icon: <BuildingOfficeIcon className="w-5 h-5" />,
    type: 'grouped',
    groups: [
      {
        name: '行业场景',
        options: ['办公', '酒店', '餐饮', '零售 / 商店', '医疗', '教育', '展览 / 展馆'],
        colorClass: 'bg-black text-white border-zinc-800 font-bold',
        hoverClass: 'hover:border-accent hover:text-accent'
      },
      {
        name: '空间类型',
        options: [
          '大堂', '前台', '接待区', '会议室', '开放办公区', '独立办公室', '洽谈区',
          '展示区', '就餐区', '咖啡区', '休息区', '公共活动区', '客房', '健身房',
          '走廊', '电梯厅', '门头', '户外区', '公共卫生间'
        ],
        colorClass: 'bg-black text-white border-zinc-800 font-bold',
        hoverClass: 'hover:border-accent hover:text-accent'
      }
    ]
  }
};

const TAG_VARIANTS = [
  { label: 'Good', bg: 'bg-emerald-500', text: 'text-white' },
  { label: 'Nice', bg: 'bg-cyan-500', text: 'text-black' },
  { label: 'Wow!', bg: 'bg-rose-500', text: 'text-white' },
  { label: 'Pick', bg: 'bg-violet-500', text: 'text-white' },
  { label: 'Love', bg: 'bg-pink-500', text: 'text-white' },
  { label: 'Fav', bg: 'bg-amber-500', text: 'text-black' },
  { label: 'OK', bg: 'bg-lime-500', text: 'text-black' },
  { label: '⭐', bg: 'bg-yellow-400', text: 'text-black' },
];

// Minimalist Loading Tips - Yohji Style & Design Philosophy
const LOADING_TIPS = [
  "Black is modest and arrogant at the same time. — Yohji Yamamoto",
  "Good design is about subtraction. — Detlef Mertins",
  "Design is intelligence made visible. — Alina Wheeler",
  "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
  "Mark regions to guide the AI's focus.",
  "Collect inspirations to build your library.",
  "Perfection is achieved when there is nothing left to take away.",
  "Architecture is the learned game, correct and magnificent, of forms assembled in the light.",
  "The details are not the details. They make the design. — Charles Eames"
];

interface Marker {
  id: number;
  x: number;
  y: number;
  variantIdx: number;
  rotation: number;
  isRemoving?: boolean;
}

interface FlyingItem {
  id: number;
  src: string;
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
}

interface MagnifierState {
  show: boolean;
  x: number;
  y: number;
  relX: number;
  relY: number;
  imgWidth: number;
  imgHeight: number;
  // New fields for global positioning
  screenX: number;
  screenY: number;
}

interface HistoryItem {
  id: string;
  url: string;
  timestamp: Date;
  tags: string[];
}

interface CollectionItem {
  id: string;
  url: string;
  timestamp: number;
  tags: string[];
}

interface UpscaleStatus {
  visible: boolean;
  state: 'idle' | 'processing' | 'success';
  completedCount: number;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// 2. UI COMPONENTS (Sci-Fi Industrial)
// ---------------------------------------------------------------------------

const SciFiPanel = ({ title, children, className = '', action, overlay, isLight = false }: { title: React.ReactNode, children: React.ReactNode, className?: string, action?: React.ReactNode, overlay?: React.ReactNode, isLight?: boolean }) => (
  <div className={cn(
    "flex flex-col relative transition-all duration-300",
    className
  )}>
    {/* Header - Clean minimal - Fixed height for alignment */}
    <div className="flex justify-between items-center select-none flex-shrink-0 z-10 h-8 mb-2 px-1 pt-1">
      <h3 className={cn("text-sm flex items-center gap-2 font-serif tracking-[0.1em] transition-colors duration-500 font-medium",
        isLight ? 'text-zinc-600' : 'text-zinc-400')}
      >
        {title}
      </h3>
      {action}
    </div>

    {overlay}

    {/* Body */}
    <div className="relative flex-1 min-h-0 bg-transparent overflow-hidden flex flex-col">
      <div className="w-full h-full overflow-hidden flex flex-col relative z-10 has-scrollbar">
        {children}
      </div>
    </div>
  </div>
);

const SciFiButton = ({ children, onClick, disabled, variant = 'primary', className = '', ...props }: any) => {
  // 参考图风格：扁平化、极细边框、物理反馈
  const base = "px-5 py-2.5 text-[11px] font-normal tracking-[0.1em] transition-all duration-300 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-serif rounded-md";
  const variants = {
    primary: "bg-transparent border border-zinc-800 text-zinc-800 hover:bg-zinc-800 hover:text-white hover:scale-[1.02] shadow-sm hover:shadow-md",
    outline: "bg-transparent border border-zinc-300 text-zinc-500 hover:border-zinc-500 hover:text-zinc-700 hover:bg-zinc-50",
    danger: "bg-transparent border border-red-300 text-red-500 hover:border-red-500 hover:bg-red-50",
    ghost: "border-0 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100/50"
  };
  // 深色模式变体
  const darkVariants = {
    primary: "bg-transparent border border-zinc-400 text-zinc-300 hover:bg-white hover:text-black hover:scale-[1.02] shadow-black/20",
    outline: "bg-transparent border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 hover:bg-white/5",
    danger: "bg-transparent border border-red-800 text-red-400 hover:border-red-500 hover:bg-red-900/10",
    ghost: "border-0 text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
  };
  return (
    <button
      className={cn(
        base,
        variants[variant as keyof typeof variants],
        `dark:${darkVariants[variant as keyof typeof darkVariants]}`,
        className
      )}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}

// Mobile Tab Button Component
// Mobile Tab Button Component - Refined Yohji Style
const MobileTabButton = ({
  icon,
  label,
  active,
  onClick,
  badge,
  isLight
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center gap-1.5 w-full h-full relative transition-all duration-500",
      active
        ? isLight ? 'text-black' : 'text-white'
        : isLight ? 'text-zinc-400' : 'text-zinc-600'
    )}
  >
    {/* Minimal Active Indicator - Just a subtle dot or weight change */}
    {/* {active && (
      <div className={`absolute top-2 w-1 h-1 rounded-full ${isLight ? 'bg-black' : 'bg-white'}`} />
    )} */}

    <div className={cn("w-5 h-5 relative transition-transform duration-500", active ? 'scale-110' : 'scale-100')}>
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className={cn(
          "absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center text-[9px] font-bold rounded-full px-0.5",
          isLight ? 'bg-black text-white' : 'bg-white text-black'
        )}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
    <span className={cn(
      "text-[10px] tracking-[0.2em] font-serif transition-all duration-500",
      active ? 'opacity-100 font-medium' : 'opacity-70 font-normal'
    )}>{label}</span>
  </button>
);

// Mobile Guide Tooltip - Lightweight, non-intrusive, semi-transparent
const MobileGuideTooltip = ({
  children,
  show,
  position = 'bottom',
  onDismiss
}: {
  children: React.ReactNode;
  show: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
  onDismiss?: () => void;
}) => {
  if (!show) return null;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[#00ffff]/80 border-t-4 border-l-4 border-r-4 border-l-transparent border-r-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#00ffff]/80 border-b-4 border-l-4 border-r-4 border-l-transparent border-r-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[#00ffff]/80 border-l-4 border-t-4 border-b-4 border-t-transparent border-b-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[#00ffff]/80 border-r-4 border-t-4 border-b-4 border-t-transparent border-b-transparent'
  };

  return (
    <div
      className={cn(
        "absolute z-50 transition-all duration-500 ease-out animate-in fade-in-0 slide-in-from-bottom-2",
        positionClasses[position]
      )}
      onClick={onDismiss}
    >
      <div className="bg-accent/80 backdrop-blur-sm text-black text-[10px] px-2.5 py-1.5 rounded-md whitespace-nowrap font-serif shadow-lg cursor-pointer border border-accent/50">
        {children}
      </div>
      <div className={cn("absolute w-0 h-0", arrowClasses[position])} />
    </div>
  );
};

const ClockDisplay = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-center leading-tight select-none opacity-50 hover:opacity-100 transition-opacity">
      <span className="text-xl font-light text-zinc-500 tracking-widest font-mono">
        {time.toLocaleTimeString('en-US', { hour12: false })}
      </span>
      <span className="text-[9px] font-bold text-zinc-600 tracking-[0.4em]">
        {time.toISOString().split('T')[0].replace(/-/g, '.')}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. MAIN APP
// ---------------------------------------------------------------------------

interface AppProps {
  userEmail?: string;
  userPoints?: number;
  onOpenUserCenter?: () => void;
  onUpdatePoints?: (points: number, dailyPoints: number) => void;
  onThemeChange?: (isLightMode: boolean) => void;
}

export default function App({ userEmail, userPoints, onOpenUserCenter, onUpdatePoints, onThemeChange }: AppProps) {
  // Tips Carousel State
  const [currentTipIndex, setCurrentTipIndex] = useState(0);



  // Viewport State
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => localStorage.getItem('cache_previewUrl') || null);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_roomTypes') || '[]'); } catch { return []; }
  });
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(() => localStorage.getItem('cache_generatedUrl') || null);
  const [fidelityLevel, setFidelityLevel] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem('cache_fidelity') || '3'); } catch { return 3; }
  });
  const [markers, setMarkers] = useState<Marker[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_markers') || '[]'); } catch { return []; }
  });
  const [collection, setCollection] = useState<CollectionItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_collection') || '[]'); } catch { return []; }
  });
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('cache_history');
      if (!saved) return [];
      return JSON.parse(saved).map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp) // Re-hydrate Date object
      }));
    } catch { return []; }
  });
  const [genState, setGenState] = useState<GenerationState>({ status: 'idle' });
  const [isProcessingCollection, setIsProcessingCollection] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(true);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [upscaleStatus, setUpscaleStatus] = useState<UpscaleStatus>({ visible: false, state: 'idle', completedCount: 0, totalCount: 0 });
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [inviteCodes, setInviteCodes] = useState<string[]>([]);
  const [showInviteCopied, setShowInviteCopied] = useState(false);
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [customResTag, setCustomResTag] = useState(() => localStorage.getItem('cache_customResTag') || "自定义+");
  const [customComTag, setCustomComTag] = useState(() => localStorage.getItem('cache_customComTag') || "自定义+");
  const [editingCustom, setEditingCustom] = useState<'res' | 'com' | null>(null);

  // Persistence Effects
  useEffect(() => {
    try {
      if (previewUrl) localStorage.setItem('cache_previewUrl', previewUrl);
      else localStorage.removeItem('cache_previewUrl');
    } catch (e) {
      console.warn('Cache quota exceeded');
    }
  }, [previewUrl]);

  useEffect(() => { localStorage.setItem('cache_roomTypes', JSON.stringify(selectedRoomTypes)); }, [selectedRoomTypes]);

  useEffect(() => {
    try {
      if (generatedImageUrl) localStorage.setItem('cache_generatedUrl', generatedImageUrl);
      else localStorage.removeItem('cache_generatedUrl');
    } catch (e) { console.warn('Storage quota exceeded for generated image'); }
  }, [generatedImageUrl]);

  useEffect(() => { try { localStorage.setItem('cache_fidelity', JSON.stringify(fidelityLevel)); } catch { } }, [fidelityLevel]);
  useEffect(() => { try { localStorage.setItem('cache_markers', JSON.stringify(markers)); } catch { } }, [markers]);
  useEffect(() => { try { localStorage.setItem('cache_collection', JSON.stringify(collection)); } catch { } }, [collection]);
  useEffect(() => { try { localStorage.setItem('cache_history', JSON.stringify(history)); } catch { } }, [history]);
  useEffect(() => { try { localStorage.setItem('cache_customResTag', customResTag); } catch { } }, [customResTag]);
  useEffect(() => { try { localStorage.setItem('cache_customComTag', customComTag); } catch { } }, [customComTag]);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverSource, setIsDraggingOverSource] = useState(false);
  const dragCounter = useRef(0);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [magnifier, setMagnifier] = useState<MagnifierState>({ show: false, x: 0, y: 0, relX: 0, relY: 0, imgWidth: 0, imgHeight: 0, screenX: 0, screenY: 0 });

  // Image & Container Refs for Marker Positioning
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgRect, setImgRect] = useState<{ width: number, height: number, left: number, top: number } | null>(null);

  // History Tab Draggable State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyBtnPos, setHistoryBtnPos] = useState({ y: 300 }); // Initial Y position
  const isDraggingHistory = useRef(false);
  const historyDragStartY = useRef(0);
  const historyDidDrag = useRef(false);

  // New Image Animation State
  const [showNewImageAnim, setShowNewImageAnim] = useState(false);

  // Feature: Theme & Archive Preview - Default to light mode
  const [isLightMode, setIsLightMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'light' : true; // Default to light mode if no preference saved
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isPreviewZoomed, setIsPreviewZoomed] = useState(false);
  const previewModalRef = useRef<HTMLDivElement>(null);

  // Reset zoom when opening new image
  useEffect(() => {
    if (previewImage) setIsPreviewZoomed(false);
  }, [previewImage]);

  const [showCollectTooltip, setShowCollectTooltip] = useState(false);
  const [showGenerateTooltip, setShowGenerateTooltip] = useState(false);

  // Button glow effect - mouse position tracking
  const [generateBtnGlow, setGenerateBtnGlow] = useState<{ x: number, y: number, active: boolean }>({ x: 0, y: 0, active: false });
  const [collectBtnGlow, setCollectBtnGlow] = useState<{ x: number, y: number, active: boolean }>({ x: 0, y: 0, active: false });

  // UX State Guidance - Non-intrusive visual hints
  const [showClickHint, setShowClickHint] = useState(false);
  const [hasCollectedAfterMark, setHasCollectedAfterMark] = useState(false);


  // Feature: Collapsible Left Sidebar
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);

  // Mobile Tab Navigation
  const [mobileTab, setMobileTab] = useState<'config' | 'viewport' | 'collection'>('config');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  // Responsive detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile Onboarding Guide System
  const [mobileGuideStep, setMobileGuideStep] = useState<number>(0);
  const [hasSeenMobileGuide, setHasSeenMobileGuide] = useState(() => {
    return localStorage.getItem('hasSeenMobileGuide') === 'true';
  });

  // Cycle tips during generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (genState.status === 'generating') {
      interval = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [genState.status]);

  // UX Guidance: Reset collection breathing state when new markers are added
  useEffect(() => {
    if (markers.length > 0) {
      setHasCollectedAfterMark(false);
    }
  }, [markers.length]);

  // UX Guidance: Dismiss click hint when user clicks to add marker
  useEffect(() => {
    if (markers.length > 0 && showClickHint) {
      setShowClickHint(false);
    }
  }, [markers.length, showClickHint]);

  // Initialize mobile guide: show config tab first for new users
  useEffect(() => {
    if (isMobile && !hasSeenMobileGuide && userEmail) {
      setMobileTab('config');
      setMobileGuideStep(1); // Start guide from step 1
    }
  }, [isMobile, userEmail]);

  // Advance guide when user completes actions
  const advanceMobileGuide = (nextStep: number) => {
    if (mobileGuideStep > 0 && mobileGuideStep < nextStep) {
      setMobileGuideStep(nextStep);
    }
  };

  // Complete mobile guide
  const completeMobileGuide = () => {
    setMobileGuideStep(0);
    localStorage.setItem('hasSeenMobileGuide', 'true');
  };

  // First-time user guide tooltip (desktop)
  const [showFirstTimeGuide, setShowFirstTimeGuide] = useState(false);

  // VPN Error Alert
  const [showVpnAlert, setShowVpnAlert] = useState(false);

  const dismissFirstTimeGuide = () => {
    setShowFirstTimeGuide(false);
    localStorage.setItem('hasSeenImageGuide', 'true');
  };

  const toggleTheme = () => {
    setIsLightMode(prev => {
      const newValue = !prev;
      localStorage.setItem('theme', newValue ? 'light' : 'dark');
      return newValue;
    });
  };

  // Theme Effect
  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    // Report theme to parent
    onThemeChange?.(isLightMode);
  }, [isLightMode, onThemeChange]);

  // ESC key to close preview modal
  useEffect(() => {
    if (!previewImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  // 获取用户邀请码（用于分享）
  useEffect(() => {
    if (userEmail) {
      inviteApi.getMyCodes().then(data => {
        const availableCodes = data.codes?.filter((c: any) => !c.isUsed).map((c: any) => c.code) || [];
        setInviteCodes(availableCodes);
      }).catch(() => { });
    }
  }, [userEmail]);

  // 复制邀请话术和链接
  const handleCopyInvite = async () => {
    if (inviteCodes.length === 0) return;

    const shareText = generateInviteShareText(inviteCodes[0]);

    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(shareText);
      setShowInviteCopied(true);
      setTimeout(() => setShowInviteCopied(false), 3000);
    } catch (err) {
      console.error('Clipboard API failed:', err);
      // Fallback for mobile: use execCommand
      try {
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (success) {
          setShowInviteCopied(true);
          setTimeout(() => setShowInviteCopied(false), 3000);
        } else {
          alert('复制失败，请手动复制邀请码：' + inviteCodes[0]);
        }
      } catch (e) {
        alert('复制失败，请手动复制邀请码：' + inviteCodes[0]);
      }
    }
  };


  // Key Listeners
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) await processFile(file);
          break;
        }
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setIsCtrlPressed(false);
    };
    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update Image Rect on Resize or Image Load
  useEffect(() => {
    if (!imageRef.current || !containerRef.current || !generatedImageUrl) {
      setImgRect(null);
      return;
    }

    const updateRect = () => {
      if (imageRef.current && containerRef.current) {
        const img = imageRef.current.getBoundingClientRect();
        const container = containerRef.current.getBoundingClientRect();

        setImgRect({
          width: img.width,
          height: img.height,
          left: img.left - container.left,
          top: img.top - container.top
        });
      }
    };

    // Create ResizeObserver
    const observer = new ResizeObserver(updateRect);
    observer.observe(imageRef.current);
    observer.observe(containerRef.current);

    // Also update on window resize
    window.addEventListener('resize', updateRect);

    // Initial call
    // Delay slightly to ensure layout is done
    setTimeout(updateRect, 100);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
    };
  }, [generatedImageUrl]);

  // Handlers
  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setSelectedFile(file);
    const base64 = await fileToBase64(file);
    setPreviewUrl(base64);
    setGenState({ status: 'idle' });
    setGeneratedImageUrl(null);
    setMarkers([]);
    setSelectedCollectionIds(new Set());

    // Advance mobile guide to step 2 (select tags)
    advanceMobileGuide(2);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) await processFile(e.target.files[0]);
  };

  const handleSourceDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverSource(true);
  };

  const handleSourceDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverSource(false);
  };

  const handleSourceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 允许 drop
  };

  const handleSourceDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverSource(false);

    // 1. 检查是否是内部归档图片 (Collection Item)
    const collectionItemData = e.dataTransfer.getData("application/vibe-forge-collection-item");
    if (collectionItemData) {
      try {
        const item = JSON.parse(collectionItemData);
        if (item && item.url) {
          // 使用归档图片作为新的源图
          // 因为是 Base64，直接设置
          setPreviewUrl(item.url);
          setSelectedFile(null); // 清除选中的文件对象，因为是来自内部
          setGenState({ status: 'idle' });
          setGeneratedImageUrl(null);
          setMarkers([]);
          setSelectedCollectionIds(new Set());
          return;
        }
      } catch (err) {
        console.error("Failed to parse collection item data", err);
      }
    }

    // 2. 检查是否是外部文件
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };


  const toggleRoomType = (type: string) => {
    setSelectedRoomTypes(prev => {
      const newTypes = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
      // Advance mobile guide when first tag is selected
      if (newTypes.length > 0 && mobileGuideStep === 2) {
        advanceMobileGuide(3);
      }
      return newTypes;
    });
  };

  const handleCustomTagSave = (type: 'res' | 'com', newValue: string) => {
    const oldValue = type === 'res' ? customResTag : customComTag;
    if (!newValue.trim()) {
      handleCustomTagReset(type);
      setEditingCustom(null);
      return;
    }
    if (type === 'res') setCustomResTag(newValue); else setCustomComTag(newValue);
    if (selectedRoomTypes.includes(oldValue)) setSelectedRoomTypes(prev => prev.filter(t => t !== oldValue).concat(newValue));
    setEditingCustom(null);
  };

  const handleCustomTagReset = (type: 'res' | 'com') => {
    const oldValue = type === 'res' ? customResTag : customComTag;
    if (selectedRoomTypes.includes(oldValue)) {
      setSelectedRoomTypes(prev => prev.filter(t => t !== oldValue));
    }
    if (type === 'res') setCustomResTag('自定义+');
    else setCustomComTag('自定义+');
  };

  // 点击外部时自动关闭编辑并重置空标签
  useEffect(() => {
    if (!editingCustom) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (customInputRef.current && !customInputRef.current.contains(e.target as Node)) {
        const value = customInputRef.current.value.trim();
        if (!value) {
          handleCustomTagReset(editingCustom);
        } else {
          handleCustomTagSave(editingCustom, value);
        }
        setEditingCustom(null);
      }
    };

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingCustom, customResTag, customComTag]);

  const renderCustomTag = (type: 'res' | 'com', colorClass: string) => {
    const isEditing = editingCustom === type;
    const value = type === 'res' ? customResTag : customComTag;
    const isSelected = selectedRoomTypes.includes(value);
    const isDefault = value === '自定义+';

    if (isEditing) {
      return (
        <input
          ref={customInputRef}
          autoFocus
          type="text"
          defaultValue={isDefault ? '' : value}
          placeholder="输入标签..."
          className={`px-3 py-1 text-[11px] border outline-none w-24 font-['Noto_Serif_SC_Variable'] rounded-sm
            ${isLightMode ? 'bg-white border-zinc-400 text-zinc-800' : 'bg-zinc-800 border-zinc-600 text-zinc-200'}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (!e.currentTarget.value.trim()) {
                handleCustomTagReset(type);
              } else {
                handleCustomTagSave(type, e.currentTarget.value);
              }
              setEditingCustom(null);
            }
            if (e.key === 'Escape') {
              if (isDefault) {
                handleCustomTagReset(type);
              }
              setEditingCustom(null);
            }
          }}
        />
      );
    }
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            if (isDefault) {
              setEditingCustom(type);
            } else {
              toggleRoomType(value);
            }
          }}
          className={`px-3 py-1 text-[11px] transition-all duration-200 border cursor-pointer tracking-wide font-['Noto_Serif_SC_Variable'] rounded-sm
            ${isSelected
              ? isLightMode ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-white'
              : isLightMode ? 'bg-transparent border-zinc-300 text-zinc-500 hover:border-zinc-500 hover:text-zinc-800' : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'}
          `}>
          {value}
        </button>
        {!isDefault && (
          <>
            <button
              onClick={() => setEditingCustom(type)}
              className={`p-1 transition-colors ${isLightMode ? 'text-zinc-800 hover:text-zinc-700' : 'text-zinc-600 hover:text-zinc-300'}`}
              title="编辑"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleCustomTagReset(type)}
              className={`p-1 transition-colors ${isLightMode ? 'text-zinc-800 hover:text-red-500' : 'text-zinc-600 hover:text-red-400'}`}
              title="清空"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {isDefault && (
          <PencilSquareIcon className={`w-3.5 h-3.5 ${isLightMode ? 'text-zinc-800' : 'text-zinc-600'}`} />
        )}
      </div>
    );
  };

  // getGenConfig 已移至 config/prompts.ts

  const handleGenerate = async () => {
    if (!previewUrl) return;

    // ✅ 立即设置 loading 状态 —— UI 会在 50ms 内响应
    setPointsError(null);
    setGenState({ status: 'generating' });
    setMarkers([]);
    setIsMobileMenuOpen(false);

    // 使用 requestAnimationFrame 确保浏览器完成 repaint 后再执行重任务
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 检查积分是否足够 (需要 100 积分)
    try {
      const pointsCheck = await userApi.checkPoints(100);
      if (!pointsCheck.sufficient) {
        setPointsError(`积分不足，需要 100 积分，当前仅有 ${pointsCheck.totalPoints} 积分`);
        setGenState({ status: 'idle' }); // 恢复状态
        return;
      }
    } catch (err: any) {
      // 积分检查失败时阻止操作
      console.error("Points check failed:", err);
      setPointsError('积分检查失败，请刷新页面重试');
      setGenState({ status: 'idle' }); // 恢复状态
      return;
    }

    let imageUrl: string | null = null;
    let usedMockFallback = false;

    try {
      // 先尝试生成图片 (只传递 tags 和 level，prompt 在后端构建)
      try {
        imageUrl = await generateImageVariation(selectedRoomTypes, fidelityLevel, previewUrl);
      } catch (aiError) {
        console.warn("Real AI generation failed, falling back to mock.", aiError);
        // 使用了回退机制，标记并显示VPN提示
        usedMockFallback = true;
        // Mock 仍需完整 prompt（仅用于本地调试）
        const mockPrompt = `Mock prompt for tags: ${selectedRoomTypes.join(', ')} at level ${fidelityLevel}`;
        imageUrl = await mockGenerateImageApi(mockPrompt, previewUrl);
      }

      // 如果没有成功生成图片，不扣分
      if (!imageUrl) throw new Error("Failed to retrieve image data.");

      // 如果使用了Mock回退（VPN问题导致），显示提示但不扣分
      if (usedMockFallback) {
        console.warn("Mock fallback used - VPN issue suspected, not charging points");
        setGeneratedImageUrl(imageUrl); // 仍然显示生成的图片给用户看
        setGenState({ status: 'completed' }); // 显示为完成状态
        setShowVpnAlert(true); // 弹出VPN提示
        // 不保存到历史，不扣分
        return;
      }

      // 生成成功且非重复后再扣积分
      try {
        const consumeResult = await userApi.consumePoints(100, 'generate');
        // 同步更新显示的积分
        if (onUpdatePoints && consumeResult) {
          onUpdatePoints(consumeResult.newPoints, consumeResult.newDailyPoints);
        }
      } catch (consumeErr: any) {
        // 扣分失败时记录错误，但允许用户看到图片（避免重复生成消耗API）
        console.error("Points consumption failed:", consumeErr);
        // 可选：显示警告但不阻止
      }

      setGeneratedImageUrl(imageUrl);
      setHistory(prev => [{ id: Date.now().toString(), url: imageUrl!, timestamp: new Date(), tags: [...selectedRoomTypes] }, ...prev]);
      setGenState({ status: 'completed' });
      setShowNewImageAnim(true);
      setTimeout(() => setShowNewImageAnim(false), 2000);

      // Advance mobile guide to step 5 (mark and collect)
      advanceMobileGuide(5);

      // Show first-time guide if user hasn't seen it
      const hasSeenGuide = localStorage.getItem('hasSeenImageGuide');
      if (!hasSeenGuide) {
        setTimeout(() => setShowFirstTimeGuide(true), 2500);
      }

      // UX Guidance: Show subtle click hint on nine-grid
      setTimeout(() => setShowClickHint(true), 1200);
      setTimeout(() => setShowClickHint(false), 5500); // Auto-dismiss after ~2 cycles
    } catch (err) {
      console.error(err);
      // 生成失败不扣分，显示VPN提示弹窗
      setGenState({ status: 'error', error: "生成失败" });
      setShowVpnAlert(true);
    }
  };

  const handleRestoreHistory = async (item: HistoryItem) => {
    setGeneratedImageUrl(item.url);
    setMarkers([]);
    setGenState({ status: 'completed' });
    setIsHistoryOpen(false); // Close history panel on restore
    setShowNewImageAnim(true);
    setTimeout(() => setShowNewImageAnim(false), 2000);
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current || !generatedImageUrl) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) { setMagnifier(prev => ({ ...prev, show: false })); return; }
    setMagnifier({ show: true, x, y, relX: (x / rect.width) * 100, relY: (y / rect.height) * 100, imgWidth: rect.width, imgHeight: rect.height, screenX: e.clientX, screenY: e.clientY });
  };
  const handleImageMouseLeave = () => setMagnifier(prev => ({ ...prev, show: false }));

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    // Only handle clicks directly on the image
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Safety check: ensure click is within image bounds (0-1)
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    // Check if clicking near an existing marker to remove it
    const existingIndex = markers.findIndex(m => Math.abs(m.x - x) < 0.05 && Math.abs(m.y - y) < 0.05);
    if (existingIndex >= 0) {
      // Mark for removal animation first
      setMarkers(prev => prev.map((m, i) => i === existingIndex ? { ...m, isRemoving: true } : m));
      // Actually remove after animation
      setTimeout(() => {
        setMarkers(prev => prev.filter((_, i) => i !== existingIndex));
      }, 300);
    } else {
      setMarkers(prev => [...prev, {
        id: Date.now(),
        x,
        y,
        variantIdx: Math.floor(Math.random() * TAG_VARIANTS.length),
        rotation: Math.random() * 16 - 8 // Slightly more rotation for sticker feel
      }]);
    }
  };

  const handleMarkerRemove = (markerId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering image click
    setMarkers(prev => prev.map(m => m.id === markerId ? { ...m, isRemoving: true } : m));
    setTimeout(() => {
      setMarkers(prev => prev.filter(m => m.id !== markerId));
    }, 300);
  };

  const handleCollect = async () => {
    if (!generatedImageUrl || markers.length === 0 || !imageRef.current) return;
    setIsProcessingCollection(true);
    const imgRect = imageRef.current.getBoundingClientRect();

    // Calculate safer target (center of the right panel)
    // The right panel is approx the last 25% of the screen width
    const targetX = window.innerWidth * 0.88;
    const targetY = window.innerHeight * 0.5; // Fly to middle of height

    const itemsToFly: FlyingItem[] = [];
    const timestamp = Date.now();

    try {
      const newItems: CollectionItem[] = await Promise.all(markers.map(async (marker) => {
        const cropUrl = await smartCropFromClick(generatedImageUrl!, marker.x, marker.y);
        const startX = imgRect.left + (marker.x * imgRect.width);
        const startY = imgRect.top + (marker.y * imgRect.height);

        // Adjust delta so it flies relative to start
        itemsToFly.push({
          id: marker.id,
          src: cropUrl,
          startX,
          startY,
          deltaX: targetX - startX,
          deltaY: targetY - startY
        });
        return { id: `${timestamp}-${marker.id}`, url: cropUrl, tags: [...selectedRoomTypes], timestamp: timestamp };
      })
      );
      setFlyingItems(itemsToFly);
      setMarkers([]); // Clear markers immediately
      setHasCollectedAfterMark(true); // UX Guidance: Stop breathing animation

      // Sync with animation duration (0.8s)
      setTimeout(() => {
        setCollection(prev => [...newItems, ...prev]);
        setFlyingItems([]);
        setIsProcessingCollection(false);
      }, 800);

    } catch (e) {
      console.error(e);
      setIsProcessingCollection(false);
    }
  };

  const handleDeleteFromCollection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCollection(prev => prev.filter(item => item.id !== id));
    setSelectedCollectionIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  };
  const toggleSelection = (id: string) => setSelectedCollectionIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const handleDownloadZip = async () => {
    if (selectedCollectionIds.size === 0) return alert("请先选择需要下载的图片");
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("vibe-forge");
      collection.forEach((item) => { if (selectedCollectionIds.has(item.id)) folder?.file(`${item.id}.png`, item.url.split(',')[1], { base64: true }); });
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = "vibe-forge.zip"; link.click();
    } catch (e) {
      console.error(e);
      alert("Download Failed");
    } finally {
      setIsZipping(false);
    }
  };

  const handleUpscaleSelected = async () => {
    if (selectedCollectionIds.size === 0) return alert("请先选择需要放大的图片");

    const itemsToProcess = collection.filter(item => selectedCollectionIds.has(item.id));
    const totalCost = itemsToProcess.length * 50; // 每张图 50 积分

    // ✅ 立即设置 loading 状态
    setPointsError(null);
    setUpscaleStatus({ visible: true, state: 'processing', completedCount: 0, totalCount: itemsToProcess.length });

    // 确保 UI 渲染后再执行重任务
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 检查积分是否足够
    try {
      const pointsCheck = await userApi.checkPoints(totalCost);
      if (!pointsCheck.sufficient) {
        setPointsError(`积分不足，放大 ${itemsToProcess.length} 张图需要 ${totalCost} 积分，当前仅有 ${pointsCheck.totalPoints} 积分`);
        setUpscaleStatus({ visible: false, state: 'idle', completedCount: 0, totalCount: 0 });
        return;
      }
    } catch (err: any) {
      console.error("Points check failed:", err);
      setPointsError('积分检查失败，请刷新页面重试');
      setUpscaleStatus({ visible: false, state: 'idle', completedCount: 0, totalCount: 0 });
      return;
    }

    try {
      // 收集所有放大后的图片 (URL 来自后端)
      const upscaledImages: { filename: string; url: string }[] = [];

      for (const item of itemsToProcess) {
        try {
          // 放大图片，返回 URL
          const upscaledUrl = await upscaleImage(item.url);

          // 放大成功后扣积分
          try {
            const consumeResult = await userApi.consumePoints(50, 'upscale');
            if (onUpdatePoints && consumeResult) {
              onUpdatePoints(consumeResult.newPoints, consumeResult.newDailyPoints);
            }
          } catch (consumeErr: any) {
            console.warn("Points consumption failed:", consumeErr);
          }

          // 收集放大后的图片 URL
          upscaledImages.push({
            filename: `upscaled_${item.id}.png`,
            url: upscaledUrl
          });

          setUpscaleStatus(prev => ({ ...prev, completedCount: prev.completedCount + 1 }));
        } catch (e) {
          console.error("Upscale failed for item:", item.id, e);
        }
      }

      // 所有图片放大完成后，打包成 ZIP 下载
      if (upscaledImages.length > 0) {
        const zip = new JSZip();
        const folder = zip.folder("upscaled-images");

        // 从 URL 获取图片并添加到 ZIP
        for (const img of upscaledImages) {
          try {
            const response = await fetch(img.url);
            if (response.ok) {
              const blob = await response.blob();
              folder?.file(img.filename, blob);
            }
          } catch (e) {
            console.error("Failed to fetch image for zip:", img.filename, e);
          }
        }

        // 生成并下载 ZIP
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `upscaled_${timestamp}_${upscaledImages.length}张.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
      }

      setUpscaleStatus(prev => ({ ...prev, state: 'success' }));
      setTimeout(() => setUpscaleStatus(prev => ({ ...prev, visible: false, state: 'idle' })), 5000);
    } catch (error) {
      console.error("Upscale batch error:", error);
      setUpscaleStatus(prev => ({ ...prev, visible: false }));
    }
  }

  // Drag Handlers for Collection (Simplified)
  const handleDragStart = (e: React.DragEvent, idx: number, item?: CollectionItem) => {
    dragItem.current = idx;
    // Attach data for dropping into Source Area
    if (item) {
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData("application/vibe-forge-collection-item", JSON.stringify(item));
    }
  };
  const handleDragEnter = (e: React.DragEvent, idx: number) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const copy = [...collection];
      const item = copy.splice(dragItem.current, 1)[0];
      copy.splice(dragOverItem.current, 0, item);
      setCollection(copy);
    }
    dragItem.current = null; dragOverItem.current = null;
  };

  // History Drag Handlers
  const handleHistoryMouseDown = (e: React.MouseEvent) => {
    isDraggingHistory.current = true;
    historyDragStartY.current = e.clientY;
    historyDidDrag.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleHistoryClick = () => {
    // Only toggle if we didn't drag
    if (!historyDidDrag.current) {
      setIsHistoryOpen(!isHistoryOpen);
    }
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingHistory.current) return;
      // Check if moved more than 3px to consider it a drag
      if (Math.abs(e.clientY - historyDragStartY.current) > 3) {
        historyDidDrag.current = true;
      }
      setHistoryBtnPos(prev => ({ y: Math.max(64, Math.min(window.innerHeight - 64, e.clientY)) }));
    };
    const handleWindowMouseUp = () => {
      isDraggingHistory.current = false;
      // Reset drag flag after a delay longer than click event
      setTimeout(() => {
        historyDidDrag.current = false;
      }, 300);
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isHistoryOpen]);

  return (
    <div
      className={`h-screen font-sans font-light flex flex-col select-none overflow-hidden transition-colors duration-500
        ${isLightMode ? 'bg-[#f7f6f4] text-zinc-800' : 'bg-[#1a1a1a] text-zinc-300'}`}
    >

      {/* Header - Responsive: Mobile Compact / Desktop Full */}
      <header className={`bg-transparent flex items-center justify-between z-50 flex-shrink-0 sticky top-0 relative transition-colors duration-300
        ${isMobile ? 'h-11 px-3' : 'h-12 px-6'}`}>

        {/* Left: Logo/Title */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Minimal vertical line */}
          <div className={`w-[2px] transition-colors duration-500 ${isMobile ? 'h-4' : 'h-5'} ${isLightMode ? 'bg-zinc-800' : 'bg-zinc-300'}`}></div>

          {/* Title */}
          {isMobile ? (
            // Mobile: Compact title
            <h1 className={`text-sm tracking-[0.1em] font-['Noto_Serif_SC_Variable'] transition-colors duration-500
              ${isLightMode ? 'font-medium text-zinc-800' : 'font-normal text-zinc-200'}`}>
              设计无限生成器
            </h1>
          ) : (
            // Desktop: Full title
            <div className="flex items-baseline gap-3">
              <span className={`text-[15px] tracking-[0.35em] uppercase font-light transition-colors duration-500
                ${isLightMode ? 'text-zinc-800' : 'text-zinc-400'}`} style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                DESIGN INFINITE
              </span>
              <h1 className={`text-base tracking-[0.15em] whitespace-nowrap font-['Noto_Serif_SC_Variable'] transition-colors duration-500
                ${isLightMode ? 'font-medium text-zinc-800' : 'font-normal text-zinc-200'}`}>
                设计无限生成器
              </h1>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className={`flex items-center justify-end ${isMobile ? 'gap-2' : 'gap-4'}`}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 border-0 outline-none bg-transparent transition-colors duration-200 ${isLightMode ? 'text-zinc-400 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-200'}`}
            title={isLightMode ? '切换深色模式' : '切换浅色模式'}
          >
            {isLightMode ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>

          <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'}`}>
            {/* Invite Button */}
            {userEmail && inviteCodes.length > 0 && (
              <div className="relative">
                <button
                  onClick={handleCopyInvite}
                  className={`group flex items-center justify-center transition-all duration-300 border font-['Noto_Serif_SC_Variable']
                    ${isMobile ? 'gap-1 px-2 h-9 text-[10px]' : 'gap-2 px-4 h-10 text-xs tracking-wider'}
                    ${showInviteCopied
                      ? 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50'
                      : isLightMode
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-300 hover:bg-cyan-100 hover:border-cyan-400'
                        : 'bg-[#00ffff]/10 text-[#00ffff] border-[#00ffff]/50 hover:bg-[#00ffff]/20 hover:border-[#00ffff]'
                    }`}
                  title="邀请好友赚积分"
                >
                  {showInviteCopied ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  )}
                  {isMobile ? (
                    <span className="font-medium">{showInviteCopied ? '已复制' : '邀请赚500'}</span>
                  ) : (
                    <span>{showInviteCopied ? '已复制' : <>邀请赚 <span className="font-bold">500</span> 积分</>}</span>
                  )}
                </button>
                {/* 提示气泡 */}
                {showInviteCopied && (
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 text-[11px] whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-2 font-['Noto_Serif_SC_Variable']
                    ${isLightMode ? 'bg-zinc-800 text-white' : 'bg-white text-zinc-800'} rounded shadow-lg`}>
                    已复制邀请话术！
                    <div className={`absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-b-4 
                      ${isLightMode ? 'border-b-zinc-800' : 'border-b-white'}`}></div>
                  </div>
                )}
              </div>
            )}

            {/* User Points Button */}
            {userEmail && (
              <button
                onClick={onOpenUserCenter}
                className={`group flex items-center border transition-all duration-300 overflow-hidden font-['Noto_Serif_SC_Variable']
                  ${isMobile ? 'h-9' : 'h-10 text-sm tracking-wider'}
                  ${isLightMode
                    ? 'border-zinc-200 hover:border-zinc-300 bg-white'
                    : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50'}`}
              >
                <div className={`flex items-center gap-1 h-full ${isMobile ? 'px-2' : 'px-3'} ${isLightMode ? 'bg-zinc-50' : 'bg-zinc-800/50'}`}>
                  <span className={`font-bold font-[Cinzel] tracking-wider leading-none ${isMobile ? 'text-sm' : 'text-base'} ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>{userPoints || 0}</span>
                  <span className={`font-medium font-['Noto_Serif_SC_Variable'] ${isMobile ? 'text-[9px]' : 'text-[10px]'} ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>积分</span>
                </div>
                {!isMobile && (
                  <div className={`flex items-center gap-1 px-3 h-full ${isLightMode ? 'text-zinc-800 hover:text-zinc-700' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    <span className="text-xs">用户中心</span>
                    <span className="text-[10px]">→</span>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Unified Top Border */}
      <div className={`h-[1px] mx-6 flex-shrink-0 transition-colors duration-500 ${isLightMode ? 'bg-zinc-300' : 'bg-zinc-800'}`} />

      {/* Main Layout - CSS Grid for exact 2:6:2 ratio (Desktop) / Tab-based (Mobile) */}
      <div className={`flex-1 flex flex-col gap-3 px-4 md:px-6 pt-4 z-10 overflow-hidden h-full md:grid md:gap-6 ${isLeftPanelOpen ? 'md:grid-cols-[2fr_6fr_2fr]' : 'md:grid-cols-[0fr_6fr_2fr]'} transition-all duration-500 ${isMobile ? 'pb-24' : 'pb-4'}`}>

        {/* LEFT: INPUTS (Collapsible on Desktop, Tab-based on Mobile) */}
        <div className={`flex flex-col gap-2 h-full overflow-hidden min-w-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] 
          ${isMobile
            ? mobileTab === 'config' ? 'flex-1' : 'hidden'
            : isLeftPanelOpen ? 'w-full opacity-100' : 'w-0 opacity-0 pointer-events-none'
          }`}>
          {/* Wrapper to prevent content reflow during collapse */}
          <div className="w-full min-w-0 flex flex-col gap-2 h-full">
            {/* SOURCE INPUT */}
            <SciFiPanel title="视觉源 SOURCE" className="flex-shrink-0" isLight={isLightMode}
              action={
                <div className="relative flex items-center gap-2">
                  {/* Mobile Guide Step 1 Tooltip - in action area so not blocked */}
                  <MobileGuideTooltip
                    show={isMobile && mobileGuideStep === 1}
                    position="bottom"
                    onDismiss={() => advanceMobileGuide(2)}
                  >
                    👆 点击下方上传参考图片
                  </MobileGuideTooltip>
                  <button
                    onClick={() => setIsLeftPanelOpen(false)}
                    className={`border-0 bg-transparent transition-colors ${isLightMode ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-600 hover:text-zinc-400'}`}
                    title="收起侧栏"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>
                </div>
              }
            >
              <div
                className={`relative group cursor-pointer border border-dashed h-28 flex items-center justify-center transition-all overflow-hidden
                ${isDraggingOverSource
                    ? isLightMode
                      ? 'border-[#0d9999] bg-[#0d9999]/10 shadow-[0_0_20px_rgba(13,153,153,0.2)]'
                      : 'border-[#00ffff] bg-black/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]'
                    : isLightMode
                      ? 'border-zinc-300 bg-white/50 hover:border-zinc-500 hover:bg-white/80'
                      : 'border-zinc-800 bg-black/20 hover:border-white hover:bg-black/40'
                  }
             `}
                onDragEnter={handleSourceDragEnter}
                onDragLeave={handleSourceDragLeave}
                onDragOver={handleSourceDragOver}
                onDrop={handleSourceDrop}
              >
                <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                {previewUrl ? (
                  <div className="relative w-full h-full">
                    <img src={previewUrl} className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className={`absolute bottom-0 left-0 right-0 text-[10px] p-1 font-mono text-center truncate ${isLightMode ? 'bg-zinc-800/80 text-white' : 'bg-black/60 text-white'}`}>
                      {selectedFile?.name || 'source_img.jpg'}
                    </div>
                    {/* Upload Overlay on Hover/Drag */}
                    <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isDraggingOverSource ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} ${isLightMode ? 'bg-zinc-800/50' : 'bg-black/40'}`}>
                      <ArrowPathIcon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-2 pointer-events-none relative">
                    <ArrowDownTrayIcon className={`w-5 h-5 mx-auto mb-1.5 transition-colors ${isDraggingOverSource ? (isLightMode ? 'text-[#0d9999]' : 'text-[#00ffff]') : (isLightMode ? 'text-zinc-800 group-hover:text-zinc-700' : 'text-zinc-500 group-hover:text-white')}`} />
                    <p className={`text-[11px] transition-colors font-['Noto_Serif_SC_Variable'] tracking-wide ${isDraggingOverSource ? (isLightMode ? 'text-[#0d9999]' : 'text-[#00ffff]') : (isLightMode ? 'text-zinc-800' : 'text-zinc-400')}`}>
                      {isDraggingOverSource ? '释放以替换图片' : '拖拽图片 或 点击上传'}
                    </p>
                    <p className={`text-[10px] mt-1 font-mono tracking-wider ${isLightMode ? 'text-zinc-800' : 'text-zinc-600'}`}>JPG / PNG / WEBP</p>
                  </div>
                )}
              </div>
            </SciFiPanel>

            {/* SPACE CONFIG */}
            <SciFiPanel title="空间定义 CONFIG" className="flex-1 min-h-0" isLight={isLightMode}>
              <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-2">
                {/* Residential */}
                <div className="mb-4 relative">
                  <div className={`flex items-center gap-2 text-xs font-medium mb-2.5 tracking-[0.05em] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    {ROOM_CATEGORIES.residential.icon} 家装空间
                    {/* Mobile Guide Step 2: Select Tags */}
                    <MobileGuideTooltip
                      show={isMobile && mobileGuideStep === 2}
                      position="right"
                      onDismiss={() => advanceMobileGuide(3)}
                    >
                      ✨ 选择空间类型
                    </MobileGuideTooltip>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ROOM_CATEGORIES.residential.options.map(opt => (
                      <button key={opt} onClick={() => toggleRoomType(opt)}
                        className={`px-3 py-1 text-[11px] transition-all duration-200 tracking-wide font-['Noto_Serif_SC_Variable'] border rounded-sm
                          ${selectedRoomTypes.includes(opt)
                            ? isLightMode ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-white'
                            : isLightMode
                              ? 'bg-transparent text-zinc-500 border-zinc-300 hover:border-zinc-500 hover:text-zinc-800'
                              : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300'}
                        `}>
                        {opt}
                      </button>
                    ))}
                    {renderCustomTag('res', '')}
                  </div>
                </div>

                {/* Commercial */}
                <div>
                  <div className={`flex items-center gap-2 text-xs font-medium mb-2.5 tracking-[0.05em] pt-3 border-t font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-700 border-zinc-200' : 'text-zinc-300 border-zinc-800'}`}>
                    {ROOM_CATEGORIES.commercial.icon} 工装空间
                  </div>
                  {ROOM_CATEGORIES.commercial.groups?.map((group, i) => (
                    <div key={i} className="mb-3">
                      <p className={`text-[11px] font-medium mb-1.5 font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`}>{group.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.options.map(opt => (
                          <button key={opt} onClick={() => toggleRoomType(opt)}
                            className={`px-3 py-1 text-[11px] transition-all duration-200 tracking-wide font-['Noto_Serif_SC_Variable'] border rounded-sm
                              ${selectedRoomTypes.includes(opt)
                                ? isLightMode ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-900 border-white'
                                : isLightMode
                                  ? 'bg-transparent text-zinc-500 border-zinc-300 hover:border-zinc-500 hover:text-zinc-800'
                                  : 'bg-transparent text-zinc-500 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300'}
                            `}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="mt-2">{renderCustomTag('com', '')}</div>
                </div>

                {/* FIDELITY CONTROL - Moved here */}
                <div className={`mt-4 pt-4 border-t ${isLightMode ? 'border-zinc-200' : 'border-zinc-800'}`}>
                  <div className={`flex justify-between text-[11px] mb-2.5 tracking-[0.1em] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-800' : 'text-zinc-400'}`}>
                    <span>参考图权重</span>
                    <span>标签权重</span>
                  </div>
                  <input type="range" min="1" max="5" step="1" value={fidelityLevel} onChange={(e) => setFidelityLevel(parseInt(e.target.value))}
                    className="yohji-slider" />
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[11px] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>{['参考图主导', '参考图偏重', '平衡模式', '提示词偏重', '提示词主导'][fidelityLevel - 1]}</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map(v => (
                        <div key={v} className={`w-1.5 h-1.5 rounded-full transition-colors ${fidelityLevel === v ? (isLightMode ? 'bg-[#0d9999]' : 'bg-[#00ffff]') : (isLightMode ? 'bg-zinc-300' : 'bg-zinc-700')}`}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </SciFiPanel>
          </div>
        </div>

        {/* CENTER: VIEWPORT */}
        <div className={`flex flex-col relative h-full overflow-hidden gap-4 transition-all duration-500 min-w-0 animate-fade-in-up delay-200
          ${isMobile ? (mobileTab === 'viewport' ? 'flex-1' : 'hidden') : ''}`}>
          <SciFiPanel title={
            <div className="flex items-center gap-3 whitespace-nowrap">
              <span>渲染视窗 VIEWPORT</span>
              {!isLeftPanelOpen && (
                <button
                  onClick={() => setIsLeftPanelOpen(true)}
                  className={`border-0 bg-transparent transition-colors ${isLightMode ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-600 hover:text-zinc-400'}`}
                  title="展开侧栏"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          } className="flex-1 relative !p-0 min-h-0" isLight={isLightMode}
            action={
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] font-medium tracking-wide hidden lg:flex cursor-default select-none font-['Noto_Serif_SC_Variable']
                ${isLightMode
                  ? 'bg-zinc-100/50 border-zinc-200/50 text-zinc-500'
                  : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500'
                }`}>
                <span className="opacity-70">⌨️</span>
                <span>ctrl/cmd 开启放大镜 · 点击图片标记 · 一键灵感收藏</span>
              </div>
            }>

            {/* Canvas Area with Scroll if needed */}
            <div className={`w-full h-full flex items-center justify-center border relative group overflow-hidden transition-colors duration-500
              ${isLightMode ? 'bg-[#eeedeb] border-zinc-300' : 'bg-[#222222] border-zinc-600'}`} ref={containerRef}
              style={{
                backgroundImage: isLightMode
                  ? 'linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px)'
                  : 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
            >
              {/* Grid Lines - REMOVED for cleaner matte look per user request */}

              {!generatedImageUrl && !genState.status.startsWith('gen') && (
                <div className="text-center select-none flex flex-col items-center justify-center">
                  {/* Minimal geometric indicator */}
                  <div className={`flex items-center justify-center mb-8 border ${isLightMode ? 'border-zinc-400' : 'border-zinc-600'}`} style={{ width: '64px', height: '64px' }}>
                    <div className={`${isLightMode ? 'bg-zinc-500' : 'bg-zinc-500'}`} style={{ width: '4px', height: '4px' }} />
                  </div>

                  {/* Main title */}
                  <p className={`text-lg tracking-[0.5em] font-light mb-10 ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`} style={{ fontFamily: "'Noto Serif SC Variable', serif" }}>
                    准备生成
                  </p>

                  {/* Network tips - cleaner typography */}
                  <div className="space-y-4 max-w-sm mx-auto">
                    <p className={`text-sm tracking-wider font-light ${isLightMode ? 'text-zinc-600' : 'text-zinc-400'}`} style={{ fontFamily: "'Noto Serif SC Variable', serif" }}>
                      网络环境可能影响加载速度
                    </p>
                    <div className={`mx-auto ${isLightMode ? 'bg-zinc-300' : 'bg-zinc-700'}`} style={{ width: '32px', height: '1px' }} />
                    <p className={`text-xs leading-relaxed tracking-wide font-light ${isLightMode ? 'text-zinc-500' : 'text-zinc-500'}`} style={{ fontFamily: "'Noto Serif SC Variable', serif" }}>
                      图片体积较大，部分网络直连较慢<br />
                      开启 VPN 或网络加速可提升成功率
                    </p>
                  </div>
                </div>
              )}

              {/* Loading indicator during generation - Yohji/Apple/Tesla style */}
              {genState.status === 'generating' && !generatedImageUrl && (
                <div className="text-center select-none flex flex-col items-center justify-center" style={{ animation: 'fadeIn 0.7s ease-out' }}>

                  {/* CSS Keyframes injected via style tag */}
                  <style>{`
                    @keyframes yohjiOrbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    @keyframes yohjiOrbitReverse { 0% { transform: rotate(0deg); } 100% { transform: rotate(-360deg); } }
                    @keyframes yohjiBreathe { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
                    @keyframes yohjiDotPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
                    @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
                  `}</style>

                  {/* Minimalist rotating orbit indicator */}
                  <div className="relative mb-10" style={{ width: '96px', height: '96px' }}>
                    {/* Outer rotating ring */}
                    <div
                      className={`absolute inset-0 border ${isLightMode ? 'border-zinc-400' : 'border-zinc-600'}`}
                      style={{ animation: 'yohjiOrbit 8s linear infinite' }}
                    />

                    {/* Inner counter-rotating element */}
                    <div
                      className="absolute"
                      style={{
                        top: '12px', right: '12px', bottom: '12px', left: '12px',
                        animation: 'yohjiOrbitReverse 12s linear infinite'
                      }}
                    >
                      <div className={`w-full h-full border ${isLightMode ? 'border-zinc-500' : 'border-zinc-500'}`} />
                    </div>

                    {/* Center breathing dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className={`${isLightMode ? 'bg-[#0d9999]' : 'bg-[#00ffff]'}`}
                        style={{
                          width: '8px',
                          height: '8px',
                          animation: 'yohjiBreathe 3s ease-in-out infinite'
                        }}
                      />
                    </div>

                    {/* Corner accents */}
                    <div className={`absolute border-t border-l ${isLightMode ? 'border-zinc-800' : 'border-white'}`} style={{ top: '-1px', left: '-1px', width: '10px', height: '10px' }} />
                    <div className={`absolute border-b border-r ${isLightMode ? 'border-zinc-800' : 'border-white'}`} style={{ bottom: '-1px', right: '-1px', width: '10px', height: '10px' }} />
                  </div>

                  {/* Status text with pulsing dots */}
                  <div className="flex items-center gap-2 mb-4">
                    <p className={`text-base tracking-[0.35em] font-light ${isLightMode ? 'text-zinc-700' : 'text-zinc-300'}`} style={{ fontFamily: "'Noto Serif SC Variable', serif" }}>
                      生成中
                    </p>
                    <span className="flex gap-1 ml-1">
                      <span
                        className={`rounded-full ${isLightMode ? 'bg-zinc-600' : 'bg-zinc-400'}`}
                        style={{ width: '4px', height: '4px', animation: 'yohjiDotPulse 1.5s ease-in-out infinite' }}
                      />
                      <span
                        className={`rounded-full ${isLightMode ? 'bg-zinc-600' : 'bg-zinc-400'}`}
                        style={{ width: '4px', height: '4px', animation: 'yohjiDotPulse 1.5s ease-in-out infinite', animationDelay: '0.3s' }}
                      />
                      <span
                        className={`rounded-full ${isLightMode ? 'bg-zinc-600' : 'bg-zinc-400'}`}
                        style={{ width: '4px', height: '4px', animation: 'yohjiDotPulse 1.5s ease-in-out infinite', animationDelay: '0.6s' }}
                      />
                    </span>
                  </div>

                  {/* Time estimate */}
                  <p className={`text-sm tracking-wider font-light mb-8 ${isLightMode ? 'text-zinc-500' : 'text-zinc-400'}`} style={{ fontFamily: "'Noto Serif SC Variable', serif" }}>
                    预计需要 1 分钟左右
                  </p>

                  {/* Subtle divider */}
                  <div className={`mb-6 ${isLightMode ? 'bg-zinc-300' : 'bg-zinc-700'}`} style={{ width: '48px', height: '1px' }} />

                  {/* Network tip - more subtle during loading */}
                  <p className={`text-xs tracking-wide font-light max-w-xs leading-relaxed ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`} style={{ fontFamily: "'Noto Serif SC Variable', serif" }}>
                    开启 VPN 或网络加速可提升成功率与速度
                  </p>
                </div>
              )}

              {generatedImageUrl && (
                <>
                  <div className={`relative w-full h-full flex items-center justify-center p-0 transition-all duration-1000 ${showNewImageAnim ? 'animate-dissolve' : ''}`}
                    onMouseMove={handleImageMouseMove} onMouseLeave={handleImageMouseLeave}>
                    <img
                      ref={imageRef}
                      crossOrigin="anonymous"
                      src={generatedImageUrl}
                      className={`max-w-full max-h-full shadow-2xl border-4 border-white object-contain cursor-crosshair`}
                      onClick={handleImageClick}
                    />
                  </div>

                  {/* Markers Layer - Positioned absolutely based on imgRect */}
                  {imgRect && markers.map((marker) => (
                    <div key={marker.id} className={`absolute group ${marker.isRemoving ? 'sticker-remove' : 'sticker-appear'}`}
                      style={{
                        left: imgRect.left + marker.x * imgRect.width,
                        top: imgRect.top + marker.y * imgRect.height,
                        '--sticker-rotation': `${marker.rotation}deg`
                      } as React.CSSProperties}>
                      {/* Dot - Like a pushpin */}
                      <div className={`w-3 h-3 -ml-1.5 -mt-1.5 bg-[#F2994A] rounded-full border-2 border-white z-10 relative pointer-events-none
                        ${marker.isRemoving ? '' : 'sticker-dot-bounce'}
                        shadow-[0_2px_4px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]`}></div>

                      {/* Floating Sticker Label - Real sticker feel with shadow and rotation */}
                      <div className={`absolute left-1/2 bottom-full mb-2 flex flex-col items-center pointer-events-auto cursor-pointer
                        ${marker.isRemoving ? 'sticker-label-remove' : 'sticker-label-appear'}`}
                        style={{ transform: `translateX(-50%) rotate(${marker.rotation}deg)` }}
                        onClick={(e) => handleMarkerRemove(marker.id, e)} // Click label to remove
                      >
                        {/* Sticker body with paper-like shadow */}
                        <div className={`relative px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap
                          transform transition-transform duration-200 group-hover:scale-110 group-hover:rotate-0
                          ${TAG_VARIANTS[marker.variantIdx].bg}
                          shadow-[2px_3px_6px_rgba(0,0,0,0.25),4px_6px_12px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.2)]
                          before:absolute before:inset-0 before:rounded-md before:bg-gradient-to-b before:from-white/20 before:to-transparent before:pointer-events-none`}>
                          {TAG_VARIANTS[marker.variantIdx].label}
                          {/* Slight fold/curl effect */}
                          <div className="absolute -right-0.5 -bottom-0.5 w-2 h-2 bg-black/10 rounded-br-md"></div>
                        </div>
                        {/* Triangle pointer */}
                        <div className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] mt-[-1px]
                          ${TAG_VARIANTS[marker.variantIdx].bg.replace('bg-', 'border-t-')}
                          drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]`}></div>
                      </div>
                    </div>
                  ))}

                  {/* One-click Preview Button - Bottom Right */}
                  {generatedImageUrl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(generatedImageUrl); }}
                      className={`absolute bottom-6 right-6 p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all duration-300 z-20 group hover:scale-110 active:scale-95
                        ${isLightMode
                          ? 'bg-white/60 hover:bg-white/90 text-zinc-600 hover:text-zinc-900 border border-white/20'
                          : 'bg-black/40 hover:bg-black/70 text-zinc-400 hover:text-white border border-white/10'}`}
                      title="全屏预览"
                    >
                      <ArrowsPointingOutIcon className="w-5 h-5" />
                    </button>
                  )}

                  {/* UX Guidance: Click Hint - Shows briefly after image generation */}
                  {showClickHint && markers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      {/* Ripple pulse - subtle click indicator */}
                      <div
                        className="click-hint-ripple absolute"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          border: isLightMode ? '2px solid rgba(13, 153, 153, 0.6)' : '2px solid rgba(0, 255, 255, 0.5)',
                          left: '50%',
                          top: '50%',
                        }}
                      />
                      {/* Second ripple with delay for layered effect */}
                      <div
                        className="click-hint-ripple absolute"
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          border: isLightMode ? '2px solid rgba(13, 153, 153, 0.4)' : '2px solid rgba(0, 255, 255, 0.35)',
                          left: '50%',
                          top: '50%',
                          animationDelay: '0.6s',
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Magnifier */}
              {/* Magnifier - Rendered via Portal for global unclipped view */}
              {generatedImageUrl && magnifier.show && isCtrlPressed && createPortal(
                <div
                  className="fixed w-72 h-72 border-2 border-[#F2994A] rounded-full overflow-hidden pointer-events-none z-[9999] shadow-2xl bg-black"
                  style={{
                    left: magnifier.screenX,
                    top: magnifier.screenY,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="w-full h-full"
                    style={{
                      backgroundImage: `url(${generatedImageUrl})`,
                      backgroundPosition: `${magnifier.relX}% ${magnifier.relY}%`,
                      backgroundSize: `${magnifier.imgWidth * 2.5}px ${magnifier.imgHeight * 2.5}px`
                    }}
                  />
                  {/* Crosshair */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-50">
                    <div className="w-full h-px bg-[#F2994A]"></div>
                    <div className="h-full w-px bg-[#F2994A] absolute"></div>
                  </div>
                </div>,
                document.body
              )}

              {/* First-time Guide Tooltip */}
              {showFirstTimeGuide && generatedImageUrl && (
                <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
                  <div className="relative pointer-events-auto animate-in fade-in zoom-in-95 duration-500">
                    {/* Backdrop blur circle */}
                    <div className={`absolute -inset-4 backdrop-blur-sm rounded-sm ${isLightMode ? 'bg-white/60' : 'bg-black/40'}`} />

                    {/* Guide content */}
                    <div className={`relative border p-5 max-w-xs shadow-2xl ${isLightMode ? 'bg-white/95 border-zinc-300' : 'bg-zinc-900/95 border-zinc-600'}`}>
                      {/* Left accent */}
                      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${isLightMode ? 'bg-[#0d9999]' : 'bg-[#00ffff]'}`} />

                      {/* Close button */}
                      <button
                        onClick={dismissFirstTimeGuide}
                        className={`absolute top-2 right-2 transition-colors ${isLightMode ? 'text-zinc-800 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'}`}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>

                      {/* Content */}
                      <div className="pl-3">
                        <p className={`text-xs font-['Noto_Serif_SC_Variable'] tracking-wide leading-relaxed mb-3 ${isLightMode ? 'text-zinc-800' : 'text-zinc-300'}`}>
                          点击图片标记你喜欢的区域
                        </p>
                        <p className={`text-xs font-['Noto_Serif_SC_Variable'] tracking-wide leading-relaxed mb-4 ${isLightMode ? 'text-zinc-800' : 'text-zinc-300'}`}>
                          再点击「灵感收藏」收藏到灵感栏
                        </p>
                        <button
                          onClick={dismissFirstTimeGuide}
                          className={`text-[10px] transition-colors font-['Noto_Serif_SC_Variable'] tracking-widest ${isLightMode ? 'text-zinc-800 hover:text-[#0d9999]' : 'text-zinc-500 hover:text-[#00ffff]'}`}
                        >
                          知道了
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SciFiPanel>

          {/* ACTION BUTTONS - Yohji Yamamoto Aesthetic */}
          <div className="h-12 flex-shrink-0 flex items-stretch gap-4">

            {/* GENERATE BUTTON - Yohji Yamamoto Minimal Style */}
            <div className="flex-1 relative" onMouseEnter={() => setShowGenerateTooltip(true)} onMouseLeave={() => setShowGenerateTooltip(false)}>
              {/* Mobile Guide Step 4: Click Generate */}
              <MobileGuideTooltip
                show={isMobile && mobileGuideStep === 4}
                position="top"
                onDismiss={() => advanceMobileGuide(5)}
              >
                ↓ 点击生成按钮
              </MobileGuideTooltip>
              <button
                onClick={handleGenerate}
                disabled={!previewUrl || genState.status === 'generating'}
                onMouseEnter={() => { if (!previewUrl) setShowGenerateTooltip(true); }}
                onMouseLeave={() => setShowGenerateTooltip(false)}
                className={`w-full h-full relative overflow-hidden group transition-all duration-300
                  ${!previewUrl
                    ? 'cursor-not-allowed opacity-40'
                    : 'cursor-pointer hover:shadow-lg active:scale-[0.98]'}`}
              >
                {/* Background & Surface - Glossy Black/White */}
                <div className={`absolute inset-0 transition-all duration-300
                  ${isLightMode
                    ? 'bg-gradient-to-br from-zinc-800 to-black'
                    : 'bg-gradient-to-br from-zinc-100 to-zinc-300'}`}
                />

                {/* Glass Shine Overlay - Top Half */}
                <div className={`absolute inset-x-0 top-0 h-1/2 opacity-10 bg-gradient-to-b from-white to-transparent`} />

                {/* Sweep Shine Animation */}
                {previewUrl && genState.status !== 'generating' && (
                  <div className={`absolute inset-0 -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shine-sweep_0.75s_ease-in-out_forwards]
                    ${isLightMode ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent' : 'bg-gradient-to-r from-transparent via-white/40 to-transparent'}`} />
                )}

                {/* Generating: Progress Line */}
                {genState.status === 'generating' && (
                  <div className={`absolute bottom-0 left-0 h-[3px] w-full z-20 overflow-hidden bg-black/20`}>
                    <div className={`h-full w-full origin-left animate-[yohjiProgress_2s_ease-in-out_infinite] ${isLightMode ? 'bg-white' : 'bg-black'}`} />
                  </div>
                )}

                {/* Content */}
                <div className="relative z-10 h-full flex items-center justify-center gap-3 px-6">
                  {genState.status === 'generating' ? (
                    <span className={`text-xs tracking-[0.25em] font-['Noto_Serif_SC_Variable'] animate-pulse font-bold
                         ${isLightMode ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      GENERATING...
                    </span>
                  ) : (
                    <span className={`text-sm font-bold tracking-[0.2em] font-['Noto_Serif_SC_Variable'] transition-all duration-300
                      ${isLightMode ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-900 group-hover:text-black'}`}>
                      {generatedImageUrl ? '重新生成' : '立即生成'}
                    </span>
                  )}
                </div>
              </button>

              {/* Tooltip - 上传提示 */}
              {showGenerateTooltip && !previewUrl && (
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 text-[10px] tracking-wide border z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap font-['Noto_Serif_SC_Variable']
                  ${isLightMode ? 'bg-white text-zinc-500 border-zinc-300' : 'bg-zinc-900 text-zinc-400 border-zinc-700'}`}>
                  请先上传参考图
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${isLightMode ? 'border-t-zinc-300' : 'border-t-zinc-700'}`}></div>
                </div>
              )}

              {/* 积分不足提示 */}
              {pointsError && (
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2 text-[11px] tracking-wide border z-50 animate-in fade-in slide-in-from-bottom-2 font-['Noto_Serif_SC_Variable'] max-w-xs text-center
                  ${isLightMode ? 'bg-red-50 text-red-600 border-red-200' : 'bg-red-900/30 text-red-400 border-red-800/50'}`}>
                  {pointsError}
                  <button
                    onClick={() => setPointsError(null)}
                    className={`ml-2 text-xs ${isLightMode ? 'text-red-400 hover:text-red-600' : 'text-red-500 hover:text-red-300'}`}
                  >
                    ✕
                  </button>
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${isLightMode ? 'border-t-red-200' : 'border-t-red-800/50'}`}></div>
                </div>
              )}
            </div>

            {/* COLLECT BUTTON */}
            <div className="flex-1 relative" onMouseEnter={() => setShowCollectTooltip(true)} onMouseLeave={() => setShowCollectTooltip(false)}>
              {/* Mobile Guide Step 5: Collect marked images */}
              <MobileGuideTooltip
                show={isMobile && mobileGuideStep === 5 && markers.length > 0}
                position="top"
                onDismiss={() => advanceMobileGuide(6)}
              >
                ❤️ 点击灵感收藏标记的图片
              </MobileGuideTooltip>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCollect();
                  if (mobileGuideStep === 5) advanceMobileGuide(6);
                }}
                disabled={markers.length === 0}
                className={`w-full h-full relative overflow-hidden group transition-all duration-300
                  ${markers.length === 0 ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:shadow-lg active:scale-[0.98]'}`}
              >
                {/* Background & Surface - Glossy Black/White */}
                <div className={`absolute inset-0 transition-all duration-300
                  ${isLightMode
                    ? 'bg-gradient-to-br from-zinc-800 to-black'
                    : 'bg-gradient-to-br from-zinc-100 to-zinc-300'}`}
                />

                {/* Glass Shine Overlay - Top Half */}
                <div className={`absolute inset-x-0 top-0 h-1/2 opacity-10 bg-gradient-to-b from-white to-transparent`} />

                {/* Sweep Shine Animation */}
                {markers.length > 0 && (
                  <div className={`absolute inset-0 -translate-x-[150%] skew-x-[-20deg] group-hover:animate-[shine-sweep_0.75s_ease-in-out_forwards]
                    ${isLightMode ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent' : 'bg-gradient-to-r from-transparent via-white/40 to-transparent'}`} />
                )}

                {/* Content */}
                <div className={`relative z-10 h-full flex items-center justify-center gap-2 px-4`}>
                  <span className={`text-sm font-bold tracking-[0.2em] font-['Noto_Serif_SC_Variable'] transition-all 
                     ${isLightMode ? 'text-zinc-100 group-hover:text-white' : 'text-zinc-900 group-hover:text-black'}`}>
                    灵感收藏
                  </span>
                  <span className={`text-[10px] font-mono transition-all opacity-80
                     ${isLightMode ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    [{markers.length}]
                  </span>
                </div>
              </button>

              {/* Tooltip */}
              {showCollectTooltip && markers.length === 0 && (
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 text-[10px] tracking-wide border z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap font-['Noto_Serif_SC_Variable']
                  ${isLightMode ? 'bg-white text-zinc-500 border-zinc-300' : 'bg-zinc-900 text-zinc-400 border-zinc-700'}`}>
                  先标记喜爱的图片
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 ${isLightMode ? 'border-t-zinc-300' : 'border-t-zinc-700'}`}></div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT: DATA LOG */}
        <div className={`w-full flex flex-col h-full overflow-hidden min-w-0 animate-fade-in-up delay-300
          ${isMobile ? (mobileTab === 'collection' ? 'flex-1' : 'hidden') : ''}`}>
          {/* DATA STREAM (History/Collection) */}
          <SciFiPanel
            title="灵感收藏 COLLECTION"
            className="flex-1 min-h-0 relative"
            isLight={isLightMode}
            overlay={collection.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className={`text-center text-[11px] font-['Noto_Serif_SC_Variable'] tracking-wide ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>
                  暂无收藏数据
                </div>
              </div>
            ) : null}
            action={
              <div className="relative flex items-center gap-2">
                <button onClick={() => setSelectedCollectionIds(new Set())} className={`text-[10px] border-0 bg-transparent transition-colors ${isLightMode ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300'}`}>清空选择</button>
                {/* Mobile Guide: Collection usage hint */}
                <MobileGuideTooltip
                  show={isMobile && mobileTab === 'collection' && collection.length > 0 && mobileGuideStep === 0 && !hasSeenMobileGuide}
                  position="left"
                  onDismiss={() => { }}
                >
                  点击图片选中，可批量下载
                </MobileGuideTooltip>
              </div>
            }
          >
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar px-2 pt-0 pb-16">
              {collection.length === 0 ? null : (
                <div className="grid grid-cols-2 gap-1.5">
                  {collection.map(item => (
                    <div key={item.id} className={`aspect-square relative group cursor-pointer border-2 transition-all rounded-sm overflow-hidden ${selectedCollectionIds.has(item.id) ? 'border-[#00ffff] ring-2 ring-[#00ffff]/20' : 'border-transparent'}`}
                      onClick={() => toggleSelection(item.id)} draggable onDragStart={(e) => handleDragStart(e, collection.indexOf(item), item)} onDragEnter={(e) => handleDragEnter(e, collection.indexOf(item))} onDragEnd={handleDragEnd}>
                      {/* Logic: Grayscale if not selected and not hovered. Color if selected. */}
                      <img src={item.url} className={`w-full h-full object-cover img-grayscale ${selectedCollectionIds.has(item.id) ? 'active' : ''}`} />
                      {selectedCollectionIds.has(item.id) && <div className="absolute top-1 left-1 w-5 h-5 bg-[#00ffff] text-black flex items-center justify-center text-[10px] font-bold rounded-full shadow-md"><CheckIcon className="w-3 h-3" /></div>}

                      {/* Action Buttons */}
                      <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={(e) => handleDeleteFromCollection(e, item.id)} className="bg-red-500 text-white p-1 rounded-full hover:bg-red-600 shadow-sm"><XMarkIcon className="w-3 h-3" /></button>
                      </div>

                      {/* Preview Button (Bottom Right) */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(item.url); }}
                        className="absolute bottom-1 right-1 bg-black/50 hover:bg-[#F2994A] backdrop-blur-sm text-white p-1.5 rounded-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                      >
                        <ArrowsPointingOutIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Floating Action Window for Selection - Yohji Redesign */}
            {selectedCollectionIds.size > 0 && (
              <div className={`absolute bottom-4 left-4 right-4 p-3 shadow-2xl flex flex-col gap-3 z-20 animate-in slide-in-from-bottom-4 border
                ${isLightMode ? 'bg-white/95 backdrop-blur-sm border-zinc-300' : 'bg-zinc-950/95 backdrop-blur-sm border-zinc-800'}`}>
                {/* Top accent line */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${isLightMode ? 'bg-zinc-800' : 'bg-white'}`} />

                <div className="flex justify-between items-center px-1">
                  <span className={`text-[11px] font-['Noto_Serif_SC_Variable'] tracking-[0.15em] ${isLightMode ? 'text-zinc-800' : 'text-zinc-400'}`}>
                    {selectedCollectionIds.size} 项已选
                  </span>
                </div>
                <div className="flex gap-2">
                  {/* Upscale Button - Primary */}
                  <button
                    onClick={handleUpscaleSelected}
                    className={`flex-1 h-10 relative overflow-hidden group transition-all duration-300 border
                      ${isLightMode
                        ? 'bg-zinc-900 border-zinc-900 text-white hover:bg-white hover:text-zinc-900'
                        : 'bg-white border-white text-black hover:bg-black hover:text-white'}`}
                  >
                    {/* Left accent */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors duration-300
                      ${isLightMode
                        ? 'bg-zinc-600 group-hover:bg-[#0d9999]'
                        : 'bg-zinc-400 group-hover:bg-[#00ffff]'}`} />
                    <div className="flex items-center justify-center gap-2">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-['Noto_Serif_SC_Variable'] tracking-wider">放大修复</span>
                    </div>
                  </button>

                  {/* Download Button - Secondary */}
                  <button
                    onClick={handleDownloadZip}
                    className={`flex-1 h-10 relative overflow-hidden group transition-all duration-300 border
                      ${isLightMode
                        ? 'bg-transparent border-zinc-300 text-zinc-500 hover:border-[#0d9999] hover:text-[#0d9999]'
                        : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-[#00ffff] hover:text-[#00ffff]'}`}
                  >
                    {/* Right accent */}
                    <div className={`absolute right-0 top-0 bottom-0 w-[3px] transition-colors duration-300
                      ${isLightMode
                        ? 'bg-zinc-300 group-hover:bg-[#0d9999]'
                        : 'bg-zinc-700 group-hover:bg-[#00ffff]'}`} />
                    <div className="flex items-center justify-center gap-2">
                      <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-['Noto_Serif_SC_Variable'] tracking-wider">打包下载</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </SciFiPanel>
        </div >

      </div >

      {/* Footer Info - Hidden on Mobile */}
      {
        !isMobile && (
          <div className={`py-4 text-center text-[10px] font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>
            Created by Wuwei ｜感谢使用产品，欢迎反馈意见！联系或加入学习群可+私人微信：13349516070 或 邮件：wuwei5986@gmail.com
          </div>
        )
      }

      {/* Mobile Bottom Navigation - Yohji Minimalist */}
      {
        isMobile && (
          <nav className={`fixed bottom-0 left-0 right-0 h-20 backdrop-blur-xl z-50 flex items-center safe-area-inset-bottom pb-2
          ${isLightMode ? 'bg-white/95' : 'bg-black/95'}`}>
            {/* Config Tab */}
            <div className="h-full relative" style={{ flex: 1 }}>
              <MobileTabButton
                icon={<Cog6ToothIcon className="w-full h-full" />}
                label="配置"
                active={mobileTab === 'config'}
                onClick={() => setMobileTab('config')}
                isLight={isLightMode}
              />
            </div>
            {/* Generate Tab with Guide Tooltip */}
            <div className="h-full relative" style={{ flex: 1 }}>
              <MobileTabButton
                icon={<SparklesIcon className="w-full h-full" />}
                label="生成"
                active={mobileTab === 'viewport'}
                onClick={() => {
                  setMobileTab('viewport');
                  if (mobileGuideStep === 3) advanceMobileGuide(4);
                }}
                isLight={isLightMode}
              />
              {/* Mobile Guide Step 3: Go to Generate */}
              <MobileGuideTooltip
                show={mobileGuideStep === 3}
                position="top"
                onDismiss={() => {
                  setMobileTab('viewport');
                  advanceMobileGuide(4);
                }}
              >
                🚀 点击进入生成页
              </MobileGuideTooltip>
            </div>
            {/* Collection Tab with Guide Tooltip */}
            <div className="h-full relative" style={{ flex: 1 }}>
              <MobileTabButton
                icon={<ArchiveBoxArrowDownIcon className="w-full h-full" />}
                label="收藏"
                active={mobileTab === 'collection'}
                onClick={() => {
                  setMobileTab('collection');
                  if (mobileGuideStep === 6) completeMobileGuide();
                }}
                badge={collection.length}
                isLight={isLightMode}
              />
              {/* Mobile Guide Step 6: View Collection */}
              <MobileGuideTooltip
                show={mobileGuideStep === 6}
                position="top"
                onDismiss={completeMobileGuide}
              >
                📦 查看已收藏的灵感
              </MobileGuideTooltip>
            </div>
          </nav>
        )
      }

      {/* History Sidebar - Popover Style */}
      {
        isHistoryOpen && (
          <div className={`fixed right-16 top-20 bottom-20 w-72 backdrop-blur-lg border rounded-sm shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-10 fade-in duration-200
          ${isLightMode ? 'bg-white/95 border-zinc-300' : 'bg-zinc-900/95 border-zinc-700'}`}
            style={{ top: Math.max(16, historyBtnPos.y - 200), maxHeight: '600px' }}>
            <div className={`p-3 border-b flex justify-between items-center ${isLightMode ? 'border-zinc-200' : 'border-zinc-700'}`}>
              <h3 className={`font-bold uppercase tracking-widest text-xs flex items-center gap-2 font-['Noto_Serif_SC_Variable'] ${isLightMode ? 'text-zinc-800' : 'text-zinc-300'}`}>
                <ClockIcon className="w-4 h-4 text-[#F2994A]" /> 历史回溯
              </h3>
              <button onClick={() => setIsHistoryOpen(false)} className={`transition-colors ${isLightMode ? 'text-zinc-800 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'}`}><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {history.map(item => (
                <div key={item.id} onClick={() => handleRestoreHistory(item)} className={`p-2 border rounded-sm cursor-pointer group transition-all flex gap-3
                ${isLightMode ? 'border-zinc-200 bg-zinc-50 hover:bg-white hover:border-[#F2994A]' : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800 hover:border-[#F2994A]'}`}>
                  <img src={item.url} className={`w-14 h-14 object-cover rounded-sm grayscale group-hover:grayscale-0 transition-all border ${isLightMode ? 'border-zinc-200' : 'border-zinc-700'}`} />
                  <div className="flex-1 overflow-hidden flex flex-col justify-center">
                    <p className={`text-[10px] font-mono mb-1 ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>{item.timestamp.toLocaleTimeString()}</p>
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 3).map(t => <span key={t} className={`text-[9px] border px-1.5 py-0.5 rounded-sm ${isLightMode ? 'bg-white border-zinc-200 text-zinc-500' : 'bg-zinc-800 border-zinc-600 text-zinc-400'}`}>{t}</span>)}
                    </div>
                  </div>
                </div>
              ))}
              {history.length === 0 && <p className={`text-center text-xs font-['Noto_Serif_SC_Variable'] mt-10 ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>暂无历史记录</p>}
            </div>
          </div>
        )
      }

      {/* Draggable History Toggle Tab - Desktop Only */}
      {
        !isMobile && (
          <div
            className="fixed right-0 z-50 cursor-move transition-transform active:scale-95"
            style={{ top: historyBtnPos.y, transform: 'translateY(-50%)' }}
            onMouseDown={handleHistoryMouseDown}
          >
            <button onClick={handleHistoryClick}
              className={`p-2.5 rounded-l-md hover:pl-4 transition-all flex items-center gap-2 group border-l border-y
              ${isLightMode ? 'bg-white/80 border-zinc-200 text-zinc-500 hover:bg-[#F2994A] hover:text-white hover:border-[#F2994A]' : 'bg-zinc-900/80 border-zinc-700/50 text-zinc-500 hover:bg-[#F2994A] hover:text-white hover:border-[#F2994A]'}`}>
              <ClockIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-[9px] font-normal vertical-rl hidden group-hover:block animate-in fade-in slide-in-from-right-2">历史</span>
            </button>
          </div>
        )
      }

      {/* Styles & Animation Keyframes */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background-color: transparent; }
        
        .vertical-rl { writing-mode: vertical-rl; text-orientation: upright; }
        
        @keyframes dissolve {
            0% { clip-path: inset(0 100% 0 0); filter: grayscale(1) blur(10px); opacity: 0; }
            30% { clip-path: inset(0 50% 0 0); filter: grayscale(1) blur(5px); opacity: 0.5; }
            100% { clip-path: inset(0 0 0 0); filter: grayscale(0) blur(0); opacity: 1; }
        }

        @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        
        @keyframes softPulse {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
        }
        
        .animate-dissolve {
            animation: dissolve 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }

        @keyframes flyToArchive {
            0% { 
                transform: translate(0, 0) scale(0);
                opacity: 0.5;
                border-radius: 100%;
            }
            15% {
                transform: translate(0, 0) scale(1.2);
                opacity: 1;
                border-radius: 12px;
            }
            100% { 
                transform: translate(var(--tx), var(--ty)) scale(0.1); 
                opacity: 0;
                border-radius: 50%;
            }
        }

        /* ============================================
           Sticker Animations - Bouncy & Playful
           ============================================ */
        
        /* Sticker appear with spring bounce */
        @keyframes stickerAppear {
            0% { 
                transform: scale(0) rotate(calc(var(--sticker-rotation) - 20deg));
                opacity: 0;
            }
            50% { 
                transform: scale(1.3) rotate(calc(var(--sticker-rotation) + 5deg));
                opacity: 1;
            }
            70% { 
                transform: scale(0.9) rotate(calc(var(--sticker-rotation) - 3deg));
            }
            85% { 
                transform: scale(1.05) rotate(calc(var(--sticker-rotation) + 1deg));
            }
            100% { 
                transform: scale(1) rotate(var(--sticker-rotation));
            }
        }
        
        .sticker-appear {
            animation: stickerAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        /* Sticker label drop animation */
        @keyframes stickerLabelAppear {
            0% { 
                transform: translateX(-50%) rotate(var(--sticker-rotation)) translateY(-20px) scale(0);
                opacity: 0;
            }
            40% {
                transform: translateX(-50%) rotate(calc(var(--sticker-rotation) + 8deg)) translateY(5px) scale(1.1);
                opacity: 1;
            }
            60% {
                transform: translateX(-50%) rotate(calc(var(--sticker-rotation) - 4deg)) translateY(-3px) scale(0.95);
            }
            80% {
                transform: translateX(-50%) rotate(calc(var(--sticker-rotation) + 2deg)) translateY(1px) scale(1.02);
            }
            100% { 
                transform: translateX(-50%) rotate(var(--sticker-rotation)) translateY(0) scale(1);
            }
        }
        
        .sticker-label-appear {
            animation: stickerLabelAppear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        /* Dot bounce animation */
        @keyframes stickerDotBounce {
            0% { transform: scale(0) translateY(-10px); }
            50% { transform: scale(1.4) translateY(2px); }
            70% { transform: scale(0.8) translateY(-1px); }
            100% { transform: scale(1) translateY(0); }
        }
        
        .sticker-dot-bounce {
            animation: stickerDotBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        /* Sticker remove animation - peel off effect */
        @keyframes stickerRemove {
            0% { 
                transform: scale(1) rotate(var(--sticker-rotation));
                opacity: 1;
            }
            30% {
                transform: scale(1.1) rotate(calc(var(--sticker-rotation) + 10deg)) translateY(-5px);
                opacity: 1;
            }
            100% { 
                transform: scale(0) rotate(calc(var(--sticker-rotation) + 45deg)) translateY(-30px);
                opacity: 0;
            }
        }
        
        .sticker-remove {
            animation: stickerRemove 0.3s cubic-bezier(0.55, 0, 1, 0.45) forwards;
            pointer-events: none;
        }
        
        @keyframes stickerLabelRemove {
            0% { 
                transform: translateX(-50%) rotate(var(--sticker-rotation)) scale(1);
                opacity: 1;
            }
            100% { 
                transform: translateX(-50%) rotate(calc(var(--sticker-rotation) + 30deg)) scale(0) translateY(-20px);
                opacity: 0;
            }
        }
        
        .sticker-label-remove {
            animation: stickerLabelRemove 0.25s cubic-bezier(0.55, 0, 1, 0.45) forwards;
        }

        /* ============================================
           Yohji Yamamoto Generate Button - Minimal
           ============================================ */
        
        /* Simple progress line animation */
        @keyframes yohjiProgress {
            0% { width: 0%; }
            50% { width: 100%; }
            100% { width: 0%; left: 100%; }
        }
        
        .yohji-progress {
            animation: yohjiProgress 2s ease-in-out infinite;
        }
        
        /* Rotating squares for toast loading */
        @keyframes yohjiRotateSlow {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        /* GrayScale Logic */
        .img-grayscale {
            filter: grayscale(100%);
            transition: filter 0.3s ease;
        }
        .group:hover .img-grayscale {
            filter: grayscale(0%);
        }
        .img-grayscale.active {
            filter: grayscale(0%);
        }
        
        @keyframes yohjiRotateReverse {
            from { transform: rotate(360deg); }
            to { transform: rotate(0deg); }
        }
        
        .yohji-rotate-slow { animation: yohjiRotateSlow 3s linear infinite; }
        .yohji-rotate-reverse { animation: yohjiRotateReverse 2s linear infinite; }
        
        /* Accent bar pulse for toast */
        @keyframes yohjiAccentPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }
        
        .yohji-accent-pulse { animation: yohjiAccentPulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* Flying Items Layer */}
      {
        flyingItems.map((item) => (
          <div key={item.id}
            className="fixed z-[9999] pointer-events-none shadow-2xl border-2 border-white/80 bg-black/20 backdrop-blur-sm origin-center"
            style={{
              left: item.startX,
              top: item.startY,
              width: '80px',
              height: '80px',
              marginLeft: '-40px',
              marginTop: '-40px',
              backgroundImage: `url(${item.src})`,
              backgroundSize: 'cover',
              '--tx': `${item.deltaX}px`,
              '--ty': `${item.deltaY}px`,
              animation: 'flyToArchive 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            } as React.CSSProperties}
          />
        ))
      }

      {/* Toast Notification - Yohji Style */}
      {
        upscaleStatus.visible && (
          <div className={`fixed bottom-6 right-6 p-4 shadow-2xl z-50 flex items-center gap-4 animate-in slide-in-from-right-10 border
          ${isLightMode ? 'bg-white/95 backdrop-blur-sm border-zinc-300' : 'bg-zinc-950/95 backdrop-blur-sm border-zinc-700'}`}>
            {/* Left accent */}
            <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${upscaleStatus.state === 'processing'
              ? (isLightMode ? 'bg-zinc-800 yohji-accent-pulse' : 'bg-white yohji-accent-pulse')
              : (isLightMode ? 'bg-[#0d9999]' : 'bg-[#00ffff]')}`} />

            {upscaleStatus.state === 'processing' ? (
              /* Apple/Tesla style: Clean single-line circular spinner */
              <div className="relative w-5 h-5">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className={`opacity-20 ${isLightMode ? 'stroke-zinc-400' : 'stroke-zinc-600'}`}
                    cx="12" cy="12" r="10"
                    fill="none"
                    strokeWidth="2"
                  />
                  <circle
                    className={`${isLightMode ? 'stroke-zinc-800' : 'stroke-white'}`}
                    cx="12" cy="12" r="10"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="32 32"
                  />
                </svg>
              </div>
            ) : (
              <div className={`w-5 h-5 flex items-center justify-center ${isLightMode ? 'text-[#0d9999]' : 'text-[#00ffff]'}`}>
                <CheckIcon className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className={`text-[11px] font-['Noto_Serif_SC_Variable'] tracking-wider ${isLightMode ? 'text-zinc-800' : 'text-zinc-200'}`}>
                {upscaleStatus.state === 'processing' ? '高清修复中' : '已完成'}
              </p>
              <p className={`text-[10px] font-mono tracking-wider ${isLightMode ? 'text-zinc-800' : 'text-zinc-500'}`}>
                {upscaleStatus.completedCount}/{upscaleStatus.totalCount}
              </p>
            </div>
          </div>
        )
      }

      {/* VPN Error Alert Modal */}
      {
        showVpnAlert && (
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-4"
            onClick={() => setShowVpnAlert(false)}
          >
            <div
              className={`relative max-w-sm w-full p-6 rounded-lg shadow-2xl animate-in zoom-in-95 duration-300 ${isLightMode ? 'bg-white' : 'bg-zinc-900 border border-zinc-700'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning Icon */}
              <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${isLightMode ? 'bg-orange-100' : 'bg-orange-500/20'}`}>
                <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className={`text-center text-lg font-bold font-['Noto_Serif_SC_Variable'] mb-3 ${isLightMode ? 'text-zinc-800' : 'text-white'}`}>
                服务暂时繁忙
              </h3>

              <p className={`text-center text-sm font-['Noto_Serif_SC_Variable'] mb-4 leading-relaxed ${isLightMode ? 'text-zinc-800' : 'text-zinc-400'}`}>
                这是 Google 侧的临时限制，通常稍后重试即可恢复。<br />
                但如果频繁出现，建议切换区域。
              </p>

              <div className="text-center mb-6">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${isLightMode ? 'bg-green-100 text-green-700' : 'bg-[#00ffff]/20 text-[#00ffff]'}`}>
                  本次失败不扣除积分
                </span>
              </div>

              <button
                onClick={() => setShowVpnAlert(false)}
                className={`w-full py-3 rounded-lg font-['Noto_Serif_SC_Variable'] text-sm font-medium transition-all ${isLightMode ? 'bg-zinc-800 text-white hover:bg-zinc-900' : 'bg-[#00ffff] text-black hover:bg-[#00ffff]/90'}`}
              >
                知道了
              </button>
            </div>
          </div>
        )
      }

      {/* Modal Preview (New Interaction) */}
      {
        previewImage && (
          <div
            ref={previewModalRef}
            className={`fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-200 
              ${isPreviewZoomed ? 'overflow-auto block' : 'overflow-hidden'}`}
            onClick={(e) => {
              if (e.target === e.currentTarget || e.target === previewModalRef.current) setPreviewImage(null);
            }}
          >
            <div
              className={`relative transition-all duration-200 ease-out 
                ${isPreviewZoomed ? 'w-full min-h-full flex items-center justify-center p-0' : 'max-w-[98vw] max-h-[98vh] flex flex-col items-center animate-in zoom-in-95'}`}
              onClick={(e) => {
                // Let clicks propagate to container unless on specific interactive elements
              }}
            >
              <div className={`relative shadow-2xl rounded-sm bg-black transition-all duration-300 ${isPreviewZoomed ? 'shadow-none rounded-none overflow-visible bg-transparent' : 'overflow-hidden'}`}>
                <img
                  src={previewImage}
                  // Removed transition-all to ensure instant layout update for accurate scroll calculation
                  className={`block
                    ${isPreviewZoomed
                      ? 'max-w-none cursor-zoom-out'
                      : 'max-w-[95vw] max-h-[95vh] object-contain cursor-zoom-in'}`}
                  alt="Full Preview"
                  onClick={(e) => {
                    e.stopPropagation();

                    if (isPreviewZoomed) {
                      setIsPreviewZoomed(false);
                    } else {
                      // 1. Capture click relative position (0-1)
                      const rect = e.currentTarget.getBoundingClientRect();
                      const xPercent = (e.clientX - rect.left) / rect.width;
                      const yPercent = (e.clientY - rect.top) / rect.height;

                      // 2. Switch state (Render happens)
                      setIsPreviewZoomed(true);

                      // 3. Scroll to mapped position after layout update
                      setTimeout(() => {
                        if (previewModalRef.current) {
                          const container = previewModalRef.current;
                          const img = container.querySelector('img');

                          if (img) {
                            const scrollWidth = img.offsetWidth;
                            const scrollHeight = img.offsetHeight;
                            const clientWidth = container.clientWidth;
                            const clientHeight = container.clientHeight;

                            // Center the point: PointInImage - ViewportHalf
                            // ScrollLeft is bounded by browser automatically
                            container.scrollTo({
                              left: scrollWidth * xPercent - clientWidth / 2,
                              top: scrollHeight * yPercent - clientHeight / 2,
                              behavior: 'instant' // Ensure no smooth scroll interference
                            });
                          }
                        }
                      }, 0); // Execute immediately after render cycle
                    }
                  }}
                />
              </div>

              {/* Close Button - Fixed Position now */}
              <button
                onClick={() => setPreviewImage(null)}
                className="fixed top-6 right-6 z-[1010] bg-white/10 hover:bg-white/20 text-white p-2 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-lg"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>

              <div className={`mt-4 px-4 py-1.5 bg-black/50 backdrop-blur-md rounded-full text-white/80 text-xs font-mono border border-white/10 transition-opacity duration-300 ${isPreviewZoomed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                Esc 关闭 / 点击局部放大
              </div>
            </div>
          </div>
        )
      }

    </div >

  );
}
