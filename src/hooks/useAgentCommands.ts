import { useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import { useAgentsStore } from '../stores/agents';
import { useWorkspacesStore } from '../stores/workspaces';
import { useUIStore } from '../stores/ui';
import type { AgentConfig } from '../types/agent';

export function useAgentCommands() {
  const { removeAgent, getAgentByWorkspace } = useAgentsStore();
  const { setWorkspaceAgent, removeWorkspace, updateWorkspaceState, getInputsForWorkspace, workspaces } =
    useWorkspacesStore();
  const { setStatusMessage, selectWorkspace, selectAgent } = useUIStore();

  // Build a prompt with input data from connected workspaces
  const buildWorkflowPrompt = useCallback(
    (workspaceId: string, basePrompt: string) => {
      const inputs = getInputsForWorkspace(workspaceId);
      if (inputs.length === 0) {
        return basePrompt;
      }

      // Build context from inputs
      const inputContext = inputs
        .filter((input) => input.output)
        .map((input) => {
          const ws = workspaces[input.id];
          return `--- Input from "${ws?.name || 'Unknown'}" ---\n${input.output}`;
        })
        .join('\n\n');

      if (!inputContext) {
        return basePrompt;
      }

      // Replace {{input}} placeholder or prepend context
      if (basePrompt.includes('{{input}}')) {
        return basePrompt.replace(/\{\{input\}\}/g, inputContext);
      }

      return `Here is context from previous workflow steps:\n\n${inputContext}\n\n---\n\nNow, your task:\n${basePrompt}`;
    },
    [getInputsForWorkspace, workspaces]
  );

  const startTask = useCallback(
    async (
      workspaceId: string,
      prompt: string,
      options?: { allowedTools?: string[]; useWorkflowInputs?: boolean; cli?: 'claude' | 'cursor' | 'kilo' | 'gemini'; mode?: string }
    ) => {
      try {
        // Check if there's an existing agent for this workspace
        const existingAgent = getAgentByWorkspace(workspaceId);
        if (existingAgent) {
          // Remove old agent before starting new one
          removeAgent(existingAgent.id);
        }

        // Get workspace settings
        const { workspaces } = useWorkspacesStore.getState();
        const workspace = workspaces[workspaceId];

        // Build the prompt with workflow inputs if needed
        const finalPrompt = options?.useWorkflowInputs !== false
          ? buildWorkflowPrompt(workspaceId, prompt)
          : prompt;

        updateWorkspaceState(workspaceId, 'working');
        setStatusMessage('Starting task...');

        const config: AgentConfig = {
          workspaceId,
          prompt: finalPrompt,
          cli: options?.cli ?? workspace?.cli,
          mode: options?.mode ?? workspace?.mode,
          allowedTools: options?.allowedTools,
          systemPrompt: workspace?.systemPrompt || undefined,
          model: workspace?.model || undefined,
        };

        // The backend returns the agent ID it creates
        const backendAgentId = await api.startAgent(config);

        // Create the agent in our store with the backend's ID
        const { agents } = useAgentsStore.getState();
        if (!agents[backendAgentId]) {
          // Manually add agent with the backend's ID
          useAgentsStore.setState((state) => ({
            agents: {
              ...state.agents,
              [backendAgentId]: {
                id: backendAgentId,
                workspaceId,
                state: 'thinking',
                task: prompt,
                progress: 0,
                logs: [],
                sessionId: null,
                model: null,
                startedAt: Date.now(),
                completedAt: null,
                error: null,
              },
            },
          }));
        }

        setWorkspaceAgent(workspaceId, backendAgentId);

        return backendAgentId;
      } catch (error) {
        setStatusMessage(`Failed to start task: ${error}`);
        throw error;
      }
    },
    [getAgentByWorkspace, removeAgent, setWorkspaceAgent, updateWorkspaceState, setStatusMessage, buildWorkflowPrompt]
  );

  // Start a workflow task (triggered by auto-run)
  const startWorkflowTask = useCallback(
    async (workspaceId: string) => {
      const { workspaces } = useWorkspacesStore.getState();
      const workspace = workspaces[workspaceId];
      if (!workspace?.taskTemplate) {
        console.warn('Cannot start workflow task: no task template defined');
        return;
      }

      await startTask(workspaceId, workspace.taskTemplate, { useWorkflowInputs: true });
    },
    [startTask]
  );

  // Listen for workflow trigger events
  useEffect(() => {
    const handleWorkflowTrigger = (event: CustomEvent<{ workspaceId: string }>) => {
      startWorkflowTask(event.detail.workspaceId);
    };

    window.addEventListener('trigger-workflow-task', handleWorkflowTrigger as EventListener);
    return () => {
      window.removeEventListener('trigger-workflow-task', handleWorkflowTrigger as EventListener);
    };
  }, [startWorkflowTask]);

  const stopTask = useCallback(
    async (agentId: string) => {
      try {
        setStatusMessage('Stopping task...');
        await api.stopAgent(agentId);
        setStatusMessage('Task stopped');
      } catch (error) {
        setStatusMessage(`Failed to stop task: ${error}`);
        throw error;
      }
    },
    [setStatusMessage]
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        const agent = getAgentByWorkspace(workspaceId);
        if (agent) {
          await api.stopAgent(agent.id);
          removeAgent(agent.id);
        }
        removeWorkspace(workspaceId);
        selectWorkspace(null);
        selectAgent(null);
        setStatusMessage('Workspace deleted');
      } catch (error) {
        setStatusMessage(`Failed to delete workspace: ${error}`);
        throw error;
      }
    },
    [getAgentByWorkspace, removeAgent, removeWorkspace, selectWorkspace, selectAgent, setStatusMessage]
  );

  // Check all CLIs at once (more efficient)
  const checkAllClisAvailable = useCallback(async (): Promise<Record<string, boolean>> => {
    try {
      return await api.checkAllClisAvailable();
    } catch {
      return {};
    }
  }, []);

  return {
    startTask,
    startWorkflowTask,
    stopTask,
    deleteWorkspace,
    checkAllClisAvailable,
  };
}
