import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical } from 'lucide-react';
import { ImageItem } from '../types';
import { cn } from '../lib/utils';

interface Props {
  image: ImageItem;
  onRemove: (id: string) => void;
}

export function SortableImageItem({ image, onRemove }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group bg-white border border-neutral-200 rounded-lg overflow-hidden transition-all',
        isDragging && 'z-50 shadow-2xl ring-2 ring-blue-500 scale-105 opacity-80'
      )}
    >
      <div className="aspect-square relative overflow-hidden bg-neutral-50">
        <img
          src={image.url}
          alt={image.name}
          className="w-full h-full object-contain"
        />
        
        {/* Handle for dragging */}
        <div
          {...attributes}
          {...listeners}
          className="absolute inset-0 cursor-grab active:cursor-grabbing flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity"
        >
          <div className="bg-white p-2 rounded-full shadow-lg">
            <GripVertical className="w-5 h-5 text-neutral-600" />
          </div>
        </div>

        {/* Remove button */}
        <button
          onClick={() => onRemove(image.id)}
          className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
          title="Remove image"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-3">
        <p className="text-xs font-medium text-neutral-700 truncate" title={image.name}>
          {image.name}
        </p>
        <p className="text-[10px] text-neutral-400 mt-0.5">
          {image.width} × {image.height}
        </p>
      </div>
    </div>
  );
}
