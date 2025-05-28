import type {
  ExecutionDump,
  ExecutionTask,
  ExecutionTaskApply,
  ExecutionTaskInsightLocateOutput,
  ExecutionTaskProgressOptions,
  ExecutionTaskReturn,
  ExecutorContext,
  AICommand,
  AICommandSelector,
  AbstractPage, // Ensured AbstractPage is imported
} from '@/types';
import { getVersion } from '@/utils';
import { MIDSCENE_MODEL_NAME, getAIConfig } from '@midscene/shared/env';
import { parseAICommand } from './command-parser';
// WebElementInfo is no longer needed with the new executor logic.
import { assert } from '@midscene/shared/utils';

export class Executor {
  name: string;

  tasks: ExecutionTask[];

  // status of executor
  status: 'init' | 'pending' | 'running' | 'completed' | 'error';

  onTaskStart?: ExecutionTaskProgressOptions['onTaskStart'];
  page?: AbstractPage; // Ensured page property is present

  constructor(
    name: string,
    options?: ExecutionTaskProgressOptions & {
      tasks?: ExecutionTaskApply[];
      page?: AbstractPage; // Ensured page is in options
    },
  ) {
    this.status =
      options?.tasks && options.tasks.length > 0 ? 'pending' : 'init';
    this.name = name;
    this.tasks = (options?.tasks || []).map((item) =>
      this.markTaskAsPending(item),
    );
    this.onTaskStart = options?.onTaskStart;
    this.page = options?.page; // Ensured page is assigned
  }

  private markTaskAsPending(task: ExecutionTaskApply): ExecutionTask {
    return {
      status: 'pending',
      ...task,
    };
  }

  async append(task: ExecutionTaskApply[] | ExecutionTaskApply): Promise<void> {
    assert(
      this.status !== 'error',
      `executor is in error state, cannot append task\nerror=${this.latestErrorTask()?.error}\n${this.latestErrorTask()?.errorStack}`,
    );
    if (Array.isArray(task)) {
      this.tasks.push(...task.map((item) => this.markTaskAsPending(item)));
    } else {
      this.tasks.push(this.markTaskAsPending(task));
    }
    if (this.status !== 'running') {
      this.status = 'pending';
    }
  }

  async flush(): Promise<any> {
    if (this.status === 'init' && this.tasks.length > 0) {
      console.warn(
        'illegal state for executor, status is init but tasks are not empty',
      );
    }

    assert(this.status !== 'running', 'executor is already running');
    assert(this.status !== 'completed', 'executor is already completed');
    assert(this.status !== 'error', 'executor is in error state');

    const nextPendingIndex = this.tasks.findIndex(
      (task) => task.status === 'pending',
    );
    if (nextPendingIndex < 0) {
      // all tasks are completed
      return;
    }

    this.status = 'running';
    let taskIndex = nextPendingIndex;
    let successfullyCompleted = true;

    let previousFindOutput: ExecutionTaskInsightLocateOutput | undefined;

    while (taskIndex < this.tasks.length) {
      const task = this.tasks[taskIndex];
      assert(
        task.status === 'pending',
        `task status should be pending, but got: ${task.status}`,
      );
      task.timing = {
        start: Date.now(),
      };
      try {
        task.status = 'running';
        try {
          if (this.onTaskStart) {
            await this.onTaskStart(task);
          }
        } catch (e) {
          console.error('error in onTaskStart', e);
        }
        assert(
          ['Insight', 'Action', 'Planning'].indexOf(task.type) >= 0,
          `unsupported task type: ${task.type}`,
        );

        const { executor, param } = task;
        assert(executor, `executor is required for task type: ${task.type}`);

        let returnValue;
        const executorContext: ExecutorContext = { // Ensured context creation includes page
          task,
          element: previousFindOutput?.element,
          page: this.page, 
        };

        if (task.type === 'Insight') {
          assert(
            task.subType === 'Locate' ||
              task.subType === 'Query' ||
              task.subType === 'Assert' ||
              task.subType === 'Boolean' ||
              task.subType === 'Number' ||
              task.subType === 'String',
            `unsupported insight subType: ${task.subType}`,
          );
          returnValue = await task.executor(param, executorContext);
          if (task.subType === 'Locate') {
            previousFindOutput = (
              returnValue as ExecutionTaskReturn<ExecutionTaskInsightLocateOutput>
            )?.output;
          }
        } else if (task.type === 'Action' || task.type === 'Planning') {
          returnValue = await task.executor(param, executorContext);
        } else {
          console.warn(
            `unsupported task type: ${task.type}, will try to execute it directly`,
          );
          returnValue = await task.executor(param, executorContext);
        }

        Object.assign(task, returnValue);
        task.status = 'finished';
        task.timing.end = Date.now();
        task.timing.cost = task.timing.end - task.timing.start;
        task.timing.aiCost = (returnValue as any)?.aiCost || 0;
        taskIndex++;
      } catch (e: any) {
        successfullyCompleted = false;
        task.error =
          e?.message || (typeof e === 'string' ? e : 'error-without-message');
        task.errorStack = e.stack;

        task.status = 'failed';
        task.timing.end = Date.now();
        task.timing.cost = task.timing.end - task.timing.start;
        break;
      }
      taskIndex++; 
    }

    // set all remaining tasks as cancelled
    for (let i = taskIndex + 1; i < this.tasks.length; i++) {
      this.tasks[i].status = 'cancelled';
    }

    if (successfullyCompleted) {
      this.status = 'completed';
    } else {
      this.status = 'error';
    }

    if (this.tasks.length) {
      // return the last output
      const outputIndex = Math.min(taskIndex, this.tasks.length - 1);
      return this.tasks[outputIndex].output;
    }
  }

  isInErrorState(): boolean {
    return this.status === 'error';
  }

  latestErrorTask(): ExecutionTask | null {
    if (this.status !== 'error') {
      return null;
    }
    const errorTaskIndex = this.tasks.findIndex(
      (task) => task.status === 'failed',
    );
    if (errorTaskIndex >= 0) {
      return this.tasks[errorTaskIndex];
    }
    return null;
  }

  async executeAICommand(naturalLanguageCommand: string): Promise<any> {
    const command = parseAICommand(naturalLanguageCommand);

    if (!command) {
      console.error(`Failed to parse AI command: "${naturalLanguageCommand}"`);
      // Or throw new Error(`Failed to parse AI command: "${naturalLanguageCommand}"`);
      return;
    }

    const task: ExecutionTaskApply = {
      type: 'Action',
      subType: command.action === 'click' ? 'AIClick' : 'AIDoubleClick',
      param: { selector: command.selector, fullCommand: command.fullCommand },
      thought: `Executing AI Command: ${command.fullCommand}`,
      executor: async (
        param: { selector: AICommandSelector; fullCommand: string },
        context: ExecutorContext, // context.page is now available
      ) => {
        if (!context.page) {
          throw new Error("Page object not available in ExecutorContext for AI command execution.");
        }

        if (param.selector.type !== 'id') {
          throw new Error(`Unsupported selector type: "${param.selector.type}". Only "id" is supported for AI commands.`);
        }

        // context.task should be available to determine the subType
        if (!context.task || !context.task.subType) {
            throw new Error("Task subtype not available in context for AI command execution.");
        }

        const actionSubType = context.task.subType;

        if (actionSubType === 'AIClick') {
          await context.page.clickById(param.selector.value);
          return { 
            output: { 
              success: true, 
              message: `Clicked element with ID: ${param.selector.value}` 
            } 
          };
        } else if (actionSubType === 'AIDoubleClick') {
          await context.page.doubleClickById(param.selector.value);
          return { 
            output: { 
              success: true, 
              message: `Double-clicked element with ID: ${param.selector.value}` 
            } 
          };
        } else {
          throw new Error(`Unsupported AI command action subType: "${actionSubType}"`);
        }
      },
    };

    await this.append(task);
    return this.flush(); // Execute immediately
  }

  dump(): ExecutionDump {
    const dumpData: ExecutionDump = {
      sdkVersion: getVersion(),
      model_name: getAIConfig(MIDSCENE_MODEL_NAME) || '',
      logTime: Date.now(),
      name: this.name,
      tasks: this.tasks,
    };
    return dumpData;
  }
}
  // No changes needed for executeAICommand, it will receive the context with page automatically
  // ... (other methods like executeAICommand, dump) ...
}
