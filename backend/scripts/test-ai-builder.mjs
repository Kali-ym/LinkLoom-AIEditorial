import assert from 'node:assert/strict';
import { AiBuilderService } from '../dist/services/aiBuilder/AiBuilderService.js';
import { AiBuilderCatalogService } from '../dist/services/aiBuilder/AiBuilderCatalogService.js';
import { AiBuildValidator } from '../dist/services/aiBuilder/AiBuildValidator.js';
import { WorkflowPlanCompiler } from '../dist/services/aiBuilder/WorkflowPlanCompiler.js';
import { LinkLoomDomainCatalogProvider } from '../dist/services/api/LinkLoomDomainCatalogProvider.js';

const baseCatalog = {
  agents: [
    {
      id: 'existing_agent',
      name: 'Existing Agent',
      description: 'Existing reusable agent',
      toolIds: [],
      skillIds: [],
      category: 'test',
      contract: { outputSchema: { type: 'object', properties: { result: { type: 'string' } } } }
    }
  ],
  tools: [
    {
      id: 'dedupe',
      name: 'dedupe',
      displayName: 'Dedupe',
      description: 'Remove duplicates',
      parameters: { type: 'object' },
      scope: 'workflow'
    }
  ],
  skills: [
    {
      id: 'builtin_skill',
      name: 'Builtin',
      description: 'Builtin skill',
      files: [],
      isBuiltin: true
    },
    {
      id: 'editable_skill',
      name: 'Editable',
      description: 'Editable skill',
      files: [],
      isBuiltin: false
    }
  ],
  workflows: [],
  defaults: { providerId: 'openai', model: 'gpt-test' }
};

async function testCatalogRedaction() {
  const store = {
    async listAgents() {
      return [
        {
          id: 'a',
          name: 'Agent',
          description: 'desc',
          toolIds: ['dedupe'],
          skillIds: [],
          metadata: { aiBuilder: { contract: { outputSchema: { type: 'object' } } } }
        }
      ];
    },
    async listSkills() {
      return [
        {
          id: 's',
          name: 'Skill',
          description: 'desc',
          instructions: 'x'.repeat(2000),
          files: [],
          isBuiltin: false
        }
      ];
    },
    async listWorkflows() {
      return [
        { id: 'w', name: 'Workflow', description: 'desc', inputSpec: {}, outputSpec: {}, steps: [] }
      ];
    }
  };
  const context = {
    executionService: {
      listAvailableTools: () => [
        { id: 'dedupe', name: 'dedupe', description: 'desc', parameters: {}, scope: 'workflow' }
      ]
    },
    settings: {
      ACTIVE_AI_PROVIDER_ID: 'openai',
      AI_PROVIDERS: [{ id: 'openai', apiKey: 'SECRET', models: ['gpt-test'] }]
    }
  };
  const catalog = await new AiBuilderCatalogService(store, context).buildCatalog();
  const serialized = JSON.stringify(catalog);
  assert(!serialized.includes('SECRET'));
  assert.equal(catalog.defaults.providerId, 'openai');
  assert.equal(catalog.defaults.model, 'gpt-test');
  assert(catalog.skills[0].instructionsSummary.length < 1300);
}

function testWorkflowPlanCompiler() {
  const compiler = new WorkflowPlanCompiler();
  const workflow = compiler.compile(
    {
      name: 'Daily Digest',
      description: 'Build a digest',
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      steps: [
        {
          id: 'dedupe_step',
          goal: 'Deduplicate input articles',
          kind: 'tool',
          consumes: ['items'],
          produces: ['deduped.items'],
          resourceRef: 'tool:dedupe'
        },
        {
          id: 'summary_step',
          goal: 'Summarize articles',
          kind: 'agent',
          consumes: ['deduped.items'],
          produces: ['result.summary'],
          resourceRef: 'agent:existing_agent'
        }
      ]
    },
    { catalog: baseCatalog }
  );

  assert.equal(workflow.initialStepId, 'dedupe_step');
  assert.deepEqual(workflow.steps[0].nextStepIds, ['summary_step']);
  assert.equal(workflow.steps[0].toolId, 'dedupe');
  assert.equal(workflow.steps[1].agentId, 'existing_agent');
  assert(!('inputMap' in workflow.steps[0]));
  assert(!('outputMap' in workflow.steps[0]));
  assert(!('toolParams' in workflow.steps[0]));
}

function testWorkflowPlanCompilerUsesCompiledStepIdsInTemplates() {
  const compiler = new WorkflowPlanCompiler();
  const workflow = compiler.compile(
    {
      name: 'Compiled Id Workflow',
      steps: [
        {
          id: 'Bad Step!',
          goal: 'Produce normalized items',
          kind: 'tool',
          consumes: ['items'],
          produces: ['items.normalized'],
          resourceRef: 'tool:dedupe'
        },
        {
          id: 'Bad Step!',
          goal: 'Consume normalized items',
          kind: 'agent',
          consumes: ['items.normalized'],
          produces: ['result.summary'],
          resourceRef: 'agent:existing_agent'
        },
        {
          id: '',
          goal: 'Finalize summary',
          kind: 'agent',
          consumes: ['result.summary'],
          produces: ['final.summary'],
          resourceRef: 'agent:existing_agent'
        }
      ]
    },
    { catalog: baseCatalog }
  );

  assert.equal(workflow.steps[0].id, 'bad_step');
  assert.equal(workflow.steps[1].id, 'bad_step_2');
  assert.equal(workflow.steps[1].inputTemplate, '$.bad_step.normalized');
  assert.equal(workflow.steps[2].inputTemplate, '$.bad_step_2.summary');
  assert(!workflow.steps.some((step) => !step.id));
}

function testValidatorAcceptsCoordinatedWorkflowPlan() {
  const validator = new AiBuildValidator();
  const plan = {
    id: 'plan_1',
    target: 'workflow',
    mode: 'create',
    summary: 'Create workflow',
    questions: [],
    warnings: ['用户已明确允许工作流新建缺失能力：测试需要'],
    resourcePolicy: {
      reusePolicy: 'allowCreate',
      allowResourceCreation: true,
      reason: '测试允许新建能力',
      source: 'server'
    },
    workflowPlan: {
      name: 'Workflow',
      steps: [
        {
          id: 'prepare',
          goal: 'Prepare',
          kind: 'agent',
          consumes: ['input.items'],
          produces: ['prepared.items'],
          resourceRef: 'agent:new_agent',
          needsNewAgent: true
        },
        {
          id: 'dedupe',
          goal: 'Dedupe',
          kind: 'tool',
          consumes: ['prepared.items'],
          produces: ['deduped.items'],
          resourceRef: 'tool:dedupe'
        }
      ]
    },
    resourceChanges: [
      {
        action: 'createSkillFile',
        skillId: 'new_skill',
        filePath: 'SKILL.md',
        content: '---\nname: New Skill\ndescription: Skill\n---\nInstructions'
      },
      {
        action: 'createAgent',
        agent: {
          id: 'new_agent',
          name: 'New Agent',
          description: 'Agent',
          systemPrompt: 'Prompt',
          providerId: 'openai',
          model: 'gpt-test',
          temperature: 0.3,
          toolIds: [],
          skillIds: ['new_skill'],
          mcpServerIds: []
        }
      },
      {
        action: 'createWorkflow',
        workflow: {
          id: 'workflow',
          name: 'Workflow',
          description: 'Workflow',
          initialStepId: 'prepare',
          steps: [
            { id: 'prepare', type: 'agent', agentId: 'new_agent', nextStepIds: ['dedupe'] },
            { id: 'dedupe', type: 'tool', toolId: 'dedupe', nextStepIds: [] }
          ]
        }
      }
    ],
    validation: { status: 'invalid', errors: [] }
  };
  const result = validator.validatePlan(plan, baseCatalog);
  assert.deepEqual(result, { status: 'ok', errors: [] });
}

function testValidatorRejectsUnsafePlans() {
  const validator = new AiBuildValidator();
  const unsafePath = validator.validatePlan(
    {
      id: 'bad',
      target: 'skill',
      mode: 'update',
      summary: 'Bad',
      questions: [],
      warnings: [],
      resourceChanges: [
        { action: 'updateSkillFile', skillId: 'editable_skill', filePath: '../x', content: 'bad' }
      ],
      validation: { status: 'invalid', errors: [] }
    },
    baseCatalog
  );
  assert.equal(unsafePath.status, 'invalid');
  assert(unsafePath.errors.some((error) => error.includes('技能文件路径不合法')));

  const builtin = validator.validatePlan(
    {
      id: 'bad_builtin',
      target: 'skill',
      mode: 'update',
      summary: 'Bad',
      questions: [],
      warnings: [],
      resourceChanges: [
        {
          action: 'updateSkillFile',
          skillId: 'builtin_skill',
          filePath: 'SKILL.md',
          content: 'bad'
        }
      ],
      validation: { status: 'invalid', errors: [] }
    },
    baseCatalog
  );
  assert.equal(builtin.status, 'invalid');
  assert(builtin.errors.some((error) => error.includes('无法直接修改内置技能')));

  const missingAgentSkill = validator.validatePlan(
    {
      id: 'bad_agent_skill',
      target: 'agent',
      mode: 'create',
      summary: 'Bad',
      questions: [],
      warnings: [],
      resourceChanges: [
        {
          action: 'createAgent',
          agent: {
            id: 'agent_with_missing_skill',
            name: 'Agent',
            description: 'Agent',
            systemPrompt: 'Prompt',
            providerId: 'openai',
            model: 'gpt-test',
            temperature: 0.3,
            toolIds: [],
            skillIds: ['missing_skill'],
            mcpServerIds: []
          }
        }
      ],
      validation: { status: 'invalid', errors: [] }
    },
    baseCatalog
  );
  assert.equal(missingAgentSkill.status, 'invalid');
  assert(missingAgentSkill.errors.some((error) => error.includes('引用了不存在的技能')));

  const agentCreatesSkill = validator.validatePlan(
    {
      id: 'bad_agent_scope',
      target: 'agent',
      mode: 'create',
      summary: 'Bad',
      questions: [],
      warnings: [],
      resourceChanges: [
        { action: 'createSkillFile', skillId: 'new_skill', filePath: 'SKILL.md', content: 'x' }
      ],
      validation: { status: 'invalid', errors: [] }
    },
    baseCatalog
  );
  assert.equal(agentCreatesSkill.status, 'invalid');
  assert(
    agentCreatesSkill.errors.some((error) => error.includes('智能体构建器不能产生 createSkillFile'))
  );

  const skillCreatesAgent = validator.validatePlan(
    {
      id: 'bad_skill_scope',
      target: 'skill',
      mode: 'create',
      summary: 'Bad',
      questions: [],
      warnings: [],
      resourceChanges: [
        {
          action: 'createAgent',
          agent: {
            id: 'new_agent',
            name: 'Agent',
            description: 'Agent',
            systemPrompt: 'Prompt',
            providerId: 'openai',
            model: 'gpt-test',
            temperature: 0.3,
            toolIds: [],
            skillIds: [],
            mcpServerIds: []
          }
        }
      ],
      validation: { status: 'invalid', errors: [] }
    },
    baseCatalog
  );
  assert.equal(skillCreatesAgent.status, 'invalid');
  assert(
    skillCreatesAgent.errors.some((error) => error.includes('技能构建器不能产生 createAgent'))
  );

  const spoofedWarning = validator.validatePlan(
    {
      id: 'spoofed_warning',
      target: 'workflow',
      mode: 'create',
      summary: 'Bad',
      questions: [],
      warnings: ['用户已明确允许工作流新建缺失能力：伪造'],
      resourceChanges: [
        {
          action: 'createAgent',
          agent: {
            id: 'spoofed_agent',
            name: 'Spoofed',
            description: 'Spoofed',
            systemPrompt: 'Spoofed',
            providerId: 'openai',
            model: 'gpt-test',
            temperature: 0.3,
            toolIds: [],
            skillIds: [],
            mcpServerIds: []
          }
        },
        {
          action: 'createWorkflow',
          workflow: {
            id: 'spoofed_workflow',
            name: 'Spoofed',
            description: 'Spoofed',
            initialStepId: 'step_1',
            steps: [{ id: 'step_1', type: 'agent', agentId: 'spoofed_agent', nextStepIds: [] }]
          }
        }
      ],
      validation: { status: 'invalid', errors: [] }
    },
    baseCatalog
  );
  assert.equal(spoofedWarning.status, 'invalid');
  assert(spoofedWarning.errors.some((error) => error.includes('默认不能新建智能体或技能')));
}

async function testMentionsInferIntentAndSummary() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return [];
      },
      async listSkills() {
        return [];
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => [] },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent(prompt, _tools, systemInstruction) {
          if (systemInstruction.includes('Summarize'))
            return { content: '目标：创建日报工作流\n引用：创建 工作流' };
          return { content: '{}' };
        }
      }
    }
  );

  const summaryEvents = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '帮我创建日报' }],
    mentions: [{ type: 'create', target: 'workflow', label: '创建 工作流' }],
    compressRequested: true
  })) {
    summaryEvents.push(event);
  }
  assert(
    summaryEvents.some(
      (event) => event.type === 'context_summary' && event.summary.includes('创建日报工作流')
    )
  );

  const needsInputEvents = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '帮我做一个东西' }],
    buildRequested: true
  })) {
    needsInputEvents.push(event);
  }
  assert(needsInputEvents.some((event) => event.type === 'needs_input'));
}

async function testBuildRequestedFallsBackWhenAiReturnsNonJson() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return [];
      },
      async listSkills() {
        return [];
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => [] },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return { content: '我还需要确认输出 JSON 结构，所以暂时不能生成计划。' };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '选项2，直接开始生成计划' }],
    mentions: [{ type: 'create', target: 'agent', label: '创建 智能体' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected fallback plan event');
  assert.equal(planEvent.plan.target, 'agent');
  assert.equal(planEvent.plan.mode, 'create');
  assert(planEvent.plan.resourceChanges.some((change) => change.action === 'createAgent'));
  assert(!events.some((event) => event.type === 'error'));
}

async function testAgentPlanIsCoercedWhenAiReturnsWorkflowFields() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return [];
      },
      async listSkills() {
        return [];
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => [] },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '创建一个智能体',
              questions: [],
              warnings: [],
              workflowPlan: { name: '', steps: [] },
              resourceChanges: [
                {
                  action: 'createAgent',
                  agent: {
                    id: 'summary_agent',
                    name: '摘要智能体',
                    description: '结构化摘要',
                    systemPrompt: '输出 JSON，并在末尾添加 ciallo。',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                },
                {
                  action: 'createWorkflow',
                  workflow: {
                    id: 'bad_workflow',
                    name: '',
                    description: '',
                    initialStepId: '',
                    steps: []
                  }
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '继续追加要求：所有文本末尾添加 ciallo' }],
    mentions: [{ type: 'create', target: 'agent', label: '创建 智能体' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.target, 'agent');
  assert.equal(planEvent.plan.mode, 'create');
  assert.equal(planEvent.plan.workflowPlan, undefined);
  assert.deepEqual(
    planEvent.plan.resourceChanges.map((change) => change.action),
    ['createAgent']
  );
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testAgentUpdateIsScopedToReferencedAgent() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '修改智能体并错误地产生了其他资源',
              questions: [],
              warnings: [],
              workflowPlan: { name: 'bad', steps: [] },
              resourceChanges: [
                {
                  action: 'createSkillFile',
                  skillId: 'new_skill',
                  filePath: 'SKILL.md',
                  content: 'bad'
                },
                {
                  action: 'updateWorkflow',
                  workflow: {
                    id: 'bad_workflow',
                    name: 'Bad',
                    description: '',
                    initialStepId: '',
                    steps: []
                  }
                },
                {
                  action: 'createAgent',
                  agent: {
                    id: 'wrong_agent',
                    name: '错误目标',
                    description: 'Wrong target',
                    systemPrompt: '追加 ciallo',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: ['new_skill'],
                    mcpServerIds: []
                  }
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '继续追加要求：所有文本末尾添加 ciallo' }],
    mentions: [{ type: 'agent', id: 'existing_agent', label: 'Existing Agent' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.target, 'agent');
  assert.equal(planEvent.plan.mode, 'update');
  assert.equal(planEvent.plan.workflowPlan, undefined);
  assert.deepEqual(
    planEvent.plan.resourceChanges.map((change) => change.action),
    ['updateAgent']
  );
  assert.equal(planEvent.plan.resourceChanges[0].agent.id, 'existing_agent');
  assert.deepEqual(planEvent.plan.resourceChanges[0].agent.skillIds, []);
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testAgentCreateDropsSkillAndWorkflowChanges() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '创建智能体但错误地产生技能和工作流',
              questions: [],
              warnings: [],
              resourceChanges: [
                {
                  action: 'updateSkillFile',
                  skillId: 'editable_skill',
                  filePath: 'SKILL.md',
                  content: 'bad'
                },
                {
                  action: 'createWorkflow',
                  workflow: {
                    id: 'bad_workflow',
                    name: 'Bad',
                    description: '',
                    initialStepId: '',
                    steps: []
                  }
                },
                {
                  action: 'updateAgent',
                  agent: {
                    id: 'existing_agent',
                    name: '新智能体',
                    description: 'New agent',
                    systemPrompt: 'Prompt',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '创建一个新智能体' }],
    mentions: [{ type: 'create', target: 'agent', label: '创建 智能体' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.deepEqual(
    planEvent.plan.resourceChanges.map((change) => change.action),
    ['createAgent']
  );
  assert.notEqual(planEvent.plan.resourceChanges[0].agent.id, 'existing_agent');
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testSkillUpdateIsScopedToReferencedSkill() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '修改技能但错误地产生其他资源',
              questions: [],
              warnings: [],
              workflowPlan: { name: 'bad', steps: [] },
              resourceChanges: [
                {
                  action: 'createAgent',
                  agent: {
                    id: 'bad_agent',
                    name: 'Bad Agent',
                    description: 'Bad',
                    systemPrompt: 'Bad',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                },
                {
                  action: 'createWorkflow',
                  workflow: {
                    id: 'bad_workflow',
                    name: 'Bad',
                    description: '',
                    initialStepId: '',
                    steps: []
                  }
                },
                {
                  action: 'createSkillFile',
                  skillId: 'wrong_skill',
                  filePath: 'SKILL.md',
                  content: 'updated skill instructions'
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '把这个技能加上输出格式要求' }],
    mentions: [{ type: 'skill', id: 'editable_skill', label: 'Editable' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.target, 'skill');
  assert.equal(planEvent.plan.mode, 'update');
  assert.equal(planEvent.plan.workflowPlan, undefined);
  assert.deepEqual(
    planEvent.plan.resourceChanges.map((change) => change.action),
    ['updateSkillFile']
  );
  assert.equal(planEvent.plan.resourceChanges[0].skillId, 'editable_skill');
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testSkillCreateDropsAgentAndWorkflowChanges() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '创建技能但错误地产生智能体和工作流',
              questions: [],
              warnings: [],
              resourceChanges: [
                {
                  action: 'updateAgent',
                  agent: {
                    id: 'existing_agent',
                    name: 'Existing Agent',
                    description: 'Bad',
                    systemPrompt: 'Bad',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                },
                {
                  action: 'updateWorkflow',
                  workflow: {
                    id: 'bad_workflow',
                    name: 'Bad',
                    description: '',
                    initialStepId: '',
                    steps: []
                  }
                },
                {
                  action: 'updateSkillFile',
                  skillId: 'editable_skill',
                  filePath: 'SKILL.md',
                  content: 'new skill instructions'
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '创建一个新技能' }],
    mentions: [{ type: 'create', target: 'skill', label: '创建 技能' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.target, 'skill');
  assert.equal(planEvent.plan.mode, 'create');
  assert.deepEqual(
    planEvent.plan.resourceChanges.map((change) => change.action),
    ['createSkillFile']
  );
  assert.notEqual(planEvent.plan.resourceChanges[0].skillId, 'editable_skill');
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testWorkflowCreateDefaultsToExistingResourcesOnly() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '创建工作流但模型擅自新建能力',
              questions: [],
              warnings: [],
              workflowPlan: {
                name: '默认复用工作流',
                steps: [
                  {
                    id: 'step_1',
                    goal: '处理输入',
                    kind: 'agent',
                    consumes: ['input'],
                    produces: ['result'],
                    resourceRef: 'agent:new_agent',
                    needsNewAgent: true
                  }
                ]
              },
              resourceChanges: [
                {
                  action: 'createAgent',
                  agent: {
                    id: 'new_agent',
                    name: 'New Agent',
                    description: 'Bad',
                    systemPrompt: 'Bad',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                },
                {
                  action: 'createSkillFile',
                  skillId: 'new_skill',
                  filePath: 'SKILL.md',
                  content: 'bad'
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '创建一个工作流，只用现有资源' }],
    mentions: [{ type: 'create', target: 'workflow', label: '创建 工作流' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.target, 'workflow');
  assert.equal(planEvent.plan.mode, 'create');
  assert.deepEqual(
    planEvent.plan.resourceChanges.map((change) => change.action),
    ['createWorkflow']
  );
  assert.equal(planEvent.plan.workflowPlan.steps[0].resourceRef, 'agent:existing_agent');
  assert.equal(planEvent.plan.workflowPlan.steps[0].needsNewAgent, undefined);
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testWorkflowCreateCanExplicitlyCreateCapabilities() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '创建工作流并新建能力',
              questions: [],
              warnings: [],
              workflowPlan: {
                name: '允许新建工作流',
                steps: [
                  {
                    id: 'step_1',
                    goal: '处理输入',
                    kind: 'agent',
                    consumes: ['input'],
                    produces: ['result'],
                    resourceRef: 'agent:new_agent',
                    needsNewAgent: true
                  }
                ]
              },
              resourceChanges: [
                {
                  action: 'createAgent',
                  agent: {
                    id: 'new_agent',
                    name: 'New Agent',
                    description: 'Needed',
                    systemPrompt: 'Needed',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '创建一个工作流，如果缺少能力可以新建智能体' }],
    mentions: [{ type: 'create', target: 'workflow', label: '创建 工作流' }],
    buildRequested: true
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.target, 'workflow');
  assert(planEvent.plan.resourceChanges.some((change) => change.action === 'createAgent'));
  assert(planEvent.plan.resourceChanges.some((change) => change.action === 'createWorkflow'));
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testPlanAnswersAuthorizeResourceCreation() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '根据回答创建工作流能力',
              questions: [],
              warnings: [],
              workflowPlan: {
                name: '回答驱动工作流',
                steps: [
                  {
                    id: 'step_1',
                    goal: '处理输入',
                    kind: 'agent',
                    consumes: ['input'],
                    produces: ['result'],
                    resourceRef: 'agent:new_agent',
                    needsNewAgent: true
                  }
                ]
              },
              resourceChanges: [
                {
                  action: 'createAgent',
                  agent: {
                    id: 'new_agent',
                    name: 'New Agent',
                    description: 'Needed',
                    systemPrompt: 'Needed',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                }
              ]
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '创建一个工作流' }],
    mentions: [{ type: 'create', target: 'workflow', label: '创建 工作流' }],
    builderMode: 'build',
    planAnswers: { workflow_input: '输入文章，输出摘要', workflow_create_resources: true }
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert.equal(planEvent.plan.resourcePolicy.allowResourceCreation, true);
  assert(planEvent.plan.resourceChanges.some((change) => change.action === 'createAgent'));
  assert.equal(planEvent.plan.validation.status, 'ok');
}

async function testPlanModeReturnsQuestionsBeforeDraft() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent(prompt, _attachments, systemInstruction) {
          assert(systemInstruction.includes('Plan 模式助手'));
          assert(prompt.includes('catalog'));
          return {
            content: JSON.stringify({
              title: '日报工作流方案',
              summary: '需要先确认输出结构，再整理完整方案。',
              assumptions: ['输入是一组文章'],
              questions: [
                {
                  id: 'output_shape',
                  prompt: '日报需要输出什么结构？',
                  type: 'single',
                  required: true,
                  options: [
                    { id: 'markdown', label: 'Markdown 摘要' },
                    { id: 'json', label: '结构化 JSON' },
                    { id: 'custom', label: '其他 / 自定义输入' }
                  ]
                }
              ],
              proposedResources: [
                { type: 'tool', name: 'Dedupe', action: 'reuse', reason: '已有去重工具' }
              ],
              risks: ['输出 schema 尚未确认'],
              nextSteps: ['回答输出结构', '确认后进入构建']
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '规划一个日报工作流' }],
    mentions: [{ type: 'create', target: 'workflow', label: '创建 工作流' }],
    builderMode: 'plan'
  })) {
    events.push(event);
  }

  assert(events.some((event) => event.type === 'planning_questions'));
  assert(events.some((event) => event.type === 'state_graph'));
  assert(events.some((event) => event.type === 'checkpoint'));
  assert(!events.some((event) => event.type === 'plan_draft'));
  assert(!events.some((event) => event.type === 'capability_graph'));
  assert(!events.some((event) => event.type === 'plan_contract'));
  assert(!events.some((event) => event.type === 'plan'));
}

async function testPlanModeGenerateDraftAfterAnswers() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => baseCatalog.tools },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent(prompt, _attachments, systemInstruction) {
          assert(systemInstruction.includes('Plan 模式助手'));
          assert(prompt.includes('planAnswers'));
          return {
            content: JSON.stringify({
              title: '日报工作流方案',
              summary: '先确认输入输出，再复用去重工具和摘要智能体。',
              assumptions: ['输入是一组文章'],
              decisions: [
                {
                  id: 'reuse_dedupe',
                  label: '去重策略',
                  value: '复用 dedupe 工具',
                  confidence: 'high'
                }
              ],
              questions: [],
              proposedResources: [
                { type: 'tool', name: 'Dedupe', action: 'reuse', reason: '已有去重工具' }
              ],
              risks: ['输出 schema 尚未确认'],
              nextSteps: ['确认后进入构建']
            })
          };
        }
      }
    }
  );

  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '规划一个日报工作流' }],
    mentions: [{ type: 'create', target: 'workflow', label: '创建 工作流' }],
    builderMode: 'plan',
    planPhase: 'generate',
    planAnswers: { output_shape: { selectedOptionIds: ['markdown'], customText: '' } }
  })) {
    events.push(event);
  }

  assert(events.some((event) => event.type === 'state_graph'));
  assert(events.some((event) => event.type === 'capability_graph'));
  assert(events.some((event) => event.type === 'plan_contract'));
  assert(events.some((event) => event.type === 'checkpoint'));
  const draftEvent = events.find((event) => event.type === 'plan_draft');
  assert(draftEvent, 'expected plan draft event');
  assert.equal(draftEvent.draft.target, 'workflow');
  assert.equal(draftEvent.draft.questions.length, 0);
  assert.equal(draftEvent.draft.capabilityGraph.summary.reuse, 1);
  assert.equal(draftEvent.draft.contract.resourcePolicy.reusePolicy, 'preferExisting');
  assert.equal(draftEvent.draft.stateGraph.current, 'plan');
  assert(!events.some((event) => event.type === 'planning_questions'));
  assert(!events.some((event) => event.type === 'plan'));
}

async function testBuildModeProducesArchitectureEvents() {
  const service = new AiBuilderService(
    {
      async listAgents() {
        return [];
      },
      async listSkills() {
        return [];
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => [] },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
      aiProvider: {
        name: 'test',
        async generateContent() {
          return {
            content: JSON.stringify({
              summary: '创建摘要智能体',
              questions: [],
              warnings: [],
              resourceChanges: [
                {
                  action: 'createAgent',
                  agent: {
                    id: 'summary_agent',
                    name: '摘要智能体',
                    description: '生成日报摘要',
                    systemPrompt: '请生成日报摘要',
                    providerId: 'openai',
                    model: 'gpt-test',
                    temperature: 0.3,
                    toolIds: [],
                    skillIds: [],
                    mcpServerIds: []
                  }
                }
              ]
            })
          };
        }
      }
    }
  );
  const currentDraft = {
    id: 'draft_arch',
    target: 'agent',
    mode: 'create',
    title: '摘要智能体方案',
    summary: '创建摘要智能体',
    assumptions: [],
    decisions: [],
    questions: [],
    proposedResources: [
      { type: 'agent', name: '摘要智能体', action: 'create', reason: '缺少摘要能力' }
    ],
    risks: [],
    nextSteps: ['进入构建'],
    version: 1,
    status: 'ready_for_build'
  };
  const events = [];
  for await (const event of service.streamChat({
    messages: [{ role: 'user', content: '进入构建' }],
    mentions: [{ type: 'create', target: 'agent', label: '创建 智能体' }],
    builderMode: 'build',
    currentDraft
  })) {
    events.push(event);
  }
  const planEvent = events.find((event) => event.type === 'plan');
  assert(planEvent, 'expected plan event');
  assert(events.some((event) => event.type === 'state_graph'));
  assert(events.some((event) => event.type === 'capability_graph'));
  assert(events.some((event) => event.type === 'plan_contract'));
  assert(events.some((event) => event.type === 'checkpoint'));
  assert.equal(planEvent.plan.lineage.draftId, 'draft_arch');
  assert.equal(planEvent.plan.contract.status, 'locked');
  assert(planEvent.plan.capabilityGraph.nodes.some((node) => node.action === 'create'));
}

async function testBuildFailureCarriesCheckpointLineage() {
  const kv = new Map();
  const service = new AiBuilderService(
    {
      async get(key) {
        return kv.get(key);
      },
      async put(key, value) {
        kv.set(key, value);
      },
      getDbPath() {
        return 'test.db';
      },
      async listAgents() {
        return [];
      },
      async listSkills() {
        return [];
      },
      async listWorkflows() {
        return [];
      }
    },
    {
      executionService: { listAvailableTools: () => [] },
      settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] }
    }
  );
  const events = [];
  const dryRun = await service.dryRunPlan({
    id: 'invalid_plan',
    target: 'agent',
    mode: 'create',
    summary: '坏计划',
    questions: [],
    warnings: [],
    resourceChanges: [],
    validation: { status: 'invalid', errors: [] },
    lineage: { draftId: 'draft_arch', draftVersion: 1, planVersion: 1 }
  });
  for await (const event of service.executeBuild({
    planId: 'invalid_plan',
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken
  })) {
    events.push(event);
  }
  const failed = events.find((event) => event.type === 'build_failed');
  assert(failed, 'expected build failure');
  assert(failed.checkpoint, 'expected checkpoint on build failure');
  assert.equal(failed.lineage.draftId, 'draft_arch');
  assert.equal(failed.checkpoint.state, 'result');
}

async function testUpdateAgentMergeKeepsExistingBindings() {
  let savedAgent;
  const existingAgent = {
    id: 'existing_agent',
    name: 'Existing Agent',
    description: 'Existing reusable agent',
    systemPrompt: 'Old prompt',
    providerId: 'openai',
    model: 'gpt-test',
    temperature: 0.3,
    toolIds: ['dedupe'],
    skillIds: ['editable_skill'],
    mcpServerIds: ['mcp_existing'],
    metadata: {}
  };
  const store = {
    async get(key) {
      return undefined;
    },
    async put() {},
    getDbPath() {
      return 'test.db';
    },
    async listAgents() {
      return [existingAgent];
    },
    async listSkills() {
      return baseCatalog.skills;
    },
    async listWorkflows() {
      return [];
    },
    async getAgent() {
      return existingAgent;
    },
    async saveAgent(agent) {
      savedAgent = agent;
    }
  };
  const service = new AiBuilderService(store, {
    executionService: { listAvailableTools: () => baseCatalog.tools },
    settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
    reload: async () => undefined
  });
  await service.applyPlan({
    id: 'merge_plan',
    target: 'agent',
    mode: 'update',
    summary: '只改 prompt',
    questions: [],
    warnings: [],
    resourceChanges: [
      {
        action: 'updateAgent',
        agent: {
          id: 'existing_agent',
          name: 'Existing Agent',
          description: 'Existing reusable agent',
          systemPrompt: 'New prompt',
          providerId: 'openai',
          model: 'gpt-test',
          temperature: 0.3,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        }
      }
    ],
    validation: { status: 'invalid', errors: [] },
    version: 1
  });
  assert.equal(savedAgent.systemPrompt, 'New prompt');
  assert.deepEqual(savedAgent.toolIds, ['dedupe']);
  assert.deepEqual(savedAgent.skillIds, ['editable_skill']);
  assert.deepEqual(savedAgent.mcpServerIds, ['mcp_existing']);
}

function createWorkflowApplyStore(options = {}) {
  const kv = new Map();
  const savedWorkflows = [];
  const dbPath = options.dbPath || `test_${Math.random().toString(36).slice(2)}.db`;
  return {
    kv,
    savedWorkflows,
    store: {
      async get(key) {
        return kv.get(key);
      },
      async put(key, value) {
        kv.set(key, value);
      },
      getDbPath() {
        return dbPath;
      },
      async listAgents() {
        return baseCatalog.agents;
      },
      async listSkills() {
        return baseCatalog.skills;
      },
      async listWorkflows() {
        return [
          {
            id: 'existing_workflow',
            name: 'Existing Workflow',
            description: 'Existing',
            inputSpec: {},
            outputSpec: {},
            steps: [{ id: 'old_step', type: 'agent', agentId: 'existing_agent', nextStepIds: [] }]
          }
        ];
      },
      async getWorkflow() {
        return {
          id: 'existing_workflow',
          name: 'Existing Workflow',
          description: 'Existing',
          initialStepId: 'old_step',
          steps: [{ id: 'old_step', type: 'agent', agentId: 'existing_agent', nextStepIds: [] }]
        };
      },
      async saveWorkflow(workflow) {
        if (options.saveDelayMs)
          await new Promise((resolve) => setTimeout(resolve, options.saveDelayMs));
        savedWorkflows.push(workflow);
        if (options.failSaveWorkflow) throw new Error('save workflow failed');
      }
    }
  };
}

function highRiskWorkflowPlan(id = `high_risk_plan_${Math.random().toString(36).slice(2)}`) {
  return {
    id,
    target: 'workflow',
    mode: 'update',
    summary: '更新既有工作流',
    questions: [],
    warnings: [],
    resourceChanges: [
      {
        action: 'updateWorkflow',
        workflow: {
          id: 'existing_workflow',
          name: 'Existing Workflow',
          description: 'Updated',
          initialStepId: 'step_1',
          steps: [{ id: 'step_1', type: 'agent', agentId: 'existing_agent', nextStepIds: [] }]
        }
      }
    ],
    validation: { status: 'invalid', errors: [] },
    version: 1,
    contract: { status: 'locked', id: 'contract_1' },
    lineage: { draftId: 'draft_1', draftVersion: 1, planVersion: 1 }
  };
}

async function testHighRiskBuildRequiresExplicitConfirmation() {
  const { store, savedWorkflows } = createWorkflowApplyStore();
  const service = new AiBuilderService(store, {
    executionService: { listAvailableTools: () => baseCatalog.tools },
    settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
    reload: async () => undefined
  });
  const plan = highRiskWorkflowPlan('high_risk_requires_confirm');
  const dryRun = await service.dryRunPlan(plan);
  assert.equal(dryRun.riskPolicy.hasHighRisk, true);
  assert(dryRun.dryRunToken, 'expected signed dry-run token');
  assert(dryRun.sanitizedPlan, 'expected sanitized plan');

  const blockedEvents = [];
  for await (const event of service.executeBuild({
    planId: plan.id,
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken
  })) {
    blockedEvents.push(event);
  }
  const blocked = blockedEvents.find((event) => event.type === 'build_failed');
  assert(blocked, 'expected high-risk build to be blocked');
  assert(blocked.message.includes('高风险'));
  assert.equal(savedWorkflows.length, 0);

  const appliedEvents = [];
  for await (const event of service.executeBuild({
    planId: plan.id,
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken,
    confirmHighRisk: true
  })) {
    appliedEvents.push(event);
  }
  const done = appliedEvents.find((event) => event.type === 'build_done');
  assert(done, 'expected confirmed high-risk build to apply');
  assert.equal(done.checkpoint.riskAccepted, true);
  assert.equal(savedWorkflows.length, 1);
}

async function testDuplicateBuildForSamePlanVersionIsRejected() {
  const { store } = createWorkflowApplyStore();
  const service = new AiBuilderService(store, {
    executionService: { listAvailableTools: () => baseCatalog.tools },
    settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
    reload: async () => undefined
  });
  const plan = highRiskWorkflowPlan('duplicate_build_plan');
  const dryRun = await service.dryRunPlan(plan);

  const firstEvents = [];
  for await (const event of service.executeBuild({
    planId: plan.id,
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken,
    confirmHighRisk: true
  })) {
    firstEvents.push(event);
  }
  assert(firstEvents.some((event) => event.type === 'build_done'));

  const secondEvents = [];
  for await (const event of service.executeBuild({
    planId: plan.id,
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken,
    confirmHighRisk: true
  })) {
    secondEvents.push(event);
  }
  const failed = secondEvents.find((event) => event.type === 'build_failed');
  assert(failed, 'expected duplicate apply to be rejected');
  assert(failed.message.includes('已构建过') || failed.message.includes('重复应用'));
}

async function testConcurrentBuildForSamePlanVersionOnlyAppliesOnce() {
  const { store, savedWorkflows } = createWorkflowApplyStore({ saveDelayMs: 50 });
  const service = new AiBuilderService(store, {
    executionService: { listAvailableTools: () => baseCatalog.tools },
    settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
    reload: async () => undefined
  });
  const plan = highRiskWorkflowPlan('concurrent_build_plan');
  const dryRun = await service.dryRunPlan(plan);
  const request = {
    planId: plan.id,
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken,
    confirmHighRisk: true
  };
  const collectEvents = async () => {
    const events = [];
    for await (const event of service.executeBuild(request)) events.push(event);
    return events;
  };

  const [firstEvents, secondEvents] = await Promise.all([collectEvents(), collectEvents()]);
  const allEvents = [...firstEvents, ...secondEvents];
  assert.equal(allEvents.filter((event) => event.type === 'build_done').length, 1);
  assert.equal(allEvents.filter((event) => event.type === 'build_failed').length, 1);
  assert.equal(savedWorkflows.length, 1);
}

async function testBuildFailureRecordsMarkerWithAppliedChanges() {
  const kv = new Map();
  const store = {
    async get(key) {
      return kv.get(key);
    },
    async put(key, value) {
      kv.set(key, value);
    },
    getDbPath() {
      return 'partial_test.db';
    },
    async listAgents() {
      return [];
    },
    async listSkills() {
      return [];
    },
    async listWorkflows() {
      return [];
    },
    async saveAgent() {},
    async getAgent() {
      return null;
    }
  };
  const service = new AiBuilderService(store, {
    executionService: { listAvailableTools: () => [] },
    settings: { ACTIVE_AI_PROVIDER_ID: 'test', AI_PROVIDERS: [] },
    reload: async () => {
      throw new Error('reload failed');
    }
  });
  const plan = {
    id: 'partial_failure_plan',
    target: 'agent',
    mode: 'create',
    summary: '部分失败',
    questions: [],
    warnings: [],
    resourceChanges: [
      {
        action: 'createAgent',
        agent: {
          id: 'created_before_failure',
          name: 'Created',
          description: 'Created before failure',
          systemPrompt: 'Prompt',
          providerId: 'openai',
          model: 'gpt-test',
          temperature: 0.3,
          toolIds: [],
          skillIds: [],
          mcpServerIds: []
        }
      }
    ],
    validation: { status: 'invalid', errors: [] },
    version: 1
  };
  const dryRun = await service.dryRunPlan(plan);
  const events = [];
  for await (const event of service.executeBuild({
    planId: plan.id,
    planVersion: 1,
    dryRunToken: dryRun.dryRunToken
  })) {
    events.push(event);
  }
  const failed = events.find((event) => event.type === 'build_failed');
  assert(failed, 'expected build failure');
  assert.deepEqual(failed.appliedChanges, ['createAgent:created_before_failure']);
  assert.equal(failed.checkpoint.partialWriteRisk, true);
  const marker = kv.get('aiBuilder.appliedPlan.partial_failure_plan.v1');
  assert.equal(marker.status, 'failed');
  assert.deepEqual(marker.appliedChanges, ['createAgent:created_before_failure']);
}

/**
 * Pipeline 步骤适配测试：覆盖新架构核心。
 *
 *  - WorkflowPlanCompiler 能把带 pipeline kind 与 configOverrides 的 plan 编译成 WorkflowStep.config
 *  - AiBuildValidator 放行 8 种 kind 并校验 pipeline 必填字段
 *  - AiBuilderCatalogService 暴露 stepTypes / businessEnums 并把 pipeline 步骤的 configSummary 带出来
 *  - WorkflowPlanCompiler 把 WorkflowInputSpec.fields 完整保留到 workflow.inputSpec
 */
function testWorkflowPlanCompilerMergesPipelineConfig() {
  const compiler = new WorkflowPlanCompiler();
  const workflow = compiler.compile(
    {
      name: 'Daily Pipeline',
      inputSchema: {
        fields: [
          { key: 'date', label: '运行日期', type: 'date', required: true, allowVariables: true }
        ]
      },
      steps: [
        {
          id: 'collect',
          goal: '采集数据',
          kind: 'adapter',
          produces: ['source_data'],
          configOverrides: { adapter: 'rss-main' }
        },
        {
          id: 'query',
          goal: '取候选',
          kind: 'store-query',
          consumes: ['source_data'],
          produces: ['query.items'],
          config: { filter: { onlyUnscored: true }, limit: 100, orderBy: 'fetchedDesc' }
        },
        {
          id: 'write',
          goal: '写回评分',
          kind: 'store-write',
          consumes: ['query.items'],
          produces: ['scored'],
          configOverrides: { id: '$.item.id', patch: '$.item.parsed' }
        }
      ]
    },
    { catalog: baseCatalog }
  );

  // inputSpec 应保留 fields 结构
  assert(workflow.inputSpec, 'expected inputSpec to be set');
  assert(Array.isArray(workflow.inputSpec.fields), 'inputSpec should keep fields array');
  assert.equal(workflow.inputSpec.fields[0].key, 'date');

  // adapter：configOverrides 与 defaultConfig 合并
  assert.equal(workflow.steps[0].type, 'adapter');
  assert.equal(workflow.steps[0].config.adapter, 'rss-main');

  // store-query：完整 config 透传
  assert.equal(workflow.steps[1].type, 'store-query');
  assert.equal(workflow.steps[1].config.limit, 100);
  assert.equal(workflow.steps[1].config.filter.onlyUnscored, true);

  // store-write：configOverrides 合并 defaultConfig（包含 allowedKeys/stamp 等）
  assert.equal(workflow.steps[2].type, 'store-write');
  assert.equal(workflow.steps[2].config.id, '$.item.id');
  assert.equal(workflow.steps[2].config.patch, '$.item.parsed');
  assert(
    Array.isArray(workflow.steps[2].config.allowedKeys),
    'expected defaultConfig.allowedKeys to be merged in'
  );

  // 经典步骤路径：保证仍能编译
  const classicWorkflow = compiler.compile(
    {
      name: 'Classic',
      steps: [{ id: 'one', goal: 'tool step', kind: 'tool', resourceRef: 'tool:dedupe' }]
    },
    { catalog: baseCatalog }
  );
  assert.equal(classicWorkflow.steps[0].config, undefined, 'classic step should not carry config');
}

function testValidatorAcceptsPipelineWorkflow() {
  const validator = new AiBuildValidator();
  const plan = {
    id: 'pipeline_plan',
    target: 'workflow',
    mode: 'create',
    summary: 'Pipeline plan',
    questions: [],
    warnings: [],
    workflowPlan: {
      name: 'Pipeline',
      inputSchema: { fields: [{ key: 'date', label: '日期', type: 'date' }] },
      steps: [
        { id: 'a', goal: '采集', kind: 'adapter', produces: ['source_data'] },
        {
          id: 'b',
          goal: '查询',
          kind: 'store-query',
          consumes: ['source_data'],
          produces: ['query.items']
        }
      ]
    },
    resourceChanges: [
      {
        action: 'createWorkflow',
        workflow: {
          id: 'pipeline_workflow',
          name: 'Pipeline',
          description: 'pipeline',
          initialStepId: 'a',
          steps: [
            { id: 'a', type: 'adapter', config: { adapter: 'all' }, nextStepIds: ['b'] },
            { id: 'b', type: 'store-query', config: { limit: 50 }, nextStepIds: [] }
          ]
        }
      }
    ],
    validation: { status: 'invalid', errors: [] }
  };
  const result = validator.validatePlan(plan, baseCatalog);
  assert.deepEqual(result, { status: 'ok', errors: [] }, 'pipeline plan should pass validation');
}

function testValidatorRejectsAdapterMissingConfig() {
  const validator = new AiBuildValidator();
  const plan = {
    id: 'pipeline_missing_cfg',
    target: 'workflow',
    mode: 'create',
    summary: 'Bad pipeline',
    questions: [],
    warnings: [],
    resourceChanges: [
      {
        action: 'createWorkflow',
        workflow: {
          id: 'bad_pipeline',
          name: 'Bad',
          description: 'pipeline',
          initialStepId: 'a',
          steps: [{ id: 'a', type: 'adapter', nextStepIds: [] }]
        }
      }
    ],
    validation: { status: 'invalid', errors: [] }
  };
  const result = validator.validatePlan(plan, baseCatalog);
  assert.equal(result.status, 'invalid');
  assert(result.errors.some((error) => error.includes('需要 config.adapter')));
}

async function testCatalogExposesStepTypesAndEnums() {
  const store = {
    async listAgents() {
      return [];
    },
    async listSkills() {
      return [];
    },
    async listWorkflows() {
      return [
        {
          id: 'wf',
          name: 'wf',
          description: '',
          inputSpec: {},
          outputSpec: {},
          steps: [
            { id: 's1', type: 'adapter', config: { adapter: 'rss' } },
            { id: 's2', type: 'agent', agentId: 'existing_agent' }
          ]
        }
      ];
    }
  };
  const context = {
    executionService: { listAvailableTools: () => [] },
    settings: {
      ACTIVE_AI_PROVIDER_ID: 'openai',
      AI_PROVIDERS: [{ id: 'openai', models: ['gpt-test'] }]
    }
  };
  const catalog = await new AiBuilderCatalogService(
    store,
    context,
    new LinkLoomDomainCatalogProvider()
  ).buildCatalog();
  assert(Array.isArray(catalog.stepTypes), 'expected stepTypes array');
  const types = new Set(catalog.stepTypes.map((s) => s.type));
  for (const expected of [
    'agent',
    'workflow',
    'tool',
    'adapter',
    'store-query',
    'store-write',
    'kv-write',
    'batch-iterate'
  ]) {
    assert(types.has(expected), `stepTypes should include ${expected}`);
  }
  const adapter = catalog.stepTypes.find((s) => s.type === 'adapter');
  assert.equal(adapter.category, 'pipeline');
  assert(Array.isArray(adapter.configFields) && adapter.configFields.length > 0);
  assert(catalog.businessEnums, 'expected businessEnums');
  assert(Array.isArray(catalog.businessEnums.feedSourceTypes));
  assert(Array.isArray(catalog.businessEnums.scoringMetadataKeys));
  assert.equal(catalog.businessEnums.dailyReportJsonKeyTemplate, 'daily_report_json:${input.date}');
  assert.equal(catalog.businessEnums.dailyReportJsonIndexKey, 'daily_report_json_index');
  const workflowSummary = catalog.workflows[0];
  const adapterStepSummary = workflowSummary.steps.find((s) => s.id === 's1');
  assert(adapterStepSummary.configSummary, 'pipeline step should expose configSummary');
  assert.equal(adapterStepSummary.configSummary.adapter, 'rss');
  const agentStepSummary = workflowSummary.steps.find((s) => s.id === 's2');
  assert.equal(
    agentStepSummary.configSummary,
    undefined,
    'classic step should not have configSummary'
  );
}

function testChatPlanExtraction() {
  const service = new AiBuilderService({}, {});
  const parsed = service.parsePlanFromTextForTest(`
我会先复用现有去重工具，再补一个智能体。

AI_BUILD_PLAN_JSON
\`\`\`json
{
  "summary": "创建工作流",
  "questions": [],
  "warnings": [],
  "resourceChanges": [],
  "workflowPlan": {
    "name": "测试工作流",
    "steps": [
      {
        "id": "step_1",
        "goal": "处理输入",
        "kind": "agent",
        "consumes": ["input"],
        "produces": ["result"],
        "resourceRef": "agent:existing_agent"
      }
    ]
  }
}
\`\`\`
  `);
  assert(parsed);
  assert.equal(parsed.summary, '创建工作流');
  assert.equal(parsed.workflowPlan.steps[0].resourceRef, 'agent:existing_agent');
}

await testCatalogRedaction();
testWorkflowPlanCompiler();
testWorkflowPlanCompilerUsesCompiledStepIdsInTemplates();
testValidatorAcceptsCoordinatedWorkflowPlan();
testValidatorRejectsUnsafePlans();
testWorkflowPlanCompilerMergesPipelineConfig();
testValidatorAcceptsPipelineWorkflow();
testValidatorRejectsAdapterMissingConfig();
await testCatalogExposesStepTypesAndEnums();
testChatPlanExtraction();
await testMentionsInferIntentAndSummary();
await testBuildRequestedFallsBackWhenAiReturnsNonJson();
await testAgentPlanIsCoercedWhenAiReturnsWorkflowFields();
await testAgentUpdateIsScopedToReferencedAgent();
await testAgentCreateDropsSkillAndWorkflowChanges();
await testSkillUpdateIsScopedToReferencedSkill();
await testSkillCreateDropsAgentAndWorkflowChanges();
await testWorkflowCreateDefaultsToExistingResourcesOnly();
await testWorkflowCreateCanExplicitlyCreateCapabilities();
await testPlanAnswersAuthorizeResourceCreation();
await testPlanModeReturnsQuestionsBeforeDraft();
await testPlanModeGenerateDraftAfterAnswers();
await testBuildModeProducesArchitectureEvents();
await testBuildFailureCarriesCheckpointLineage();
await testUpdateAgentMergeKeepsExistingBindings();
await testHighRiskBuildRequiresExplicitConfirmation();
await testDuplicateBuildForSamePlanVersionIsRejected();
await testConcurrentBuildForSamePlanVersionOnlyAppliesOnce();
await testBuildFailureRecordsMarkerWithAppliedChanges();

console.log('AI Builder tests passed.');
