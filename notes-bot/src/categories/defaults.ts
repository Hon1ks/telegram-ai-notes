export interface SystemCategorySeed {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  llm_hint: string;
  sort_order: number;
}

export const SYSTEM_CATEGORIES: SystemCategorySeed[] = [
  {
    slug: 'tasks',
    name: 'Задачи',
    emoji: '✅',
    color: '#3b82f6',
    llm_hint: 'задачи, дела, что нужно сделать',
    sort_order: 0,
  },
  {
    slug: 'ideas',
    name: 'Идеи',
    emoji: '💡',
    color: '#f59e0b',
    llm_hint: 'идеи, мысли, планы',
    sort_order: 1,
  },
  {
    slug: 'shopping',
    name: 'Покупки',
    emoji: '🛒',
    color: '#22c55e',
    llm_hint: 'покупки, что купить',
    sort_order: 2,
  },
  {
    slug: 'notes',
    name: 'Заметки',
    emoji: '📝',
    color: '#8b5cf6',
    llm_hint: 'всё остальное',
    sort_order: 3,
  },
];

export const DEFAULT_CATEGORY_SLUG = 'notes';
export const MAX_CATEGORIES_PER_USER = 20;