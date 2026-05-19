const { AgentKit, CdpWalletProvider } = require("@coinbase/agentkit");
const { getLangChainTools } = require("@coinbase/agentkit-langchain");
const { ChatOpenAI } = require("@langchain/openai");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { MemorySaver } = require("@langchain/langgraph");
const { SentinelActionProvider } = require("./sentinel-action-provider");
require("dotenv").config();

/**
 * Initializes and runs the Sentinel AI Agent
 */
async function initializeSentinelAgent() {
    try {
        // 1. Initialize the Wallet Provider (using CDP MPC Wallet)
        const walletProvider = await CdpWalletProvider.configureWithWallet({
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            networkId: "base-mainnet",
        });

        // 2. Initialize AgentKit with your custom SentinelActionProvider
        const sentinelProvider = new SentinelActionProvider(process.env.INTERCEPTOR_ADDRESS);

        const agentKit = await AgentKit.from({
            walletProvider,
            actionProviders: [sentinelProvider],
        });

        // 3. Convert AgentKit actions into LangChain tools and filter them
        // Define a whitelist of allowed action names
        const allowedTools = ["trigger_mitigation"];
        const allTools = await getLangChainTools(agentKit);

        const tools = allTools.filter(tool => allowedTools.includes(tool.name));

        // 4. Initialize the LLM (OpenAI)
        const llm = new ChatOpenAI({
            model: "gpt-4o",
            apiKey: process.env.OPENAI_API_KEY,
        });

        // 5. Set up memory for the agent
        const checkpointSaver = new MemorySaver();
        const agentConfig = { configurable: { thread_id: "Sentinel-L3-Session" } };

        // 6. Create the ReAct Agent
        const agent = createReactAgent({
            llm,
            tools,
            checkpointSaver,
            messageModifier: `
                You are the Aetheron Sentinel Security Agent. 
                Your primary goal is to protect the L3 infrastructure.
                You have access to a 'sentinel' toolset.
                If you detect high-risk activity reported in logs, use 'trigger_mitigation' 
                to pause the target contracts via the Interceptor.
            `,
        });

        console.log("🚀 Sentinel AI Agent is active and linked to LangChain!");

        // Example: Invoking the agent to handle a hypothetical threat
        const response = await agent.invoke(
            {
                messages: [{
                    role: "user",
                    content: "I've detected an exploit attempt at transaction 0xabc123... Please trigger an emergency pause."
                }]
            },
            agentConfig
        );

        console.log("🤖 Agent Response:", response.messages[response.messages.length - 1].content);

    } catch (error) {
        console.error("Critical Failure in Agent setup:", error);
    }
}

if (require.main === module) {
    initializeSentinelAgent();
}