export type WhiteboardPenColor = { id: string; value: string; label: string };
export type WhiteboardPenWidth = { value: number; label: string };

export const WHITEBOARD_PEN_COLORS: WhiteboardPenColor[] = [
  { id: 'navy', value: '#1e3a8a', label: 'Navy' },
  { id: 'black', value: '#111827', label: 'Black' },
  { id: 'red', value: '#dc2626', label: 'Red' },
  { id: 'orange', value: '#ea580c', label: 'Orange' },
  { id: 'green', value: '#15803d', label: 'Green' },
  { id: 'blue', value: '#2563eb', label: 'Blue' },
  { id: 'purple', value: '#7c3aed', label: 'Purple' },
  { id: 'pink', value: '#db2777', label: 'Pink' },
];

export const WHITEBOARD_PEN_WIDTHS: WhiteboardPenWidth[] = [
  { value: 2, label: 'Fine' },
  { value: 4, label: 'Medium' },
  { value: 8, label: 'Thick' },
  { value: 14, label: 'Marker' },
];

export const WHITEBOARD_DEFAULT_PEN = {
  color: WHITEBOARD_PEN_COLORS[0].value,
  width: WHITEBOARD_PEN_WIDTHS[1].value,
};
