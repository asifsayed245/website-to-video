'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AssetJob, CameraDirection } from '@/lib/types';
import { ImageLightbox } from './ImageLightbox';

function SortableImage({ job, onClick }: { job: AssetJob; onClick?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`aspect-video glass-panel overflow-hidden flex items-center justify-center relative group ${
        job.status === 'done' && job.resultUrl
          ? 'cursor-pointer hover:ring-2 hover:ring-accent/50 transition-all'
          : ''
      }`}
      onClick={onClick}
    >
      {job.status === 'done' && job.resultUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.resultUrl} alt={job.sceneId} className="w-full h-full object-cover" />
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="absolute top-1 left-1 w-5 h-5 rounded bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3 text-white" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
            </svg>
          </div>
        </>
      ) : job.status === 'failed' ? (
        <span className="text-xs text-red-500">Failed</span>
      ) : (
        <div className="animate-pulse w-6 h-6 rounded-full bg-warm-200/50" />
      )}
    </div>
  );
}

interface AssetGalleryProps {
  jobs: AssetJob[];
  clipJobs?: AssetJob[];
  cameraDirections?: CameraDirection[];
  isClipStage?: boolean;
  onSkipClips?: () => void;
  onRegenerateImage?: (job: AssetJob, description: string) => void;
  isRegenerating?: boolean;
  onJobsReorder?: (reorderedJobs: AssetJob[]) => void;
}

export function AssetGallery({ jobs, clipJobs = [], cameraDirections = [], isClipStage, onSkipClips, onRegenerateImage, isRegenerating, onJobsReorder }: AssetGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const imageJobs = jobs.filter((j) => j.type === 'image');
  const audioJobs = jobs.filter((j) => j.type === 'audio');
  const completedImageJobs = imageJobs.filter((j) => j.status === 'done' && j.resultUrl);

  const allJobs = isClipStage ? clipJobs : jobs;
  const totalJobs = allJobs.length;
  const doneJobs = allJobs.filter((j) => j.status === 'done').length;
  const failedJobs = allJobs.filter((j) => j.status === 'failed').length;
  const progress = totalJobs > 0 ? Math.round((doneJobs / totalJobs) * 100) : 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-warm-800">
          {isClipStage ? 'Generating Video Clips' : 'Generating Assets'}
        </h2>
        <span className="glass-badge text-xs">
          {doneJobs}/{totalJobs} complete
          {failedJobs > 0 && ` (${failedJobs} failed)`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="glass-panel p-3 mb-6">
        <div className="w-full h-2 bg-warm-200/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent to-amber-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-warm-600 mt-2 text-center">
          {isClipStage
            ? 'Converting images to video clips with AI cinematography...'
            : 'Generating images and voiceover audio...'}
        </p>
      </div>

      {/* Video Clips (clip generation stage) */}
      {isClipStage && clipJobs.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-warm-700 mb-2">Video Clips</h3>
          <div className="grid grid-cols-3 gap-3">
            {clipJobs.map((job) => {
              const direction = cameraDirections.find((d) => d.sceneId === job.sceneId);
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-3"
                >
                  <div className="aspect-video bg-warm-100/50 rounded-lg overflow-hidden flex items-center justify-center mb-2">
                    {job.status === 'done' && job.resultUrl ? (
                      <video
                        src={job.resultUrl}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : job.status === 'failed' ? (
                      <span className="text-xs text-red-500">Failed</span>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-8 h-8 animate-spin" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-warm-200/50" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="88" strokeDashoffset="22" strokeLinecap="round" className="text-accent" />
                        </svg>
                        <span className="text-[10px] text-warm-600">Processing</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-warm-600 truncate">{job.sceneId}</p>
                  {direction && (
                    <span className="glass-badge text-[9px] mt-1 inline-block">
                      {direction.movement.replace(/_/g, ' ')}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>

          {onSkipClips && (
            <button
              onClick={onSkipClips}
              className="glass-btn-secondary w-full mt-3 py-2 text-xs"
            >
              Skip Clip Generation (use static images)
            </button>
          )}
        </div>
      )}

      {/* Images with Drag-and-Drop Reorder */}
      {!isClipStage && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-warm-700 mb-2">B-Roll Images</h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (!over || active.id === over.id || !onJobsReorder) return;
              const oldIndex = imageJobs.findIndex((j) => j.id === active.id);
              const newIndex = imageJobs.findIndex((j) => j.id === over.id);
              if (oldIndex === -1 || newIndex === -1) return;
              const reordered = [...imageJobs];
              const [moved] = reordered.splice(oldIndex, 1);
              reordered.splice(newIndex, 0, moved);
              onJobsReorder(reordered);
            }}
          >
            <SortableContext items={imageJobs.map((j) => j.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-5 gap-2">
                {imageJobs.map((job) => {
                  const completedIndex = completedImageJobs.indexOf(job);
                  return (
                    <SortableImage
                      key={job.id}
                      job={job}
                      onClick={completedIndex >= 0 ? () => setLightboxIndex(completedIndex) : undefined}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Audio */}
      {!isClipStage && (
        <div>
          <h3 className="text-sm font-semibold text-warm-700 mb-2">Voiceover Audio</h3>
          <div className="space-y-1.5">
            {audioJobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center gap-3 glass-panel px-3 py-2"
              >
                <span className="text-xs text-warm-600 w-20 shrink-0">{job.sceneId}</span>
                <div className="flex-1 h-1.5 bg-warm-200/50 rounded-full overflow-hidden">
                  {job.status === 'done' ? (
                    <div className="h-full bg-emerald-500/80 rounded-full w-full" />
                  ) : job.status === 'failed' ? (
                    <div className="h-full bg-red-400 rounded-full w-full" />
                  ) : (
                    <div className="h-full bg-accent rounded-full w-1/2 animate-pulse" />
                  )}
                </div>
                <span className={`text-xs font-medium ${
                  job.status === 'done' ? 'text-emerald-600' :
                  job.status === 'failed' ? 'text-red-500' : 'text-warm-600'
                }`}>
                  {job.status === 'done' ? 'Ready' : job.status === 'failed' ? 'Failed' : 'Generating...'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && completedImageJobs.length > 0 && (
        <ImageLightbox
          images={completedImageJobs}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onRegenerate={onRegenerateImage}
          isRegenerating={isRegenerating}
        />
      )}
    </div>
  );
}
