import { CompositeTemplate } from "@/lib/types";

export function getPhotoScale(template: CompositeTemplate) {
  return template.photoArea.scale ?? 100;
}

export function resolvePhotoArea(template: CompositeTemplate) {
  const { x, y, w, h } = template.photoArea;
  const scale = getPhotoScale(template) / 100;
  const scaledW = w * scale;
  const scaledH = h * scale;

  return {
    x: x - (scaledW - w) / 2,
    y: y - (scaledH - h) / 2,
    w: scaledW,
    h: scaledH,
  };
}
