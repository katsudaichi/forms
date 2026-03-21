"use client";

import { useEffect, useRef, useState } from "react";

import { resolvePhotoArea } from "@/lib/composite";
import { CompositeTemplate } from "@/lib/types";

const COMPOSITE_REFERENCE_WIDTH = 560;

export function CompositePreview({
  template,
  values,
  imageUrl,
  selectedLayerId,
  onSelectLayer,
}: {
  template: CompositeTemplate;
  values: Record<string, string | string[]>;
  imageUrl?: string | null;
  selectedLayerId?: string | null;
  onSelectLayer?: (layerId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(COMPOSITE_REFERENCE_WIDTH);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth) {
        setContainerWidth(nextWidth);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = containerWidth / COMPOSITE_REFERENCE_WIDTH;
  const resolvedPhotoArea = resolvePhotoArea(template);

  return (
    <div
      ref={containerRef}
      className="composite-card"
      style={{ aspectRatio: `${template.frameAspect || 1} / 1` }}
    >
      <div
        className="composite-photo"
        data-selected={selectedLayerId === "photo" ? "true" : "false"}
        style={{
          left: `${resolvedPhotoArea.x}%`,
          top: `${resolvedPhotoArea.y}%`,
          width: `${resolvedPhotoArea.w}%`,
          height: `${resolvedPhotoArea.h}%`,
        }}
        onClick={() => onSelectLayer?.("photo")}
      >
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>PR IMAGE</span>}
        {selectedLayerId === "photo" ? <span className="composite-selection" aria-hidden="true" /> : null}
      </div>

      {template.frameUrl ? <img className="composite-frame" src={template.frameUrl} alt="" /> : null}

      {template.textLayers.map((layer) => {
        const raw = values[layer.fieldId];
        const text = Array.isArray(raw) ? raw.join(" / ") : raw;
        return (
          <div
            key={layer.id}
            className="composite-text"
            data-selected={selectedLayerId === layer.id ? "true" : "false"}
            style={{
              left: `${layer.x}%`,
              top: `${layer.y}%`,
              width: `${layer.w}%`,
              fontSize: `${Math.max(layer.fontSize * scale, 10)}px`,
              fontFamily: layer.fontFamily ?? "'Noto Sans JP', sans-serif",
              color: layer.color,
              fontWeight: layer.bold ? 700 : 400,
              textAlign: layer.align,
            }}
            onClick={() => onSelectLayer?.(layer.id)}
          >
            {text || "テキスト"}
            {selectedLayerId === layer.id ? (
              <span className="composite-selection composite-selection-text" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
