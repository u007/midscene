# Technical Overview

This document provides a high-level overview of the project structure and the general workflow of how AI tasks are processed.

## Project Structure

The project is divided into the following main packages:

*   **`core`**: This package contains the core logic for AI task processing. It is responsible for interacting with the AI models, managing prompts, and handling the results.
*   **`mcp`**: This package acts as a control plane, orchestrating the flow of tasks between different components. It handles task queuing, prioritization, and routing to the appropriate core services.
*   **`web-integration`**: This package provides the web interface for interacting with the system. It allows users to submit tasks, view results, and manage their accounts. It communicates with the `mcp` to send tasks and receive updates.
*   **`chrome-extension`**: This package provides a Chrome browser extension that allows users to interact with the system directly from their browser. It communicates with the `web-integration` package to send tasks and display results.

### Package Interactions

The packages interact in the following way:

1.  The `chrome-extension` or `web-integration` package sends a task request to the `mcp`.
2.  The `mcp` queues the task and routes it to the appropriate `core` service.
3.  The `core` service processes the task by interacting with the AI models.
4.  The `core` service sends the results back to the `mcp`.
5.  The `mcp` sends the results back to the `chrome-extension` or `web-integration` package, which displays them to the user.

## AI Task Processing Workflow

The general workflow of how AI tasks are processed is as follows:

1.  **Task Submission**: A user submits an AI task through the `web-integration` or `chrome-extension`.
2.  **Task Queuing**: The `mcp` receives the task and adds it to a queue.
3.  **Task Prioritization**: The `mcp` prioritizes the tasks in the queue based on factors such as user subscription level and task complexity.
4.  **Task Routing**: The `mcp` routes the task to the appropriate `core` service based on the task type and resource availability.
5.  **Prompt Engineering**: The `core` service generates a prompt for the AI model based on the task requirements.
6.  **AI Model Interaction**: The `core` service sends the prompt to the AI model and receives the response.
7.  **Result Processing**: The `core` service processes the AI model's response and extracts the relevant information.
8.  **Result Storage**: The `core` service stores the results in a database.
9.  **Result Delivery**: The `mcp` sends the results back to the `web-integration` or `chrome-extension`, which displays them to the user.

## AI Command Processing

This feature enables the AI to interpret and execute specific browser interaction commands expressed in natural language. For example, the AI can be instructed to "click on the dom with id 'submitButton'".

### Command Parsing

*   **Parser Location**: The core parsing logic resides in `packages/core/src/ai-model/command-parser.ts`.
*   **Mechanism**: This parser utilizes regular expressions to transform natural language commands into a structured `AICommand` object. The definition for `AICommand` (along with related types like `AICommandAction` and `AICommandSelector`) can be found in `packages/core/src/types.ts`.
*   **Current Capabilities**: The parser currently supports:
    *   Actions: `click`, `doubleClick` (including variations like "double click").
    *   Selectors: Targeting elements by their `id`.

### Execution Flow

1.  **Entry Point**: The `packages/core/src/ai-model/action-executor.ts` file's `Executor` class now features a new public method: `executeAICommand(naturalLanguageCommand: string)`.
2.  **Task Creation**: Upon receiving a natural language command, `executeAICommand` first calls the `parseAICommand` function.
    *   If parsing is successful, it creates an `ExecutionTaskApply` object with the `type` set to 'Action'.
    *   The `subType` of this task is dynamically set to 'AIClick' or 'AIDoubleClick' based on the parsed action.
3.  **Contextual Page Object**:
    *   The `Executor` class constructor is now initialized with a `Page` object instance (an abstraction over the actual browser page, typically from `packages/web-integration`).
    *   When the `Executor` processes its task queue (within the `flush` method), the `ExecutorContext` provided to each task's executor function is populated with this `Page` object (as `context.page`).
4.  **Task Execution**:
    *   The specific executor function defined for 'AIClick' and 'AIDoubleClick' tasks (within `executeAICommand`) then utilizes the `Page` object from the context.
    *   It calls `context.page.clickById(selectorValue)` or `context.page.doubleClickById(selectorValue)` based on the parsed command.

### Browser Interaction

*   **Implementation**: The low-level browser interaction methods, `clickById(id: string)` and `doubleClickById(id: string)`, are implemented in the `Page` class located at `packages/web-integration/src/puppeteer/base-page.ts`.
*   **Driver Usage**: These methods internally use the capabilities of the underlying browser automation drivers (e.g., Playwright or Puppeteer) to find the element by its ID and dispatch the appropriate click or double-click event.

### Extensibility

The AI command processing framework is designed with extensibility in mind:
*   The `command-parser.ts` can be enhanced with more sophisticated parsing techniques (e.g., NLP libraries) and new regular expressions to understand a wider variety of commands and selector types (e.g., CSS selectors, XPath, text content).
*   New actions beyond click/doubleClick can be added by defining new `AICommandAction` types, corresponding task subtypes, and implementing their respective executor logic and browser interaction methods.
