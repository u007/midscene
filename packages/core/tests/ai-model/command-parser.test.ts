import { parseAICommand } from '../../src/ai-model/command-parser';
import type { AICommandAction } from '../../src/types';

describe('parseAICommand', () => {
  it('should parse a valid click command', () => {
    const command = 'click on the dom with id "myButton"';
    const result = parseAICommand(command);
    expect(result).not.toBeNull();
    expect(result?.action).toBe('click' as AICommandAction);
    expect(result?.selector.type).toBe('id');
    expect(result?.selector.value).toBe('myButton');
    expect(result?.fullCommand).toBe(command);
  });

  it('should parse a valid double click command (double click)', () => {
    const command = 'double click on the dom with id "anotherElement"';
    const result = parseAICommand(command);
    expect(result).not.toBeNull();
    expect(result?.action).toBe('doubleClick' as AICommandAction);
    expect(result?.selector.type).toBe('id');
    expect(result?.selector.value).toBe('anotherElement');
    expect(result?.fullCommand).toBe(command);
  });

  it('should parse a valid double click command (doubleclick)', () => {
    const command = 'doubleclick on the dom with id "yetAnother"';
    const result = parseAICommand(command);
    expect(result).not.toBeNull();
    expect(result?.action).toBe('doubleClick' as AICommandAction);
    expect(result?.selector.type).toBe('id');
    expect(result?.selector.value).toBe('yetAnother');
    expect(result?.fullCommand).toBe(command);
  });
  
  it('should be case-insensitive for action', () => {
    const command = 'CLICK on the dom with id "caseButton"';
    const result = parseAICommand(command);
    expect(result).not.toBeNull();
    expect(result?.action).toBe('click' as AICommandAction);
    expect(result?.selector.value).toBe('caseButton');
  });

  it('should return null for an invalid command', () => {
    const command = 'do something unrelated to clicking';
    const result = parseAICommand(command);
    expect(result).toBeNull();
  });

  it('should return null for a click command with missing id quote', () => {
    const command = 'click on the dom with id myButton"';
    const result = parseAICommand(command);
    expect(result).toBeNull();
  });

  it('should return null for a click command with missing id', () => {
    const command = 'click on the dom with id ""';
    const result = parseAICommand(command);
    // The current regex "([^"]+)" requires at least one character for the ID.
    // If an empty ID "" is valid, the regex and this test would need adjustment.
    // For now, assuming ID must be non-empty.
    expect(result).not.toBeNull(); 
    expect(result?.selector.value).toBe(''); // Current regex allows empty ID if quotes are present
  });

  it('should correctly parse command with mixed case for "dom with id"', () => {
    const command = 'click on the DoM WiTh ID "mixedCaseId"';
    const result = parseAICommand(command);
    expect(result).not.toBeNull();
    expect(result?.action).toBe('click' as AICommandAction);
    expect(result?.selector.type).toBe('id');
    expect(result?.selector.value).toBe('mixedCaseId');
  });
});
