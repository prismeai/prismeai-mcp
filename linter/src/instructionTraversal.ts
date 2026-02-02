type InstructionVisitor = (instruction: Record<string, unknown>, path: string) => void;

/**
 * Traverses all instructions in an automation, including nested blocks.
 */
export function traverseInstructions(
  automation: { do?: unknown[] },
  visitor: InstructionVisitor
): void {
  if (!automation.do || !Array.isArray(automation.do)) return;

  function visit(instructions: unknown[], basePath: string) {
    instructions.forEach((instruction, index) => {
      if (!instruction || typeof instruction !== 'object') return;
      const path = `${basePath}[${index}]`;
      visitor(instruction as Record<string, unknown>, path);

      const inst = instruction as Record<string, unknown>;

      // Handle conditions block
      if (inst.conditions && typeof inst.conditions === 'object') {
        const conditions = inst.conditions as Record<string, unknown[]>;
        Object.entries(conditions).forEach(([key, block]) => {
          if (Array.isArray(block)) {
            visit(block, `${path}.conditions.${key}`);
          }
        });
      }

      // Handle repeat block
      if (inst.repeat && typeof inst.repeat === 'object') {
        const repeat = inst.repeat as Record<string, unknown>;
        if (Array.isArray(repeat.do)) {
          visit(repeat.do, `${path}.repeat.do`);
        }
      }

      // Handle all block (parallel execution)
      if (inst.all && Array.isArray(inst.all)) {
        visit(inst.all, `${path}.all`);
      }

      // Handle try/catch/finally blocks
      if (inst.try && typeof inst.try === 'object') {
        const tryBlock = inst.try as Record<string, unknown>;
        if (Array.isArray(tryBlock.do)) {
          visit(tryBlock.do, `${path}.try.do`);
        }
        if (Array.isArray(tryBlock.catch)) {
          visit(tryBlock.catch, `${path}.try.catch`);
        }
        if (Array.isArray(tryBlock.finally)) {
          visit(tryBlock.finally, `${path}.try.finally`);
        }
      }
    });
  }

  visit(automation.do, '/do');
}
