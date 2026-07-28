/** MIME type for skill rows dragged from WorkingSidebar into ChatInput. */
export const SKILL_DRAG_MIME = 'application/x-linkloom-skill';

export interface SkillDragPayload {
  category: string;
  label: string;
  type: string;
}
