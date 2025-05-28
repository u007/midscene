import type { AICommand, AICommandAction, AICommandSelectorType } from '@/types';

export function parseAICommand(command: string): AICommand | null {
  const clickByIdRegex = /^(click|doubleclick|double click) on the dom with id "([^"]+)"$/i;
  const match = command.match(clickByIdRegex);

  if (match) {
    let action = match[1].toLowerCase().replace(' ', '') as AICommandAction;
    // Normalize 'doubleclick' to 'doubleClick' to match AICommandAction
    if (action === 'doubleclick') {
        action = 'doubleClick';
    }
    
    const selectorValue = match[2];

    if ((action === 'click' || action === 'doubleClick') && selectorValue) {
      return {
        action: action,
        selector: {
          type: 'id' as AICommandSelectorType, // For now, only ID selectors
          value: selectorValue,
        },
        fullCommand: command,
      };
    }
  }

  console.warn(`Failed to parse command: "${command}"`);
  return null;
}

// Example Usage (optional, for testing purposes):
// const cmd1 = 'click on the dom with id "myButton"';
// const parsedCmd1 = parseAICommand(cmd1);
// console.log(parsedCmd1);
//
// const cmd2 = 'double click on the dom with id "anotherElement"';
// const parsedCmd2 = parseAICommand(cmd2);
// console.log(parsedCmd2);
//
// const cmdInvalid = 'do something else';
// const parsedCmdInvalid = parseAICommand(cmdInvalid);
// console.log(parsedCmdInvalid);
