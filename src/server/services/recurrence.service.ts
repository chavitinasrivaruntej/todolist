import {
  type IRecurrenceRepository,
  recurrenceRepository as defaultRecurrenceRepo,
} from "@/server/repositories/recurrence.repository";
import {
  type ITodoRepository,
  todoRepository as defaultTodoRepo,
  type TodoWithTags,
} from "@/server/repositories/todo.repository";
import {
  type ITagRepository,
  tagRepository as defaultTagRepo,
} from "@/server/repositories/tag.repository";
import {
  ListPermissionService,
  listPermissionService as defaultPermissionService,
} from "@/server/services/list-permission.service";
import {
  ActivityService,
  activityService as defaultActivityService,
} from "@/server/services/activity.service";
import { withTransaction } from "@/server/utils/transaction";
import { db as defaultDb, type Database, type DbExecutor } from "@/db";
import { type RecurrenceRule } from "@/db/schema/recurrence";
import { type Todo } from "@/db/schema/todos";
import { calculateNextOccurrence } from "@/lib/recurrence-engine";
import {
  type CreateRecurrenceRuleInput,
  type UpdateRecurrenceRuleInput,
} from "@/lib/validations/recurrence";
import { NotFoundError, ValidationError } from "@/server/errors";

export type CreateRecurringTaskServiceInput = CreateRecurrenceRuleInput;

export class RecurrenceService {
  private readonly recurrenceRepo: IRecurrenceRepository;
  private readonly todoRepo: ITodoRepository;
  private readonly tagRepo: ITagRepository;
  private readonly permissionService: ListPermissionService;
  private readonly activityService: ActivityService;
  private readonly db: Database;

  constructor(
    recurrenceRepo: IRecurrenceRepository = defaultRecurrenceRepo,
    todoRepo: ITodoRepository = defaultTodoRepo,
    tagRepo: ITagRepository = defaultTagRepo,
    permissionService: ListPermissionService = defaultPermissionService,
    activityService: ActivityService = defaultActivityService,
    database: Database = defaultDb
  ) {
    this.recurrenceRepo = recurrenceRepo;
    this.todoRepo = todoRepo;
    this.tagRepo = tagRepo;
    this.permissionService = permissionService;
    this.activityService = activityService;
    this.db = database;
  }

  /**
   * Retrieves all recurrence rules for a list.
   * Allowed for OWNER, EDITOR, and VIEWER.
   */
  async getRulesByList(listId: string, userId: string): Promise<RecurrenceRule[]> {
    await this.permissionService.requireCanReadList(userId, listId);
    return this.recurrenceRepo.findByListId(listId);
  }

  /**
   * Retrieves a recurrence rule by ID.
   */
  async getRuleById(id: string, userId: string): Promise<RecurrenceRule> {
    const rule = await this.recurrenceRepo.findById(id);
    if (!rule) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }
    await this.permissionService.requireCanReadList(userId, rule.listId);
    return rule;
  }

  /**
   * Creates a recurring task schedule and its initial occurrence (#1).
   * Allowed for OWNER and EDITOR.
   */
  async createRecurringTask(
    input: CreateRecurringTaskServiceInput,
    userId: string
  ): Promise<{ rule: RecurrenceRule; initialTodo: TodoWithTags }> {
    const trimmedTitle = input.baseTitle.trim();
    if (!trimmedTitle) {
      throw new ValidationError("Todo title cannot be empty or solely whitespace.");
    }

    await this.permissionService.requireCanMutateTodos(userId, input.listId);

    // Verify all specified tags belong to this list
    if (input.baseTagIds && input.baseTagIds.length > 0) {
      const verified = await this.tagRepo.findByIdsAndListId(
        input.baseTagIds,
        input.listId
      );
      if (verified.length !== input.baseTagIds.length) {
        throw new ValidationError("One or more selected tags do not belong to this list.");
      }
    }

    // Determine anchors from start date if not explicitly provided
    const [startYear, startMonth, startDay] = input.startDate.split("-").map(Number);
    const anchorDay = input.anchorDayOfMonth ?? startDay;
    const anchorMonth = input.anchorMonthOfYear ?? startMonth;

    return withTransaction(this.db, async (tx) => {
      // Calculate next due date for occurrence #2
      const nextDueDate = calculateNextOccurrence(
        {
          frequency: input.frequency,
          interval: input.interval,
          daysOfWeek: input.daysOfWeek,
          anchorDayOfMonth: anchorDay,
          anchorMonthOfYear: anchorMonth,
          startDate: input.startDate,
          endDate: input.endDate,
          maxOccurrences: input.maxOccurrences,
        },
        input.startDate,
        1
      );

      const isImmediatelyCompleted =
        (input.maxOccurrences !== undefined && input.maxOccurrences !== null && input.maxOccurrences <= 1) ||
        !nextDueDate;

      const rule = await this.recurrenceRepo.createRule(
        {
          listId: input.listId,
          frequency: input.frequency,
          interval: input.interval,
          daysOfWeek: input.daysOfWeek ?? null,
          anchorDayOfMonth: anchorDay,
          anchorMonthOfYear: anchorMonth,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          maxOccurrences: input.maxOccurrences ?? null,
          occurrencesGenerated: 1,
          lastGeneratedOccurrenceNumber: 1,
          status: isImmediatelyCompleted ? "COMPLETED" : "ACTIVE",
          nextDueDate: isImmediatelyCompleted ? null : nextDueDate,
          baseTitle: trimmedTitle,
          baseDescription: input.baseDescription ?? null,
          basePriority: input.basePriority ?? "MEDIUM",
          baseTagIds: input.baseTagIds ?? [],
        },
        tx
      );

      // Create initial todo occurrence (#1)
      const initialTodo = await this.todoRepo.create(
        {
          listId: input.listId,
          title: trimmedTitle,
          description: input.baseDescription ?? null,
          priority: input.basePriority ?? "MEDIUM",
          status: "TODO",
          dueDate: input.startDate,
          recurrenceRuleId: rule.id,
          occurrenceNumber: 1,
        },
        tx
      );

      // Assign tags if any
      if (input.baseTagIds && input.baseTagIds.length > 0) {
        await this.tagRepo.assignTagsToTodo(initialTodo.id, input.baseTagIds, tx);
      }

      const assignedTags = input.baseTagIds && input.baseTagIds.length > 0
        ? await this.tagRepo.findTagsForTodo(initialTodo.id)
        : [];

      // Log recurrence creation activity
      await this.activityService.logActivity(
        {
          listId: input.listId,
          actorId: userId,
          action: "RECURRENCE_CREATED",
          entityType: "RECURRENCE",
          entityId: rule.id,
          metadata: {
            title: trimmedTitle,
            frequency: input.frequency,
            startDate: input.startDate,
            initialTodoId: initialTodo.id,
          },
        },
        tx
      );

      return {
        rule,
        initialTodo: {
          ...initialTodo,
          tags: assignedTags,
        },
      };
    });
  }

  /**
   * Updates an existing recurrence rule template.
   */
  async updateRecurrenceRule(
    input: UpdateRecurrenceRuleInput,
    userId: string
  ): Promise<RecurrenceRule> {
    const existing = await this.recurrenceRepo.findById(input.id);
    if (!existing) {
      throw new NotFoundError(`Recurrence rule with ID ${input.id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, existing.listId);

    if (input.baseTagIds && input.baseTagIds.length > 0) {
      const verified = await this.tagRepo.findByIdsAndListId(
        input.baseTagIds,
        existing.listId
      );
      if (verified.length !== input.baseTagIds.length) {
        throw new ValidationError("One or more selected tags do not belong to this list.");
      }
    }

    return withTransaction(this.db, async (tx) => {
      const updatedFreq = input.frequency ?? existing.frequency;
      const updatedInterval = input.interval ?? existing.interval;
      const updatedDaysOfWeek =
        input.daysOfWeek !== undefined ? input.daysOfWeek : existing.daysOfWeek;
      const updatedAnchorDay = input.anchorDayOfMonth ?? existing.anchorDayOfMonth;
      const updatedAnchorMonth = input.anchorMonthOfYear ?? existing.anchorMonthOfYear;
      const updatedEndDate =
        input.endDate !== undefined ? input.endDate : existing.endDate;
      const updatedMaxOccurrences =
        input.maxOccurrences !== undefined
          ? input.maxOccurrences
          : existing.maxOccurrences;

      // Recalculate next due date if schedule configuration changed
      let nextDueDate = existing.nextDueDate;
      if (
        existing.status === "ACTIVE" &&
        existing.lastGeneratedOccurrenceNumber !== null
      ) {
        nextDueDate = calculateNextOccurrence(
          {
            frequency: updatedFreq,
            interval: updatedInterval,
            daysOfWeek: updatedDaysOfWeek,
            anchorDayOfMonth: updatedAnchorDay,
            anchorMonthOfYear: updatedAnchorMonth,
            startDate: existing.startDate,
            endDate: updatedEndDate,
            maxOccurrences: updatedMaxOccurrences,
          },
          existing.nextDueDate ?? existing.startDate,
          existing.lastGeneratedOccurrenceNumber
        );
      }

      const updated = await this.recurrenceRepo.updateRule(
        input.id,
        {
          frequency: updatedFreq,
          interval: updatedInterval,
          daysOfWeek: updatedDaysOfWeek,
          anchorDayOfMonth: updatedAnchorDay,
          anchorMonthOfYear: updatedAnchorMonth,
          endDate: updatedEndDate,
          maxOccurrences: updatedMaxOccurrences,
          nextDueDate,
          baseTitle: input.baseTitle ? input.baseTitle.trim() : existing.baseTitle,
          baseDescription:
            input.baseDescription !== undefined
              ? input.baseDescription
              : existing.baseDescription,
          basePriority: input.basePriority ?? existing.basePriority,
          baseTagIds:
            input.baseTagIds !== undefined
              ? input.baseTagIds
              : existing.baseTagIds,
          updatedAt: new Date(),
        },
        tx
      );

      if (!updated) {
        throw new NotFoundError(`Recurrence rule with ID ${input.id} was not found.`);
      }

      await this.activityService.logActivity(
        {
          listId: existing.listId,
          actorId: userId,
          action: "RECURRENCE_UPDATED",
          entityType: "RECURRENCE",
          entityId: updated.id,
          metadata: {
            frequency: updated.frequency,
            title: updated.baseTitle,
          },
        },
        tx
      );

      return updated;
    });
  }

  /**
   * Pauses an active recurrence rule.
   */
  async pauseRecurrence(id: string, userId: string): Promise<RecurrenceRule> {
    const rule = await this.recurrenceRepo.findById(id);
    if (!rule) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, rule.listId);

    if (rule.status === "PAUSED") {
      return rule;
    }

    const updated = await this.recurrenceRepo.updateRule(id, {
      status: "PAUSED",
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }

    await this.activityService.logActivity({
      listId: rule.listId,
      actorId: userId,
      action: "RECURRENCE_PAUSED",
      entityType: "RECURRENCE",
      entityId: rule.id,
      metadata: {
        title: rule.baseTitle,
      },
    });

    return updated;
  }

  /**
   * Resumes a paused recurrence rule.
   */
  async resumeRecurrence(id: string, userId: string): Promise<RecurrenceRule> {
    const rule = await this.recurrenceRepo.findById(id);
    if (!rule) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, rule.listId);

    if (rule.status === "ACTIVE") {
      return rule;
    }

    const updated = await this.recurrenceRepo.updateRule(id, {
      status: "ACTIVE",
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }

    await this.activityService.logActivity({
      listId: rule.listId,
      actorId: userId,
      action: "RECURRENCE_RESUMED",
      entityType: "RECURRENCE",
      entityId: rule.id,
      metadata: {
        title: rule.baseTitle,
      },
    });

    return updated;
  }

  /**
   * Ends a recurrence rule permanently (status COMPLETED).
   */
  async endRecurrence(id: string, userId: string): Promise<RecurrenceRule> {
    const rule = await this.recurrenceRepo.findById(id);
    if (!rule) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, rule.listId);

    if (rule.status === "COMPLETED") {
      return rule;
    }

    const updated = await this.recurrenceRepo.updateRule(id, {
      status: "COMPLETED",
      nextDueDate: null,
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError(`Recurrence rule with ID ${id} was not found.`);
    }

    await this.activityService.logActivity({
      listId: rule.listId,
      actorId: userId,
      action: "RECURRENCE_ENDED",
      entityType: "RECURRENCE",
      entityId: rule.id,
      metadata: {
        title: rule.baseTitle,
      },
    });

    return updated;
  }

  /**
   * Detaches an individual todo from its recurring series.
   */
  async detachRecurrence(todoId: string, userId: string): Promise<Todo> {
    const listId = await this.todoRepo.findListIdByTodoId(todoId);
    if (!listId) {
      throw new NotFoundError(`Todo with ID ${todoId} was not found.`);
    }

    await this.permissionService.requireCanMutateTodos(userId, listId);

    const updated = await this.todoRepo.detachRecurrence(todoId);
    if (!updated) {
      throw new NotFoundError(`Todo with ID ${todoId} was not found.`);
    }

    return updated;
  }

  /**
   * Generates the next occurrence when a recurring task is completed.
   * Atomic, row-locked, and idempotent.
   */
  async handleTaskCompletion(
    completedTodo: Todo,
    userId: string,
    tx?: DbExecutor
  ): Promise<Todo | null> {
    if (!completedTodo.recurrenceRuleId) {
      return null;
    }

    // Row-lock the recurrence rule to prevent race conditions
    const rule = await this.recurrenceRepo.findByIdForUpdate(
      completedTodo.recurrenceRuleId,
      tx
    );

    if (!rule || rule.status !== "ACTIVE") {
      return null;
    }

    // Check if max occurrences reached
    if (
      rule.maxOccurrences !== null &&
      rule.occurrencesGenerated >= rule.maxOccurrences
    ) {
      await this.recurrenceRepo.updateRule(
        rule.id,
        {
          status: "COMPLETED",
          nextDueDate: null,
          updatedAt: new Date(),
        },
        tx
      );
      await this.activityService.logActivity(
        {
          listId: rule.listId,
          actorId: userId,
          action: "RECURRENCE_ENDED",
          entityType: "RECURRENCE",
          entityId: rule.id,
          metadata: {
            title: rule.baseTitle,
            reason: "MAX_OCCURRENCES_REACHED",
          },
        },
        tx
      );
      return null;
    }

    const nextOccurrenceNumber = rule.lastGeneratedOccurrenceNumber + 1;

    // Idempotency check: if next occurrence already exists (e.g., duplicate call or retry)
    const existingNext = await this.todoRepo.findByRecurrenceRuleAndOccurrence(
      rule.id,
      nextOccurrenceNumber,
      tx
    );
    if (existingNext) {
      return existingNext;
    }

    // Determine the due date for this new occurrence
    const occurrenceDueDate = rule.nextDueDate ?? rule.startDate;

    // Check if occurrence exceeds endDate
    if (rule.endDate && occurrenceDueDate > rule.endDate) {
      await this.recurrenceRepo.updateRule(
        rule.id,
        {
          status: "COMPLETED",
          nextDueDate: null,
          updatedAt: new Date(),
        },
        tx
      );
      await this.activityService.logActivity(
        {
          listId: rule.listId,
          actorId: userId,
          action: "RECURRENCE_ENDED",
          entityType: "RECURRENCE",
          entityId: rule.id,
          metadata: {
            title: rule.baseTitle,
            reason: "END_DATE_EXCEEDED",
          },
        },
        tx
      );
      return null;
    }

    // Calculate the subsequent due date for the next occurrence after this one
    const nextNextDueDate = calculateNextOccurrence(
      {
        frequency: rule.frequency,
        interval: rule.interval,
        daysOfWeek: rule.daysOfWeek,
        anchorDayOfMonth: rule.anchorDayOfMonth,
        anchorMonthOfYear: rule.anchorMonthOfYear,
        startDate: rule.startDate,
        endDate: rule.endDate,
        maxOccurrences: rule.maxOccurrences,
      },
      occurrenceDueDate,
      nextOccurrenceNumber
    );

    // Create the next todo occurrence
    const nextTodo = await this.todoRepo.create(
      {
        listId: rule.listId,
        title: rule.baseTitle,
        description: rule.baseDescription,
        priority: rule.basePriority,
        status: "TODO",
        dueDate: occurrenceDueDate,
        recurrenceRuleId: rule.id,
        occurrenceNumber: nextOccurrenceNumber,
      },
      tx
    );

    // Copy tags if any
    const tagIds: string[] = rule.baseTagIds ?? [];
    if (tagIds.length > 0) {
      await this.tagRepo.assignTagsToTodo(nextTodo.id, tagIds, tx);
    }

    // Check if the series is now finished
    const isCompleted =
      (rule.maxOccurrences !== null &&
        rule.occurrencesGenerated + 1 >= rule.maxOccurrences) ||
      (rule.endDate !== null && nextNextDueDate !== null && nextNextDueDate > rule.endDate) ||
      !nextNextDueDate;

    // Update rule counters
    await this.recurrenceRepo.updateRule(
      rule.id,
      {
        occurrencesGenerated: rule.occurrencesGenerated + 1,
        lastGeneratedOccurrenceNumber: nextOccurrenceNumber,
        nextDueDate: isCompleted ? null : nextNextDueDate,
        status: isCompleted ? "COMPLETED" : "ACTIVE",
        updatedAt: new Date(),
      },
      tx
    );

    // Log occurrence generated activity
    await this.activityService.logActivity(
      {
        listId: rule.listId,
        actorId: userId,
        action: "RECURRING_OCCURRENCE_GENERATED",
        entityType: "TODO",
        entityId: nextTodo.id,
        metadata: {
          ruleId: rule.id,
          occurrenceNumber: nextOccurrenceNumber,
          dueDate: occurrenceDueDate,
          title: nextTodo.title,
        },
      },
      tx
    );

    return nextTodo;
  }

  /**
   * Dedicated catch-up mechanism to recover missed occurrences without silent writes on reads.
   * Can be invoked explicitly by client or background job.
   */
  async syncCatchUp(
    listId: string,
    userId: string,
    todayIso?: string
  ): Promise<{ generatedCount: number }> {
    await this.permissionService.requireCanMutateTodos(userId, listId);
    const today = todayIso ?? new Date().toISOString().slice(0, 10);

    const rules = await this.recurrenceRepo.findByListId(listId);
    let generatedCount = 0;

    for (const rule of rules) {
      if (rule.status !== "ACTIVE" || !rule.nextDueDate || rule.nextDueDate > today) {
        continue;
      }

      // Check if an uncompleted occurrence already exists for this rule
      const activeOccurrence = await this.todoRepo.findActiveOccurrenceByRuleId(
        rule.id
      );
      if (activeOccurrence) {
        // If current occurrence is not completed, don't generate another until completed
        continue;
      }

      await withTransaction(this.db, async (tx) => {
        const lockedRule = await this.recurrenceRepo.findByIdForUpdate(rule.id, tx);
        if (!lockedRule || lockedRule.status !== "ACTIVE" || !lockedRule.nextDueDate) {
          return;
        }

        const nextOccurrenceNumber = lockedRule.lastGeneratedOccurrenceNumber + 1;
        const occurrenceDueDate = lockedRule.nextDueDate;

        const nextTodo = await this.todoRepo.create(
          {
            listId: lockedRule.listId,
            title: lockedRule.baseTitle,
            description: lockedRule.baseDescription,
            priority: lockedRule.basePriority,
            status: "TODO",
            dueDate: occurrenceDueDate,
            recurrenceRuleId: lockedRule.id,
            occurrenceNumber: nextOccurrenceNumber,
          },
          tx
        );

        const tagIds: string[] = lockedRule.baseTagIds ?? [];
        if (tagIds.length > 0) {
          await this.tagRepo.assignTagsToTodo(nextTodo.id, tagIds, tx);
        }

        const nextNextDueDate = calculateNextOccurrence(
          {
            frequency: lockedRule.frequency,
            interval: lockedRule.interval,
            daysOfWeek: lockedRule.daysOfWeek,
            anchorDayOfMonth: lockedRule.anchorDayOfMonth,
            anchorMonthOfYear: lockedRule.anchorMonthOfYear,
            startDate: lockedRule.startDate,
            endDate: lockedRule.endDate,
            maxOccurrences: lockedRule.maxOccurrences,
          },
          occurrenceDueDate,
          nextOccurrenceNumber
        );

        const isCompleted =
          (lockedRule.maxOccurrences !== null &&
            lockedRule.occurrencesGenerated + 1 >= lockedRule.maxOccurrences) ||
          (lockedRule.endDate !== null &&
            nextNextDueDate !== null &&
            nextNextDueDate > lockedRule.endDate) ||
          !nextNextDueDate;

        await this.recurrenceRepo.updateRule(
          lockedRule.id,
          {
            occurrencesGenerated: lockedRule.occurrencesGenerated + 1,
            lastGeneratedOccurrenceNumber: nextOccurrenceNumber,
            nextDueDate: isCompleted ? null : nextNextDueDate,
            status: isCompleted ? "COMPLETED" : "ACTIVE",
            updatedAt: new Date(),
          },
          tx
        );

        await this.activityService.logActivity(
          {
            listId: lockedRule.listId,
            actorId: userId,
            action: "RECURRING_OCCURRENCE_GENERATED",
            entityType: "TODO",
            entityId: nextTodo.id,
            metadata: {
              ruleId: lockedRule.id,
              occurrenceNumber: nextOccurrenceNumber,
              dueDate: occurrenceDueDate,
              title: nextTodo.title,
              catchUp: true,
            },
          },
          tx
        );

        generatedCount++;
      });
    }

    return { generatedCount };
  }

  /**
   * Background processor for due recurrences (called by cron).
   */
  async processDueRecurrences(): Promise<{ processed: number }> {
    const today = new Date().toISOString().slice(0, 10);
    const dueRules = await this.recurrenceRepo.findDueActiveRules(today);
    let processed = 0;

    for (const rule of dueRules) {
      // Check if an uncompleted occurrence exists
      const activeOccurrence = await this.todoRepo.findActiveOccurrenceByRuleId(
        rule.id
      );
      if (activeOccurrence) {
        continue;
      }

      await withTransaction(this.db, async (tx) => {
        const lockedRule = await this.recurrenceRepo.findByIdForUpdate(rule.id, tx);
        if (!lockedRule || lockedRule.status !== "ACTIVE" || !lockedRule.nextDueDate) {
          return;
        }

        const nextOccurrenceNumber = lockedRule.lastGeneratedOccurrenceNumber + 1;
        const occurrenceDueDate = lockedRule.nextDueDate;

        const nextTodo = await this.todoRepo.create(
          {
            listId: lockedRule.listId,
            title: lockedRule.baseTitle,
            description: lockedRule.baseDescription,
            priority: lockedRule.basePriority,
            status: "TODO",
            dueDate: occurrenceDueDate,
            recurrenceRuleId: lockedRule.id,
            occurrenceNumber: nextOccurrenceNumber,
          },
          tx
        );

        const tagIds: string[] = lockedRule.baseTagIds ?? [];
        if (tagIds.length > 0) {
          await this.tagRepo.assignTagsToTodo(nextTodo.id, tagIds, tx);
        }

        const nextNextDueDate = calculateNextOccurrence(
          {
            frequency: lockedRule.frequency,
            interval: lockedRule.interval,
            daysOfWeek: lockedRule.daysOfWeek,
            anchorDayOfMonth: lockedRule.anchorDayOfMonth,
            anchorMonthOfYear: lockedRule.anchorMonthOfYear,
            startDate: lockedRule.startDate,
            endDate: lockedRule.endDate,
            maxOccurrences: lockedRule.maxOccurrences,
          },
          occurrenceDueDate,
          nextOccurrenceNumber
        );

        const isCompleted =
          (lockedRule.maxOccurrences !== null &&
            lockedRule.occurrencesGenerated + 1 >= lockedRule.maxOccurrences) ||
          (lockedRule.endDate !== null &&
            nextNextDueDate !== null &&
            nextNextDueDate > lockedRule.endDate) ||
          !nextNextDueDate;

        await this.recurrenceRepo.updateRule(
          lockedRule.id,
          {
            occurrencesGenerated: lockedRule.occurrencesGenerated + 1,
            lastGeneratedOccurrenceNumber: nextOccurrenceNumber,
            nextDueDate: isCompleted ? null : nextNextDueDate,
            status: isCompleted ? "COMPLETED" : "ACTIVE",
            updatedAt: new Date(),
          },
          tx
        );

        await this.activityService.logActivity(
          {
            listId: lockedRule.listId,
            actorId: null,
            action: "RECURRING_OCCURRENCE_GENERATED",
            entityType: "TODO",
            entityId: nextTodo.id,
            metadata: {
              ruleId: lockedRule.id,
              occurrenceNumber: nextOccurrenceNumber,
              dueDate: occurrenceDueDate,
              title: nextTodo.title,
              cron: true,
            },
          },
          tx
        );

        processed++;
      });
    }

    return { processed };
  }
}

export const recurrenceService = new RecurrenceService();
