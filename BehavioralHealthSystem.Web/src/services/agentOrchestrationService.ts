/**
 * Agent Orchestration Service
 * Manages multiple specialized AI agents and coordinates handoffs between them
 * Based on Azure Realtime API Workshop multi-agent pattern
 * Reference: https://github.com/Azure-Samples/realtime-api-workshop/tree/main/02-building-multi-agent-system
 */

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler: (parameters: any) => Promise<any> | any;
}

export interface Agent {
  id: string;
  name: string;
  description: string; // When to use this agent
  systemMessage: string; // Instructions for the agent
  tools: AgentTool[]; // Tools specific to this agent
}

export interface AgentSwitchConfig {
  targetAgentId: string;
  systemMessage: string;
  tools: AgentTool[];
}

class AgentOrchestrationService {
  private agents: Map<string, Agent> = new Map();
  private currentAgentId: string | null = null;
  private rootAgentId: string | null = null;

  /**
   * Register a new agent in the system
   */
  registerAgent(agent: Agent): void {
    console.log(`🤖 Registering agent: ${agent.id} (${agent.name})`);
    this.agents.set(agent.id, agent);
  }

  /**
   * Register the root orchestrator agent
   * The root agent gets special handling - every other agent gets a tool to return to root
   */
  registerRootAgent(rootAgent: Agent): void {
    console.log(`👑 Registering ROOT agent: ${rootAgent.id} (${rootAgent.name})`);

    // First register the root agent normally
    this.registerAgent(rootAgent);
    this.rootAgentId = rootAgent.id;

    // Add a "return to root" tool to all other agents
    this.agents.forEach((agent, agentId) => {
      if (agentId !== rootAgent.id) {
        const returnToRootTool: AgentTool = {
          name: rootAgent.id,
          description: `If the customer asks any question that is outside of your work scope, use this to switch back to ${rootAgent.name}. Always call this when you complete your task or the customer has other questions.`,
          parameters: {
            type: 'object',
            properties: {}
          },
          handler: () => rootAgent.id
        };

        // Add the tool if it doesn't already exist
        if (!agent.tools.some(t => t.name === rootAgent.id)) {
          agent.tools.push(returnToRootTool);
        }
      }
    });

    // Also register under "root" for convenience
    this.agents.set('root', rootAgent);
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get the current active agent
   */
  getCurrentAgent(): Agent | undefined {
    if (!this.currentAgentId) return undefined;
    return this.agents.get(this.currentAgentId);
  }

  /**
   * Set the current active agent
   */
  setCurrentAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }
    console.log(`🔄 Switching to agent: ${agent.id} (${agent.name})`);
    this.currentAgentId = agentId;
  }

  /**
   * Get all tools for a specific agent, including tools to switch to other agents
   */
  getToolsForAgent(agentId: string): AgentTool[] {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Start with the agent's own tools
    const tools: AgentTool[] = [...agent.tools];

    // Add other agents as "tools" (for switching)
    this.agents.forEach((otherAgent, otherAgentId) => {
      if (otherAgentId !== agentId && otherAgentId !== 'root') {
        // Don't add the root alias, just use the actual agent IDs
        if (this.rootAgentId && otherAgentId === this.rootAgentId) {
          return; // Skip if this is the root agent (already added above)
        }

        const agentAsTool: AgentTool = {
          name: otherAgent.id,
          description: otherAgent.description,
          parameters: {
            type: 'object',
            properties: {}
          },
          handler: () => otherAgent.id
        };

        tools.push(agentAsTool);
      }
    });

    return tools;
  }

  /**
   * Convert AgentTool[] to Azure Realtime API tool format
   */
  convertToRealtimeTools(agentTools: AgentTool[]): any[] {
    return agentTools.map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Handle a tool call - either execute a real tool or switch agents
   * Returns: { isAgentSwitch: boolean, result: any, targetAgentId?: string, switchConfig?: AgentSwitchConfig }
   */
  async handleToolCall(toolName: string, parameters: any, _callId: string): Promise<{
    isAgentSwitch: boolean;
    result: any;
    targetAgentId?: string;
    switchConfig?: AgentSwitchConfig;
  }> {
    console.log(`🎯 handleToolCall: ${toolName}`, parameters);

    // Check if this is an agent switch (tool name matches an agent ID)
    const isAgentSwitch = this.agents.has(toolName);

    if (isAgentSwitch) {
      // This is an agent switch
      const targetAgent = this.agents.get(toolName);
      if (!targetAgent) {
        throw new Error(`Agent ${toolName} not found`);
      }

      console.log(`🔄 Switching from ${this.currentAgentId} to ${targetAgent.id}`);
      this.setCurrentAgent(targetAgent.id);

      // Get tools for the new agent
      const agentTools = this.getToolsForAgent(targetAgent.id);

      return {
        isAgentSwitch: true,
        result: targetAgent.id,
        targetAgentId: targetAgent.id,
        switchConfig: {
          targetAgentId: targetAgent.id,
          systemMessage: targetAgent.systemMessage,
          tools: agentTools
        }
      };
    }

    // Not an agent switch - find and execute the actual tool
    const currentAgent = this.getCurrentAgent();
    if (!currentAgent) {
      throw new Error('No current agent set');
    }

    const tool = currentAgent.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found in agent ${currentAgent.id}`);
    }

    // Execute the tool
    const result = await tool.handler(parameters);

    return {
      isAgentSwitch: false,
      result
    };
  }

  /**
   * Get the root agent configuration for initial setup
   */
  getRootAgentConfig(): { systemMessage: string; tools: AgentTool[] } {
    if (!this.rootAgentId) {
      throw new Error('No root agent registered');
    }

    const rootAgent = this.agents.get(this.rootAgentId);
    if (!rootAgent) {
      throw new Error('Root agent not found');
    }

    this.setCurrentAgent(this.rootAgentId);

    return {
      systemMessage: rootAgent.systemMessage,
      tools: this.getToolsForAgent(this.rootAgentId)
    };
  }

  /**
   * Reset to root agent
   */
  resetToRoot(): void {
    if (!this.rootAgentId) {
      throw new Error('No root agent registered');
    }
    console.log('🏠 Resetting to root agent');
    this.setCurrentAgent(this.rootAgentId);
  }
}

// Export singleton instance
export const agentOrchestrationService = new AgentOrchestrationService();
export default agentOrchestrationService;
