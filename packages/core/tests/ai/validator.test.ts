// File: packages/core/tests/ai/validator.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Validator, type AIModelConfig } from '../../src/ai-model/validator';
import type { UIContext } from '../../../types'; // Adjusted path
import type { AIArgs, AIUsageInfo } from '../../src/ai-model/common'; // AIArgs might be needed for more specific callAiFn checks
import { AIActionType } from '../../src/ai-model/common';

// Mock the entire modules
vi.mock('../../src/ai-model/common', async () => ({
  callAiFn: vi.fn(),
  AIActionType: (await vi.importActual('../../src/ai-model/common') as any).AIActionType,
  // Include other exports from common if Validator uses them directly and they are not functions
}));

vi.mock('../../src/ai-model/prompt/assertion', async () => ({
  systemPromptToAssert: vi.fn(),
  assertSchema: (await vi.importActual('../../src/ai-model/prompt/assertion') as any).assertSchema,
}));

// Now import the mocked functions
import { callAiFn } from '../../src/ai-model/common';
import { systemPromptToAssert } from '../../src/ai-model/prompt/assertion';

describe('Validator', () => {
  const mockCallAiFn = callAiFn as vi.MockedFunction<typeof callAiFn>;
  const mockSystemPromptToAssert = systemPromptToAssert as vi.MockedFunction<typeof systemPromptToAssert>;

  const sampleUiContext: UIContext = {
    screenshotBase64: 'sample-base64-string',
    size: { width: 1920, height: 1080 },
    // tree: { id: 'root', role: 'root', children: [], rect: { left: 0, top: 0, width: 1920, height: 1080}} as any,
    // focusedElementId: null,
    // Replacing with a minimal valid UIContext based on its abstract class nature
    content: [] as any[],
    tree: { node: null, children: [] } as any,
  };
  const sampleAssertion = 'The button should be blue.';
  const sampleUsage: AIUsageInfo = { total_tokens: 100, prompt_tokens: 50, completion_tokens: 50, Kosten: 0 } as any;


  beforeEach(() => {
    vi.resetAllMocks();
    mockSystemPromptToAssert.mockImplementation((config) => `System prompt (isUITars: ${config?.isUITars})`);
  });

  it('should return pass:true for successful validation', async () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);
    mockCallAiFn.mockResolvedValue({
      content: { pass: true, thought: null },
      usage: sampleUsage,
    });

    const result = await validator.validate(sampleAssertion, sampleUiContext);

    expect(result.pass).toBe(true);
    expect(result.thought).toBeNull();
    expect(result.usage).toEqual(sampleUsage);
    expect(mockCallAiFn).toHaveBeenCalledWith(
      expect.any(Array) as AIArgs,
      AIActionType.ASSERT
    );
  });

  it('should return pass:false with a thought for failed validation', async () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);
    const failureThought = 'The button is red.';
    mockCallAiFn.mockResolvedValue({
      content: { pass: false, thought: failureThought },
      usage: sampleUsage,
    });

    const result = await validator.validate(sampleAssertion, sampleUiContext);

    expect(result.pass).toBe(false);
    expect(result.thought).toBe(failureThought);
  });

  it('should call systemPromptToAssert with isUITars:true and use its output', async () => {
    const aiConfig: AIModelConfig = { isUITars: true };
    const validator = new Validator(aiConfig);
    const specificPrompt = 'System prompt for UI Tars';
    mockSystemPromptToAssert.mockReturnValue(specificPrompt);
    mockCallAiFn.mockResolvedValue({
      content: { pass: true, thought: null },
      usage: sampleUsage,
    });

    await validator.validate(sampleAssertion, sampleUiContext);

    expect(mockSystemPromptToAssert).toHaveBeenCalledWith({ isUITars: true });
    const messagesSentToAI = mockCallAiFn.mock.calls[0][0] as AIArgs;
    expect(messagesSentToAI[0].content).toBe(specificPrompt);
  });

  it('should call systemPromptToAssert with isUITars:false and use its output', async () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);
    const specificPrompt = 'System prompt for non-UI Tars';
    mockSystemPromptToAssert.mockReturnValue(specificPrompt); // Ensure this mock is effective
     mockCallAiFn.mockResolvedValue({
      content: { pass: true, thought: null },
      usage: sampleUsage,
    });

    await validator.validate(sampleAssertion, sampleUiContext);

    expect(mockSystemPromptToAssert).toHaveBeenCalledWith({ isUITars: false });
    const messagesSentToAI = mockCallAiFn.mock.calls[0][0] as AIArgs;
    // The default mock in beforeEach is `System prompt (isUITars: ${config.isUITars})`
    // So, if this specific mockReturnValue isn't taking precedence, it might fail.
    // Let's ensure the mockSystemPromptToAssert in this test is the one being used.
    expect(messagesSentToAI[0].content).toBe(specificPrompt);
  });

  it('should use aiModelConfig from constructor if provided', async () => {
    const aiConfig: AIModelConfig = { isUITars: true, modelFamily: 'anthropic' };
    const validator = new Validator(aiConfig);
    const specificPrompt = 'System prompt for UI Tars (anthropic family)';
    // Make this mock specific to override the beforeEach one for this test case
    mockSystemPromptToAssert.mockImplementation((conf) => conf.isUITars ? specificPrompt : "other prompt");
    mockCallAiFn.mockResolvedValue({ content: { pass: true, thought: null }, usage: sampleUsage });

    await validator.validate(sampleAssertion, sampleUiContext);
    expect(mockSystemPromptToAssert).toHaveBeenCalledWith({ isUITars: true });
    const messagesSentToAI = mockCallAiFn.mock.calls[0][0] as AIArgs;
    expect(messagesSentToAI[0].content).toBe(specificPrompt);
  });

  it('should propagate error if callAiFn throws', async () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);
    const errorMessage = 'AI service unavailable';
    mockCallAiFn.mockRejectedValue(new Error(errorMessage));

    await expect(validator.validate(sampleAssertion, sampleUiContext))
      .rejects
      .toThrow(errorMessage);
  });
});
