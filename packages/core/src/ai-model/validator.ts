import type { UIContext, AIUsageInfo } from '@/types';
import { callAiFn, AIActionType, AIArgs } from './common';
import { systemPromptToAssert } from './prompt/assertion';

/**
 * Configuration for the AI model used by the Validator.
 * Allows for customization of model behavior and prompt generation.
 */
export interface AIModelConfig {
  /**
   * Specific flag to indicate if the model is a UI Tars model,
   * which might influence prompt construction (e.g., for `systemPromptToAssert`).
   * @default false
   */
  isUITars?: boolean;
  /**
   * Specifies the family of the AI model (e.g., 'openai', 'anthropic', 'google').
   * This can be used internally to adjust logic or prompts if different model families
   * have different capabilities or optimal prompt structures.
   */
  modelFamily?: 'openai' | 'anthropic' | 'google' | 'other';
  /**
   * Provides a way to override parts of the default prompts used by the Validator.
   * This is for advanced customization.
   */
  customPromptOverrides?: {
    /**
     * A complete override for the system prompt used in assertions.
     */
    systemPrompt?: string;
  };
  // Add other relevant fields for validator customization as they become clear
}

/**
 * Represents the result of a validation performed by the Validator.
 */
export interface ValidationResult {
  /**
   * Indicates whether the assertion passed (true) or failed (false).
   */
  pass: boolean;
  /**
   * Contains the reasoning or thoughts from the AI model regarding the assertion.
   * This is especially useful when an assertion fails, providing context or explanation.
   * Can be null if the AI provides no specific thought (e.g., for a passing assertion).
   */
  thought: string | null;
  /**
   * Optional usage information for the AI call, such as token counts.
   */
  usage?: AIUsageInfo;
}

/**
 * The Validator class uses an AI model to perform assertions on a given UI context.
 * It takes an assertion statement (e.g., "The button should be blue") and a UI context
 * (including a screenshot) and returns whether the assertion holds true, along with
 * any reasoning from the AI.
 */
export class Validator {
  private aiModelConfig: AIModelConfig;

  /**
   * Constructs a new Validator instance.
   * @param aiModelConfig Configuration for the AI model to be used for validation.
   *                      This allows specifying model-specific behaviors, like `isUITars`.
   */
  constructor(aiModelConfig: AIModelConfig) {
    this.aiModelConfig = aiModelConfig;
  }

  /**
   * Validates a given assertion against the provided UI context using an AI model.
   *
   * @param assertion The natural language assertion to validate (e.g., "The login button is visible").
   * @param context The UI context (including screenshot, element tree, and size) against which to validate.
   * @returns A Promise that resolves to a `ValidationResult`, indicating whether the assertion
   *          passed or failed, along with the AI's thoughts and usage information.
   */
  async validate(
    assertion: string,
    context: UIContext,
  ): Promise<ValidationResult> {
    const { screenshotBase64, size, tree } = context;

    // TODO: Determine if image needs markup like in llm-planning.ts
    // For now, assume raw screenshotBase64 is fine for assertion.
    // const imagePayload = await markupImageForLLM(screenshotBase64, tree, size);
    const imagePayload = screenshotBase64;


    const systemPrompt = systemPromptToAssert({ isUITars: !!this.aiModelConfig.isUITars });

    const userMessageContent = [
      {
        type: 'image_url',
        image_url: {
          url: imagePayload,
          detail: 'high',
        },
      },
      {
        type: 'text',
        text: assertion, // The user's assertion
      },
    ];

    // @ts-ignore AIArgs is already imported, this might be due to complex type inference issues with ChatCompletionMessageParam
    const msgs: AIArgs = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessageContent },
    ];

    const { content, usage } = await callAiFn<{pass: boolean; thought: string | null;}>(
        msgs,
        AIActionType.ASSERT
        // TODO: Potentially pass model selection details from this.aiModelConfig here
        // e.g., { ...this.aiModelConfig } if callAiFn supports it
    );

    return {
      pass: content.pass,
      thought: content.thought,
      usage,
    };
  }
}
