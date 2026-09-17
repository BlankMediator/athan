// Build-time separation keeps native plugins out of the desktop and browser entry points.
export const isMobile = import.meta.env.MODE === 'mobile';
