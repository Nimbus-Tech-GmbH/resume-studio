import { createMCPClient } from '@ai-sdk/mcp';
import { AiError } from './errors';
import type { McpToolResult } from './types';

export const JSON_RESUME_MCP_URL = 'https://jsonresume.org/mcp';

/** Read-only tools this app is allowed to call. */
export const APPROVED_MCP_TOOLS = ['validate_resume', 'get_resume_schema', 'check_ats'] as const;

export type ApprovedMcpTool = (typeof APPROVED_MCP_TOOLS)[number];

export interface McpToolRequest {
  tool: ApprovedMcpTool;
  args?: Record<string, unknown>;
  /** API key from jsonresume.org. Never persisted by this package. */
  accessToken?: string;
}

function isApprovedTool(tool: string): tool is ApprovedMcpTool {
  return (APPROVED_MCP_TOOLS as readonly string[]).includes(tool);
}

function normalizeMcpError(error: unknown): AiError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (/401|403|unauthoriz|authentication|forbidden|api key|token/i.test(lower)) {
    return new AiError(
      'MCP_UNAUTHORIZED',
      `jsonresume.org MCP rejected the request. Check the API key or authorization. ${message.slice(
        0,
        240,
      )}`,
      false,
    );
  }
  return new AiError(
    'MCP_UNAVAILABLE',
    `jsonresume.org MCP is unavailable. ${message.slice(0, 240)}`,
    true,
  );
}

/**
 * Call one approved read-only JSON Resume MCP tool. The caller must have
 * explicit user opt-in before invoking this function. The client is closed
 * after every call; no resume data is stored by the package.
 */
export async function runApprovedMcpTool(request: McpToolRequest): Promise<McpToolResult> {
  if (!isApprovedTool(request.tool)) {
    throw new AiError(
      'MCP_UNAVAILABLE',
      `MCP tool "${request.tool}" is not approved for this feature.`,
      false,
    );
  }

  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({
      name: 'resume-studio',
      version: '0.0.0',
      transport: {
        type: 'http',
        url: JSON_RESUME_MCP_URL,
        headers: request.accessToken
          ? { Authorization: `Bearer ${request.accessToken}` }
          : undefined,
      },
    });

    const tools = await client.tools();
    const tool = tools[request.tool] as
      | { execute?: (args: Record<string, unknown>) => Promise<unknown> }
      | undefined;
    if (!tool?.execute) {
      throw new AiError(
        'MCP_UNAVAILABLE',
        `MCP tool "${request.tool}" is not available on jsonresume.org.`,
        false,
      );
    }

    const content = await tool.execute(request.args ?? {});
    return { tool: request.tool, content };
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw normalizeMcpError(error);
  } finally {
    if (client) {
      await client.close().catch(() => undefined);
    }
  }
}

export function validateResumeWithMcp(
  resume: Record<string, unknown>,
  accessToken?: string,
): Promise<McpToolResult> {
  return runApprovedMcpTool({ tool: 'validate_resume', args: { resume }, accessToken });
}

export function checkAtsWithMcp(
  resume: Record<string, unknown>,
  accessToken?: string,
): Promise<McpToolResult> {
  return runApprovedMcpTool({ tool: 'check_ats', args: { resume }, accessToken });
}

export function getResumeSchemaWithMcp(accessToken?: string): Promise<McpToolResult> {
  return runApprovedMcpTool({ tool: 'get_resume_schema', accessToken });
}
