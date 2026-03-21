import {
  CompositeConfig,
  CompositePattern,
  CompositeTemplate,
  ResponseImageTemplate,
} from "@/lib/types";
import { defaultCompositeConfig, defaultCompositeTemplate } from "@/lib/defaults";

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

export function normalizeCompositeConfig(
  input: CompositeConfig | CompositeTemplate | null | undefined,
): CompositeConfig {
  if (!input) {
    return structuredClone(defaultCompositeConfig);
  }

  if ("patterns" in input && Array.isArray(input.patterns) && input.patterns.length > 0) {
    const patterns = input.patterns
      .filter((pattern): pattern is CompositePattern => Boolean(pattern && typeof pattern === "object"))
      .map((pattern, index) => ({
        id: pattern.id ?? `pattern-${index + 1}`,
        name: pattern.name ?? `パターン ${index + 1}`,
        template: {
          ...structuredClone(defaultCompositeTemplate),
          ...(pattern.template ?? {}),
          photoArea: {
            ...structuredClone(defaultCompositeTemplate.photoArea),
            ...(pattern.template?.photoArea ?? {}),
          },
          textLayers: Array.isArray(pattern.template?.textLayers)
            ? pattern.template.textLayers
            : structuredClone(defaultCompositeTemplate.textLayers),
        },
      }));

    if (patterns.length === 0) {
      return structuredClone(defaultCompositeConfig);
    }

    return {
      activePatternId: input.activePatternId ?? patterns[0].id,
      patterns,
    };
  }

  if ("patterns" in input && Array.isArray(input.patterns) && input.patterns.length === 0) {
    return structuredClone(defaultCompositeConfig);
  }

  const legacyTemplate = input as CompositeTemplate;

  return {
    activePatternId: "pattern-1",
    patterns: [
      {
        id: "pattern-1",
        name: "パターン 1",
        template: {
          ...structuredClone(defaultCompositeTemplate),
          ...legacyTemplate,
          photoArea: {
            ...structuredClone(defaultCompositeTemplate.photoArea),
            ...legacyTemplate.photoArea,
          },
          textLayers:
            legacyTemplate.textLayers ?? structuredClone(defaultCompositeTemplate.textLayers),
        },
      },
    ],
  };
}

export function getPatternById(config: CompositeConfig, patternId: string | null | undefined) {
  return config.patterns.find((pattern) => pattern.id === patternId) ?? null;
}

export function getActiveCompositePattern(config: CompositeConfig) {
  if (config.patterns.length === 0) {
    return structuredClone(defaultCompositeConfig.patterns[0]);
  }

  return getPatternById(config, config.activePatternId) ?? config.patterns[0];
}

export function addCompositePattern(config: CompositeConfig) {
  const nextIndex = config.patterns.length + 1;
  const source = getActiveCompositePattern(config)?.template ?? defaultCompositeTemplate;
  const nextPattern: CompositePattern = {
    id: `pattern-${crypto.randomUUID().slice(0, 8)}`,
    name: `パターン ${nextIndex}`,
    template: structuredClone(source),
  };

  return {
    activePatternId: nextPattern.id,
    patterns: [...config.patterns, nextPattern],
  };
}

export function removeCompositePattern(config: CompositeConfig, patternId: string) {
  const nextPatterns = config.patterns.filter((pattern) => pattern.id !== patternId);
  if (nextPatterns.length === 0) {
    return structuredClone(defaultCompositeConfig);
  }

  return {
    activePatternId:
      config.activePatternId === patternId ? nextPatterns[0].id : config.activePatternId,
    patterns: nextPatterns,
  };
}

export function updateCompositePattern(
  config: CompositeConfig,
  patternId: string,
  updater: (pattern: CompositePattern) => CompositePattern,
) {
  return {
    ...config,
    patterns: config.patterns.map((pattern) =>
      pattern.id === patternId ? updater(pattern) : pattern,
    ),
  };
}

export function normalizeResponseImageTemplates(
  entries: ResponseImageTemplate[] | CompositeTemplate[] | null | undefined,
  config: CompositeConfig,
) {
  if (!entries?.length) return [];

  return entries
    .filter((entry): entry is ResponseImageTemplate | CompositeTemplate => Boolean(entry && typeof entry === "object"))
    .map((entry) => {
      if ("patternId" in entry) {
        return entry as ResponseImageTemplate;
      }

      return {
        patternId: config.activePatternId,
        template: entry as CompositeTemplate,
      };
    });
}

export function resolveResponseImageTemplate(
  entry: ResponseImageTemplate | undefined,
  config: CompositeConfig,
) {
  const pattern =
    getPatternById(config, entry?.patternId) ?? getActiveCompositePattern(config);

  return {
    patternId: pattern.id,
    template: entry?.template ?? pattern.template,
  };
}
