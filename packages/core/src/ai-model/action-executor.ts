import type {
  ExecutionDump,
  ExecutionTask,
  ExecutionTaskApply,
  ExecutionTaskInsightLocateOutput,
  ExecutionTaskProgressOptions,
  ExecutionTaskReturn,
  ExecutorContext,
  UIContext, // Added for type usage below
  ExecutionTaskInsightAssertionParam, // Added for type usage below
} from '@/types';
import { Validator, type AIModelConfig } from './validator'; // Added Validator and AIModelConfig
import { getVersion } from '@/utils';
import { MIDSCENE_MODEL_NAME, getAIConfig } from '@midscene/shared/env';
import { assert } from '@midscene/shared/utils';

export class Executor {
  name: string;

  tasks: ExecutionTask[];

  // status of executor
  status: 'init' | 'pending' | 'running' | 'completed' | 'error';

  onTaskStart?: ExecutionTaskProgressOptions['onTaskStart'];

  constructor(
    name: string,
    options?: ExecutionTaskProgressOptions & {
      tasks?: ExecutionTaskApply[];
    },
  ) {
    this.status =
      options?.tasks && options.tasks.length > 0 ? 'pending' : 'init';
    this.name = name;
    this.tasks = (options?.tasks || []).map((item) =>
      this.markTaskAsPending(item),
    );
    this.onTaskStart = options?.onTaskStart;
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

  /**
   * Processes and executes all pending tasks in the executor's queue.
   * Tasks are executed sequentially. If a task fails, subsequent tasks are marked as 'cancelled'.
   *
   * - For 'Insight' tasks with `subType: 'Assert'`, it utilizes an internal `Validator` instance.
   *   The `param` for these tasks should conform to `ExecutionTaskInsightAssertionParam`,
   *   providing an `assertion` string and the `uiContext`. The `Validator` then
   *   evaluates this assertion using an AI model. The result (pass/fail and AI's thoughts)
   *   is stored in the task's `output` field.
   *
   * - Other 'Insight' tasks (e.g., 'Locate', 'Query') and 'Action' or 'Planning' tasks
   *   are handled by their respective `executor` functions defined in the task itself.
   *
   * @returns A Promise that resolves with the output of the last executed task,
   *          or undefined if no tasks were pending.
   */
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
        const executorContext: ExecutorContext = {
          task,
          element: previousFindOutput?.element,
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

          if (task.subType === 'Assert') {
            // TODO: Make AIModelConfig for Validator configurable (e.g., from global settings or Executor constructor)
            const defaultValidatorConfig: AIModelConfig = { isUITars: false, modelFamily: 'openai' };
            const validator = new Validator(task.param?.aiModelConfig || defaultValidatorConfig);

            const assertParams = param as ExecutionTaskInsightAssertionParam;

            if (!assertParams.assertion || !assertParams.uiContext) {
              throw new Error('Assert task requires "assertion" and "uiContext" in params');
            }

            const validationResult = await validator.validate(assertParams.assertion, assertParams.uiContext);
            returnValue = { // Conforms to ExecutionTaskReturn structure
              output: {
                pass: validationResult.pass,
                thought: validationResult.thought
              },
              // Pass usage info if available, sum up aiCost if multiple AI calls in future
              usage: validationResult.usage,
            };
            // The task status will be 'finished'. The 'pass' field in output indicates success/failure of assertion.
          } else {
            // Existing logic for other insight subtypes (Locate, Query, etc.)
            returnValue = await task.executor(param, executorContext);
            if (task.subType === 'Locate') {
              previousFindOutput = (
                returnValue as ExecutionTaskReturn<ExecutionTaskInsightLocateOutput>
              )?.output;
            }
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
