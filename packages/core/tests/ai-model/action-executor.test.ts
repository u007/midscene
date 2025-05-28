import { Executor } from '../../src/ai-model/action-executor';
import type { AbstractPage, AICommandAction, ExecutionTask } from '../../src/types';

// Mock the AbstractPage
const mockPage: jest.Mocked<AbstractPage> = {
  // Mock all abstract methods and any methods we'll use (clickById, doubleClickById)
  pageType: 'test-page',
  getElementsInfo: jest.fn(),
  getElementsNodeTree: jest.fn(),
  url: jest.fn(),
  screenshotBase64: jest.fn(),
  size: jest.fn(),
  mouse: {
    click: jest.fn(),
    wheel: jest.fn(),
    move: jest.fn(),
    drag: jest.fn(),
  } as any, // Use 'as any' if types are complex or partial mocking is fine
  keyboard: {
    type: jest.fn(),
    press: jest.fn(),
  } as any,
  clearInput: jest.fn(),
  scrollUntilTop: jest.fn(),
  scrollUntilBottom: jest.fn(),
  scrollUntilLeft: jest.fn(),
  scrollUntilRight: jest.fn(),
  scrollUp: jest.fn(),
  scrollDown: jest.fn(),
  scrollLeft: jest.fn(),
  scrollRight: jest.fn(),
  _forceUsePageContext: jest.fn(),
  waitUntilNetworkIdle: jest.fn(),
  destroy: jest.fn(),
  evaluateJavaScript: jest.fn(),
  // Add our specific methods
  clickById: jest.fn(),
  doubleClickById: jest.fn(),
};

describe('Executor - executeAICommand', () => {
  let executor: Executor;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Create a new executor instance for each test, providing the mocked page
    executor = new Executor('test-executor', { page: mockPage });
  });

  it('should parse and execute a valid "click by id" command', async () => {
    const command = 'click on the dom with id "testButton"';
    mockPage.clickById.mockResolvedValue(Promise.resolve()); // Mock successful click

    await executor.executeAICommand(command);

    expect(mockPage.clickById).toHaveBeenCalledTimes(1);
    expect(mockPage.clickById).toHaveBeenCalledWith('testButton');
    expect(executor.tasks.length).toBe(1);
    const task = executor.tasks[0];
    expect(task.type).toBe('Action');
    expect(task.subType).toBe('AIClick');
    expect(task.param.selector.value).toBe('testButton');
    expect(task.status).toBe('finished');
  });

  it('should parse and execute a valid "double click by id" command', async () => {
    const command = 'double click on the dom with id "doubleTestBtn"';
    mockPage.doubleClickById.mockResolvedValue(Promise.resolve()); // Mock successful double click

    await executor.executeAICommand(command);

    expect(mockPage.doubleClickById).toHaveBeenCalledTimes(1);
    expect(mockPage.doubleClickById).toHaveBeenCalledWith('doubleTestBtn');
    expect(executor.tasks.length).toBe(1);
    const task = executor.tasks[0];
    expect(task.type).toBe('Action');
    expect(task.subType).toBe('AIDoubleClick');
    expect(task.param.selector.value).toBe('doubleTestBtn');
    expect(task.status).toBe('finished');
  });

  it('should handle parsing failure for an invalid command', async () => {
    const command = 'invalid command here';
    // executeAICommand logs an error and returns if parsing fails, does not throw by default
    await executor.executeAICommand(command);
    
    expect(mockPage.clickById).not.toHaveBeenCalled();
    expect(mockPage.doubleClickById).not.toHaveBeenCalled();
    expect(executor.tasks.length).toBe(0); // No task should be added
  });

  it('should throw an error if page is not available in context (though constructor now ensures it)', async () => {
    // This test is more about ensuring the check inside the task's executor works,
    // even though our current Executor constructor setup makes this unlikely.
    const command = 'click on the dom with id "button"';
    executor = new Executor('test-executor-no-page', { page: undefined }); // Create executor without page

    // We expect the flush operation within executeAICommand to throw
    await expect(executor.executeAICommand(command))
      .rejects
      .toThrow('Page object not available in ExecutorContext for AI command execution.');
    
    // Ensure no tasks were successfully processed if the page was missing.
    // The task might be added but should fail during execution.
    if (executor.tasks.length > 0) {
        expect(executor.tasks[0].status).toBe('failed');
    }
  });

  it('should throw an error for unsupported selector type', async () => {
    // This requires a way to inject a parsed command with a different selector type
    // For now, we assume parseAICommand only produces 'id' selectors.
    // If parseAICommand were extended, this test would be more relevant.
    // We can simulate this by manually adding a task with a different selector.
    
    const badTask: ExecutionTask = {
        type: 'Action',
        subType: 'AIClick',
        param: { selector: { type: 'css', value: '.button' }, fullCommand: 'click .button' },
        status: 'pending',
        executor: async (param, context) => {
            if (!context.page) throw new Error("No page");
            if (param.selector.type !== 'id') throw new Error('Unsupported selector type: css');
            // ...
        }
    } as ExecutionTask; // Cast to ExecutionTask to satisfy stricter type checking if param is not perfectly matching
    (executor as any).tasks = [badTask]; // Manually insert a pre-parsed-like task

    await expect(executor.flush())
        .rejects
        .toThrow('Unsupported selector type: "css". Only "id" is supported for AI commands.');
    expect(executor.tasks[0].status).toBe('failed');
  });
});
