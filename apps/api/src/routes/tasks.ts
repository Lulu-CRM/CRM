import {
  idSchema,
  taskCreateSchema,
  taskListQuerySchema,
  taskUpdateSchema,
  type TaskCreateInput,
  type TaskListQuery,
  type TaskUpdateInput,
} from '@lulu/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { created, noContent, ok, paginated } from '../lib/response';
import { requirePermission } from '../middleware/auth';
import { requireContext } from '../middleware/requestContext';
import { validate } from '../middleware/validate';
import { createTask, deleteTask, listTasks, updateTask } from '../services/tasks';

// Tasks (docs/api.md, "Tasks, notes, activities"). Mounted at /tasks after requireAuth.
export const tasksRouter = Router();

const params = z.object({ id: idSchema });
const idOf = (req: Request) => (req.params as { id: string }).id;

tasksRouter.get(
  '/',
  validate({ query: taskListQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as TaskListQuery;
    const result = await listTasks(requireContext(req), query);
    paginated(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
    });
  }),
);

tasksRouter.post(
  '/',
  requirePermission('tasks', 'create'),
  validate({ body: taskCreateSchema }),
  asyncHandler(async (req, res) => {
    created(res, await createTask(requireContext(req), req.body as TaskCreateInput));
  }),
);

tasksRouter.patch(
  '/:id',
  requirePermission('tasks', 'edit'),
  validate({ params, body: taskUpdateSchema }),
  asyncHandler(async (req, res) => {
    ok(res, await updateTask(requireContext(req), idOf(req), req.body as TaskUpdateInput));
  }),
);

tasksRouter.delete(
  '/:id',
  requirePermission('tasks', 'delete'),
  validate({ params }),
  asyncHandler(async (req, res) => {
    await deleteTask(requireContext(req), idOf(req));
    noContent(res);
  }),
);
