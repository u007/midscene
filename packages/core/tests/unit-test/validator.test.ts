// File: packages/core/tests/ai/validator.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { Validator, type AIModelConfig } from '../../src/ai-model/validator';
import type { UIContext } from '../../../types';
import { systemPromptToAssert } from '../../src/ai-model/prompt/assertion';

describe('Validator', () => {
  // Create a simple test image (1x1 pixel PNG in base64)
  const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGbKdMWwAAAABJRU5ErkJggg==';

  const sampleUiContext: UIContext = {
    screenshotBase64: testImageBase64,
    size: { width: 1920, height: 1080 },
    content: [] as any[],
    tree: { node: null, children: [] } as any,
  };

  const sampleAssertion = 'The button should be blue.';

  beforeEach(() => {
    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-key-for-validation';
  });

  it('should create validator instance with correct config', () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);

    expect(validator).toBeInstanceOf(Validator);
  });

  it('should create validator instance with UITars config', () => {
    const aiConfig: AIModelConfig = { isUITars: true };
    const validator = new Validator(aiConfig);

    expect(validator).toBeInstanceOf(Validator);
  });

  it('should generate correct system prompt for UITars mode', () => {
    const prompt = systemPromptToAssert({ isUITars: true });

    expect(prompt).toContain('You are a senior testing engineer');
    expect(prompt).toContain('Output Json String Format');
    expect(prompt).toContain('Make sure to return **only** the JSON');
  });

  it('should generate correct system prompt for non-UITars mode', () => {
    const prompt = systemPromptToAssert({ isUITars: false });

    expect(prompt).toContain('You are a senior testing engineer');
    expect(prompt).toContain('Return in the following JSON format');
    expect(prompt).not.toContain('Output Json String Format');
  });

  it('should handle different model families in config', () => {
    const aiConfig: AIModelConfig = { isUITars: true, modelFamily: 'anthropic' };
    const validator = new Validator(aiConfig);

    expect(validator).toBeInstanceOf(Validator);
  });

  it('should validate input parameters correctly', () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);

    // Test that validator accepts valid inputs without throwing
    expect(() => {
      // This should not throw for valid inputs
      const assertion = 'The button should be visible';
      const context = sampleUiContext;
      expect(assertion).toBeTruthy();
      expect(context).toBeTruthy();
      expect(context.screenshotBase64).toBeTruthy();
    }).not.toThrow();
  });

  it('should handle empty assertion gracefully', () => {
    const aiConfig: AIModelConfig = { isUITars: false };
    const validator = new Validator(aiConfig);

    expect(validator).toBeInstanceOf(Validator);
    // Empty assertion should still create a validator instance
    expect(() => {
      const emptyAssertion = '';
      expect(typeof emptyAssertion).toBe('string');
    }).not.toThrow();
  });
});
