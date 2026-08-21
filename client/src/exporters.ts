import { useCanvasStore } from './store/canvasStore';
import type { DiagramShape } from '@shared/index';

export function exportCanvasToPng() {
  const canvas = document.querySelector<HTMLCanvasElement>('.diagram-canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'nodeboard.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportCanvasToSvg() {
  const shapes = useCanvasStore.getState().shapes;
  const svg = buildSvg(shapes);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'nodeboard.svg';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSvg(shapes: DiagramShape[]) {
  const width = 1600;
  const height = 1200;
  const content = shapes.map(renderShape).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#f8fafc" />
${content}
</svg>`;
}

function renderShape(shape: DiagramShape) {
  if (shape.kind === 'rectangle') {
    return `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="${shape.radius ?? 12}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" />`;
  }
  if (shape.kind === 'circle') {
    return `<circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.radius}" fill="${shape.fill}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" />`;
  }
  if (shape.kind === 'line' || shape.kind === 'arrow') {
    const marker = shape.kind === 'arrow' ? ' marker-end="url(#arrowhead)"' : '';
    return `<line x1="${shape.start.point.x}" y1="${shape.start.point.y}" x2="${shape.end.point.x}" y2="${shape.end.point.y}" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}"${marker} />`;
  }
  if (shape.kind === 'freehand') {
    const path = shape.points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    return `<path d="${path}" fill="none" stroke="${shape.stroke}" stroke-width="${shape.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`;
  }
  return `<text x="${shape.x}" y="${shape.y}" font-size="${shape.fontSize}" fill="#0f172a" font-family="${shape.fontFamily}">${escapeXml(shape.text)}</text>`;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return char;
    }
  });
}
