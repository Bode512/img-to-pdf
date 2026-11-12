import { useState, useCallback, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  Upload, 
  FileText, 
  Download, 
  Image as ImageIcon, 
  ArrowRight,
  Maximize2,
  Minimize2,
  Layout,
  Archive,
  Zap,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageItem, PageOrientation } from './types';
import { SortableImageItem } from './components/SortableImageItem';
import { cn } from './lib/utils';

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [compression, setCompression] = useState(0.8);
  const [filename, setFilename] = useState('converted_images');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const compressImage = useCallback(async (url: string, quality: number, type: string = 'image/jpeg'): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(url);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(type, quality));
      };
      img.src = url;
    });
  }, []);

  const processFile = useCallback(async (file: File): Promise<ImageItem | null> => {
    if (!file.type.startsWith('image/')) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          resolve({
            id: crypto.randomUUID(),
            url,
            name: file.name,
            type: file.type,
            width: img.width,
            height: img.height,
          });
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const newItems: ImageItem[] = [];
    for (const file of Array.from(files)) {
      const item = await processFile(file);
      if (item) newItems.push(item);
    }
    setImages((prev) => [...prev, ...newItems]);
  }, [processFile]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) handleFiles(files);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const generatePDF = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);

    try {
      const firstImg = images[0];
      const initialOrientation = orientation === 'original' 
        ? (firstImg.width > firstImg.height ? 'l' : 'p') 
        : orientation === 'portrait' ? 'p' : 'l';

      const pdf = new jsPDF({
        orientation: initialOrientation,
        unit: 'pt',
        format: orientation === 'original' ? [firstImg.width, firstImg.height] : 'a4',
        compress: true
      });

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        // Compress image data if quality < 1
        const activeUrl = compression < 1 
          ? await compressImage(img.url, compression, 'image/jpeg') 
          : img.url;

        if (i > 0) {
          const pageOrientation = orientation === 'original' 
            ? (img.width > img.height ? 'l' : 'p') 
            : orientation === 'portrait' ? 'p' : 'l';
          
          pdf.addPage(
            orientation === 'original' ? [img.width, img.height] : 'a4',
            pageOrientation
          );
        }

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        if (orientation === 'original') {
          pdf.addImage(activeUrl, 'JPEG', 0, 0, pageWidth, pageHeight);
        } else {
          const margin = 20;
          const maxWidth = pageWidth - margin * 2;
          const maxHeight = pageHeight - margin * 2;
          
          let displayWidth = img.width;
          let displayHeight = img.height;
          
          const ratio = Math.min(maxWidth / displayWidth, maxHeight / displayHeight);
          displayWidth *= ratio;
          displayHeight *= ratio;

          const x = (pageWidth - displayWidth) / 2;
          const y = (pageHeight - displayHeight) / 2;

          pdf.addImage(activeUrl, 'JPEG', x, y, displayWidth, displayHeight);
        }
      }

      pdf.save(`${filename || 'converted_images'}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadZip = async () => {
    if (images.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const activeUrl = compression < 1 
          ? await compressImage(img.url, compression, 'image/jpeg') 
          : img.url;
        
        const base64Data = activeUrl.split(',')[1];
        zip.file(`${i + 1}.jpg`, base64Data, { base64: true });
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${filename || 'images_bundle'}.zip`);
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900 font-sans selection:bg-blue-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">ImgToPDF</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {images.length > 0 && (
              <>
                <button
                  onClick={downloadZip}
                  disabled={isZipping}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs text-neutral-600 hover:bg-neutral-100 transition-all active:scale-95 border border-neutral-200"
                >
                  {isZipping ? (
                    <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                  ZIP Bundle (1-n)
                </button>
                <button
                  onClick={() => setImages([])}
                  className="text-xs font-medium text-neutral-500 hover:text-red-600 transition-colors px-3 py-2"
                >
                  Clear
                </button>
              </>
            )}
            <button
              onClick={generatePDF}
              disabled={images.length === 0 || isGenerating}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all shadow-sm active:scale-95",
                images.length > 0 
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200/50" 
                  : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              )}
            >
              {isGenerating ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGenerating ? 'Converting...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Controls Section */}
        {images.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 grid grid-cols-1 md:grid-cols-[1fr,auto] gap-6 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm"
          >
            <div className="flex flex-wrap items-start gap-8">
              {/* Filename Input */}
              <div className="min-w-[240px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-3 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Filename
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="Enter filename..."
                    className="w-full bg-neutral-100 border-none rounded-xl px-4 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-3 flex items-center gap-1.5">
                  <Layout className="w-3 h-3" /> Page Format
                </label>
                <div className="flex bg-neutral-100 p-1 rounded-xl">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      orientation === 'portrait' ? "bg-white shadow-sm text-blue-600" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    A4 Vertical
                  </button>
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      orientation === 'landscape' ? "bg-white shadow-sm text-blue-600" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Minimize2 className="w-3.5 h-3.5 rotate-90" />
                    A4 Horizontal
                  </button>
                  <button
                    onClick={() => setOrientation('original')}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                      orientation === 'original' ? "bg-white shadow-sm text-blue-600" : "text-neutral-500 hover:text-neutral-700"
                    )}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Original Size
                  </button>
                </div>
              </div>

              {/* Compression */}
              <div className="min-w-[200px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Settings2 className="w-3 h-3" /> Compression
                  </div>
                  <span className="text-neutral-900 font-mono">{Math.round((1 - compression) * 100)}%</span>
                </label>
                <div className="px-1 py-2">
                  <input 
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={compression}
                    onChange={(e) => setCompression(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase">High Quality</span>
                    <span className="text-[9px] font-bold text-neutral-400 uppercase">Max Compression</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end justify-center border-l border-neutral-100 pl-8 hidden md:flex">
              <span className="text-4xl font-black text-neutral-900 leading-none">{images.length}</span>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-2">Selected</span>
            </div>
          </motion.div>
        )}

        {/* Dropzone & List */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "min-h-[500px] rounded-[2rem] border-2 border-dashed transition-all duration-500 relative",
            isDraggingOver 
              ? "border-blue-500 bg-blue-50/50 scale-[1.01]" 
              : "border-neutral-200 bg-white"
          )}
        >
          {images.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-8 text-blue-500 ring-[12px] ring-blue-50/50"
              >
                <Upload className="w-12 h-12" />
              </motion.div>
              <h2 className="text-3xl font-black mb-3 tracking-tight">Ready to convert?</h2>
              <p className="text-neutral-500 max-w-sm mb-10 text-lg leading-relaxed">
                Paste images with <kbd className="font-sans font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded">Ctrl+V</kbd> or drag them here to begin.
              </p>
              
              <label className="bg-neutral-900 text-white px-10 py-4 rounded-full font-black text-sm cursor-pointer hover:bg-neutral-800 transition-all shadow-xl active:scale-95 flex items-center gap-3 hover:shadow-neutral-200 hover:px-12">
                <ImageIcon className="w-5 h-5" />
                Select Images
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
              </label>
            </div>
          ) : (
            <div className="p-8">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={images.map(img => img.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    <AnimatePresence mode="popLayout">
                      {images.map((image) => (
                        <motion.div
                          key={image.id}
                          layout
                          initial={{ opacity: 0, scale: 0.8, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.8, y: -20 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        >
                          <SortableImageItem 
                            image={image} 
                            onRemove={removeImage} 
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    <label className="border-2 border-dashed border-neutral-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group min-h-[200px] bg-neutral-50/50">
                      <div className="p-3 bg-white rounded-full text-neutral-400 group-hover:text-blue-500 group-hover:scale-110 shadow-sm transition-all">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] group-hover:text-blue-600 transition-colors">Add More</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                      />
                    </label>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Bar for Mobile */}
      {images.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex sm:hidden">
           <button
            onClick={downloadZip}
            disabled={isZipping}
            className="flex items-center gap-2 px-6 py-4 rounded-full font-black text-xs bg-white text-neutral-900 border border-neutral-200 shadow-2xl active:scale-95"
          >
            {isZipping ? (
              <div className="w-4 h-4 border-2 border-neutral-300 border-t-neutral-600 rounded-full animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            ZIP
          </button>
        </div>
      )}

      {/* Drag Overlay Helper */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-blue-600/10 backdrop-blur-[2px]"
          >
            <div className="bg-white px-10 py-6 rounded-3xl shadow-2xl border-2 border-blue-500 flex flex-col items-center gap-4 scale-110">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                <Upload className="w-8 h-8 animate-bounce" />
              </div>
              <span className="font-black text-blue-600 text-lg uppercase tracking-widest">Drop to Import</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
