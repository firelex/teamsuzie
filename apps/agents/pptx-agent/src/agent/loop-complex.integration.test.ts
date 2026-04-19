import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { runAgentLoop } from './loop.js';
import { resetState } from '../services/presentation.js';
import { initDocs } from '../services/docs.js';

const tmpDir = path.resolve(import.meta.dirname, '../../output/.test-complex');
const describeIntegration = process.env.PPTX_AGENT_RUN_INTEGRATION_TESTS ? describe : describe.skip;

const AGENTIC_AI_PROMPT = `My job today is to give you an update on agentic AI.

I've been told to assume nothing so apologies to those who already know what I will say - just let me know and I'll change my presentation on the fly.

You all will have used Chat GPT, which it turns out, is no longer the smartest model in the room - give car wash example where Chat GPT recommends walking to the car wash if it's only 15 mins away and the weather is nice (ignoring the fact that you need the car...).  But it's still useful as a daily driver.

Agentic AI goes a step further - a chatbot becomes an agent when it gets access to tools and is smart enough to know how to use them to achieve a particular goal.  While tool use is as old as 2023, it's only in 2025 that model intelligence has gotten to a level where agents became possible.

Agentic AI is super interesting for a couple of reasons:

* If you use a model the traditional way, it just became a lot more powerful - this presentation was drafted by agentic AI.  I gave the input, but the drafting, the design, the layout are all things chosen by AI.  In the world of agentic AI, this is called the human in the lead model.  The human gives the instructions, the agent carries them out.

* But agentic AI goes further:

-- Discuss human in the loop (human verifies before an action is taken) and human on the loop (human verifies after the action)

* Human out of the loop is a wholly different proposition - agents are not capable enough, corporate IT will not embrace this model.

Human in the loop and human on the loop also demand a different deployment model.  Whereas with human in the lead, the human is always the one not only directing, but initiating the request, human in and on the loop can exist in both versions - the human can start the process or the agent can.  The agent can be triggered by external events (webhooks) or at certain intervals (heartbeat).  Now if you add to that things like identity and memory, you have firmly landed in the age of autonomous AI.

You may have heard of OpenClaw, which is an open source framework that does just that - anyone can download it and deploy their own agents.

The OpenClaw founder is a guy called Peter Steinberg, who lives in Vienna and who just got hired by Open AI for around $500M.

OpenClaw has many security issue that will be fixed but that are kind of indicative of what we're dealing with in the future:

* The agent can modify its own code.
* The agent is vulnerable to prompt injection.
* If you let it, the agent can use third-party tools, which may contain malicious code.

We're all working on trying to fix this.  How do you do this?

* You lock the agent into a container.
* You screen incoming emails.
* You don't use third-party tools.

I will demonstrate a side project I'm working on, where I have my own hardened OpenClaw-based agents doing things for me.

I have a personal assistant who reads my emails and alerts me when I need to respond, who even responds in my name.

The assistant also checks my calendar.

The assistant keeps track of what I need to do and what I promised to people and reminds me.

I have a personal paralegal who will draft me agreements and review contracts.

I have a personal IT assistant who checks my Jiras and lets me know if customers are unhappy or I'm at risk of violating my SLAs.

And I have personal sales assistant who will autonomously keep track of my client prospects and research them when their name comes up in the news.

How is this going to end?  Will agents replace humans?

I don't think so.  There will be no artificial general intelligence this decade.  Agents have no understanding and are not creative - but they do a broad range of routine things very well.  So there will be changes but a human will always be needed - for the next 10 years.

Robots will work according to the same principles.  They will be embodied versions of agents.

Before we go into the demo, I want to close on three big questions and one small:

1. What does it mean for Europe?

* We contributed nothing to generative/agentic AI, but we had dumb luck - others, the U.S. and China, did all the work for us, and it so happened that competitive pressures have made very capable models available for very little cost/free.
* We are well-positioned to win the applications race. We have a strong manufacturing and services sector, so if the future is about humans and AI agents working together, Europe is the place to be. We need to embrace agentic AI and work - at all levels - on integrating AI into our processes by giving agents the tools they need to raise the productivity of the humans.

2. What does it mean for how we regulate agents?

* We've historically regulated humans - sometimes based on culpability, sometimes not (such as when a nuclear power station explodes).
* In the future, we need to regulate agents.
* Luckily, models already show a desire not to be turned off (this behavior has been confirmed independently across a number of models).
* We should not train this behavior away, but instead use it as a regulatory hook - if you do something illegal, you'll get turned off.

3. What does it mean for our children?

* If two things are true - the future is one where agents and humans collaborate and models will be more powerful and less expensive - one likely scenario is that we'll see fewer big corporations and more small companies and possibly sole traders, individuals that work with agents and robots to build a business.  Those may not be global businesses (although they could be), but they will thrive and contribute materially to society.

The small one: What can you do locally here in Slovakia?

The good news is you don't need to wait for head office to do anything.  You can buy a Mac Mini and deploy the latest Qwen 3.5 model on it - and you'll have 90% of the firepower.  If you're feeling lucky (or have a kid who does), you download OpenClaw and experiment.  Or you talk to your IT and ask them to make something available in the organization.  Progress through agentic AI comes in small steps, and the good news is you can start today.`;

describeIntegration('agent loop — complex agentic AI presentation (integration)', () => {
    beforeEach(() => {
        resetState();
        process.env.PPTX_AGENT_OUTPUT_DIR = tmpDir;
    });

    afterEach(async () => {
        resetState();
    });

    it('should generate an agentic AI presentation from raw speaker notes', async () => {
        initDocs();

        const result = await runAgentLoop(
            AGENTIC_AI_PROMPT,
            undefined,
            (msg) => console.log(`  ${msg}`),
        );

        expect(result.filePath).toBeTruthy();
        expect(result.slideCount).toBeGreaterThanOrEqual(8);

        const stat = await fs.stat(result.filePath);
        expect(stat.size).toBeGreaterThan(0);

        console.log(`Generated: ${result.filePath} (${result.slideCount} slides, ${(stat.size / 1024).toFixed(1)} KB)`);
    }, 600_000);
});
