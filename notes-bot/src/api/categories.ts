import type { Env } from '../types';
import { authenticate, jsonResponse, errorResponse } from './auth';
import {
  getCategoriesByUserId,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryBySlug,
} from '../db/queries';
import {
  parsePositiveInt,
  readJsonBody,
  validateCategorySlug,
  validateCategoryName,
  validateCategoryEmoji,
  validateCategoryColor,
  validateCategoryHint,
} from './validation';

export async function handleCategoriesApi(
  env: Env,
  request: Request,
  path: string,
  requestId: string
): Promise<Response> {
  const headers = { 'X-Request-Id': requestId };
  const user = await authenticate(env, request);
  if (!user) return errorResponse('Unauthorized', 401, request, env, headers);

  if (request.method === 'GET' && path === '/api/categories') {
    const categories = await getCategoriesByUserId(env, user.id);
    return jsonResponse(categories, 200, request, env, headers);
  }

  if (request.method === 'POST' && path === '/api/categories') {
    const body = await readJsonBody<{
      slug?: string;
      name?: string;
      emoji?: string;
      color?: string;
      llm_hint?: string | null;
    }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);

    const slug = validateCategorySlug(body.slug);
    const name = validateCategoryName(body.name);
    const emoji = validateCategoryEmoji(body.emoji);
    const color = validateCategoryColor(body.color);
    const llmHint = validateCategoryHint(body.llm_hint);

    if (!slug) return errorResponse('invalid slug', 400, request, env, headers);
    if (!name) return errorResponse('invalid name', 400, request, env, headers);
    if (emoji === null) return errorResponse('invalid emoji', 400, request, env, headers);
    if (color === null) return errorResponse('invalid color', 400, request, env, headers);
    if (llmHint === null) return errorResponse('invalid llm_hint', 400, request, env, headers);

    const existing = await getCategoryBySlug(env, user.id, slug);
    if (existing) return errorResponse('slug already exists', 409, request, env, headers);

    try {
      const category = await createCategory(env, user.id, {
        slug,
        name,
        emoji: emoji ?? '📝',
        color: color ?? '#8b5cf6',
        llm_hint: llmHint,
      });
      return jsonResponse(category, 201, request, env, headers);
    } catch (err) {
      if (err instanceof Error && err.message === 'category limit reached') {
        return errorResponse('category limit reached', 400, request, env, headers);
      }
      throw err;
    }
  }

  const categoryIdMatch = path.match(/^\/api\/categories\/(\d+)$/);
  if (!categoryIdMatch) return errorResponse('Not found', 404, request, env, headers);
  const categoryId = parsePositiveInt(categoryIdMatch[1]);
  if (!categoryId) return errorResponse('Not found', 404, request, env, headers);

  if (request.method === 'GET') {
    const category = await getCategoryById(env, categoryId, user.id);
    if (!category) return errorResponse('Not found', 404, request, env, headers);
    return jsonResponse(category, 200, request, env, headers);
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody<{
      name?: string;
      emoji?: string;
      color?: string;
      llm_hint?: string | null;
    }>(request);
    if (!body) return errorResponse('invalid JSON', 400, request, env, headers);

    const category = await getCategoryById(env, categoryId, user.id);
    if (!category) return errorResponse('Not found', 404, request, env, headers);

    const fields: {
      name?: string;
      emoji?: string;
      color?: string;
      llm_hint?: string | null;
    } = {};

    if ('name' in body) {
      const name = validateCategoryName(body.name);
      if (!name) return errorResponse('invalid name', 400, request, env, headers);
      fields.name = name;
    }
    if ('emoji' in body) {
      const emoji = validateCategoryEmoji(body.emoji);
      if (emoji === null) return errorResponse('invalid emoji', 400, request, env, headers);
      fields.emoji = emoji ?? '📝';
    }
    if ('color' in body) {
      const color = validateCategoryColor(body.color);
      if (color === null) return errorResponse('invalid color', 400, request, env, headers);
      fields.color = color ?? '#8b5cf6';
    }
    if ('llm_hint' in body) {
      const llmHint = validateCategoryHint(body.llm_hint);
      if (llmHint === null) return errorResponse('invalid llm_hint', 400, request, env, headers);
      fields.llm_hint = llmHint ?? null;
    }

    await updateCategory(env, categoryId, user.id, fields);
    const updated = await getCategoryById(env, categoryId, user.id);
    return jsonResponse(updated, 200, request, env, headers);
  }

  if (request.method === 'DELETE') {
    const category = await getCategoryById(env, categoryId, user.id);
    if (!category) return errorResponse('Not found', 404, request, env, headers);
    if (category.is_system === 1) {
      return errorResponse('cannot delete system category', 400, request, env, headers);
    }

    try {
      await deleteCategory(env, categoryId, user.id);
      return jsonResponse({ success: true }, 200, request, env, headers);
    } catch {
      return errorResponse('cannot delete category', 400, request, env, headers);
    }
  }

  return errorResponse('Method not allowed', 405, request, env, headers);
}