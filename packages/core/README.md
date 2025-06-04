## Documentation

Automate browser actions, extract data, and perform assertions using AI. It offers JavaScript SDK, Chrome extension, and support for scripting in YAML.

See https://midscenejs.com/ for details.

## AI-Powered Validation

The `@midscene/core` package includes a powerful AI-driven validation mechanism through its `Executor` and `Validator` modules. This allows you to perform assertions on your UI based on natural language statements.

### How it Works

When you add an `Assert` task to the `Executor`, it leverages the `Validator` class to evaluate your assertion. The `Validator` sends the assertion statement, along with the current UI context (including a screenshot and element tree), to an AI model. The model then determines if the assertion holds true.

### `Assert` Task Parameters

To use an AI assertion, you define an `Insight` task with `subType: 'Assert'`. The `param` field for such a task should include:

*   `assertion: string`: The natural language statement to validate (e.g., "The main login button should be clearly visible and blue.").
*   `uiContext: UIContext`: An object representing the current state of the UI. This is typically captured by the automation agent (e.g., Puppeteer, Playwright) at the point of assertion.
*   `aiModelConfig?: AIModelConfig`: (Optional) You can provide specific AI model configuration for this assertion, overriding any global settings. This allows fine-tuning behavior, such as specifying `isUITars: true` if you're using a UI Tars compatible model.

### Interpreting the Output

The result of an `Assert` task is stored in its `output` field and will contain:

*   `pass: boolean`: `true` if the assertion is validated by the AI, `false` otherwise.
*   `thought: string | null`: The AI's reasoning or explanation for its validation result. This is particularly useful for understanding why an assertion failed.
*   `usage?: AIUsageInfo`: Optional information about the AI call, like token counts.

### Example: Programmatic Assertion

Here's a conceptual example of how you might add an AI assertion task when using the `Executor` programmatically:

```typescript
import { Executor, UIContext, AIModelConfig } from '@midscene/core'; // Assuming UIContext and AIModelConfig are exported

// Assume 'executor' is an instance of Executor
// Assume 'currentUIContext' is a UIContext object captured from your UI automation tool

const assertionTask = {
  type: 'Insight' as 'Insight',
  subType: 'Assert' as 'Assert',
  param: {
    assertion: "The shopping cart icon must display a count of '2' items.",
    uiContext: currentUIContext, // This needs to be a valid UIContext object
    aiModelConfig: { isUITars: false } // Optional configuration
  },
  executor: async (param: any, context: any) => {
    // For Assert tasks handled directly by Executor.flush's Validator integration,
    // this executor function might not be directly called if the logic is fully in flush.
    // However, it's good practice to have it for consistency or if direct execution is needed.
    // The actual validation logic is now primarily within Executor.flush for Assert tasks.
    // This function could be simplified or even serve as a fallback if needed.
    // console.log('Executing assertion task (param will be handled by Validator in flush):', param);
    // return Promise.resolve({ output: { pass: false, thought: "Placeholder if executor called directly" } });
  }
};

await executor.append(assertionTask);
const lastResult = await executor.flush();

if (lastResult && typeof lastResult.pass === 'boolean') {
  console.log(`Assertion passed: ${lastResult.pass}, Thought: ${lastResult.thought}`);
}
```
*(Note: The `executor` function within the task definition for `Assert` tasks is shown for structural consistency, but the primary execution logic for these tasks is now handled directly within `Executor.flush` using the `Validator`.)*

For details on configuring the underlying AI models (e.g., OpenAI, Anthropic), please refer to the model provider documentation relevant to your setup.

## License

Midscene is MIT licensed.