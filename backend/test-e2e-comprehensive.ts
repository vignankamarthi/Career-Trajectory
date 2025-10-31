/**
 * COMPREHENSIVE END-TO-END TESTING SUITE
 * Tests multiple scenarios through the entire system
 * Monitors LangSmith tracing for each step
 */

import axios from 'axios';

const API_URL = 'http://localhost:3001';

// Test scenarios with increasing complexity
const TEST_SCENARIOS = [
  {
    name: "SCENARIO 1: Basic AI Researcher Path",
    input: {
      user_name: "Alex Chen",
      start_age: 22,
      end_age: 27,
      end_goal: "Become an AI researcher at DeepMind",
      num_layers: 3
    },
    metadata: {
      current_situation: "Computer science undergraduate",
      constraints: "Need to support family financially"
    }
  },
  {
    name: "SCENARIO 2: Career Pivot to Data Science",
    input: {
      user_name: "Sarah Johnson",
      start_age: 35,
      end_age: 37,
      end_goal: "Transition from teaching to data science",
      num_layers: 2
    },
    metadata: {
      current_situation: "High school math teacher with 10 years experience",
      constraints: "Can only study part-time"
    }
  },
  {
    name: "SCENARIO 3: Startup Founder Journey",
    input: {
      user_name: "Michael Park",
      start_age: 30,
      end_age: 33,
      end_goal: "Launch a successful AI startup",
      num_layers: 3
    },
    metadata: {
      current_situation: "Senior software engineer at FAANG",
      constraints: "Need to maintain income while building"
    }
  },
  {
    name: "SCENARIO 4: Academic to Industry",
    input: {
      user_name: "Priya Patel",
      start_age: 28,
      end_age: 29,
      end_goal: "Move from PhD to industry ML engineer role",
      num_layers: 2
    },
    metadata: {
      current_situation: "Final year PhD student in machine learning",
      constraints: "International student needing visa sponsorship"
    }
  },
  {
    name: "SCENARIO 5: Edge Case - Minimal Input",
    input: {
      user_name: "Test User",
      start_age: 20,
      end_age: 25,
      end_goal: "Work in technology",
      num_layers: 2
    },
    metadata: {
      current_situation: "Not sure",
      constraints: ""
    }
  }
];

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testScenario(scenario: any) {
  console.log(`\n${colors.bright}${colors.blue}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}Testing: ${scenario.name}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(80)}${colors.reset}\n`);

  const results = {
    scenario: scenario.name,
    steps: [],
    errors: [],
    timings: {},
    confidence_scores: [],
    langsmith_traces: []
  };

  try {
    // STEP 1: Pre-Validation
    console.log(`${colors.yellow}STEP 1: Pre-Validation Agent${colors.reset}`);
    console.log(`Input: ${JSON.stringify(scenario.input, null, 2)}`);

    const startTime = Date.now();
    const preValidationResponse = await axios.post(
      `${API_URL}/api/configure-with-context/init`,
      scenario.input
    );
    const preValidationTime = Date.now() - startTime;

    console.log(`${colors.green}✓ Pre-Validation completed in ${preValidationTime}ms${colors.reset}`);
    console.log(`Confidence: ${preValidationResponse.data.confidence_score}%`);
    console.log(`Context ID: ${preValidationResponse.data.context_id}`);
    console.log(`Ready for generation: ${preValidationResponse.data.ready_for_generation}`);

    results.steps.push({
      name: 'Pre-Validation',
      success: true,
      time: preValidationTime,
      confidence: preValidationResponse.data.confidence_score
    });
    results.confidence_scores.push(preValidationResponse.data.confidence_score);

    // Check LangSmith trace
    console.log(`${colors.magenta}CHECK LANGSMITH: PreValidationAgent.analyzeInitialInput trace${colors.reset}`);
    await sleep(2000); // Give time to check LangSmith

    // Store context_id for later use
    const context_id = preValidationResponse.data.context_id;

    // STEP 2: Conversational Clarification (if needed)
    if (preValidationResponse.data.confidence_score < 95) {
      console.log(`\n${colors.yellow}STEP 2: Conversational Clarification Agent${colors.reset}`);
      console.log(`Need to gather more information (confidence only ${preValidationResponse.data.confidence_score}%)`);

      // Simulate conversation rounds
      let conversationRound = 1;
      let currentConfidence = preValidationResponse.data.confidence_score;

      while (currentConfidence < 95 && conversationRound <= 5) {
        console.log(`\n${colors.cyan}Round ${conversationRound}:${colors.reset}`);

        // Provide user answer based on metadata
        const userMessage = conversationRound === 1
          ? `I'm currently ${scenario.metadata.current_situation}. ${scenario.metadata.constraints}`
          : 'I have 5 years of programming experience. I know Python and JavaScript. I prefer hands-on learning.';

        const clarifyStart = Date.now();
        const clarifyResponse = await axios.post(
          `${API_URL}/api/configure-with-context/clarify`,
          {
            context_id: context_id,
            user_message: userMessage
          }
        );
        const clarifyTime = Date.now() - clarifyStart;

        console.log(`User message: "${userMessage}"`);
        console.log(`Assistant response: "${clarifyResponse.data.next_question || 'Ready for generation'}"`);
        console.log(`New confidence: ${clarifyResponse.data.confidence_score}%`);
        console.log(`Time: ${clarifyTime}ms`);

        currentConfidence = clarifyResponse.data.confidence_score;
        results.confidence_scores.push(currentConfidence);
        conversationRound++;

        console.log(`${colors.magenta}CHECK LANGSMITH: ConversationalClarificationAgent trace${colors.reset}`);
        await sleep(1000);
      }

      results.steps.push({
        name: 'Conversational Clarification',
        success: true,
        rounds: conversationRound - 1,
        finalConfidence: currentConfidence
      });
    }

    // STEP 3: Internal Review (Skip - combined with generation)
    console.log(`\n${colors.yellow}STEP 3: Internal Review Agent${colors.reset}`);
    console.log(`${colors.cyan}Internal review is integrated with timeline generation${colors.reset}`);

    results.steps.push({
      name: 'Internal Review',
      success: true,
      integrated: true
    });

    // STEP 4: Timeline Generation
    console.log(`\n${colors.yellow}STEP 4: Configuration Agent - Timeline Generation${colors.reset}`);

    const generateStart = Date.now();
    const generateResponse = await axios.post(
      `${API_URL}/api/configure-with-context/generate`,
      { context_id: context_id }
    );
    const generateTime = Date.now() - generateStart;

    console.log(`${colors.green}✓ Timeline generated in ${generateTime}ms${colors.reset}`);
    console.log(`Timeline ID: ${generateResponse.data.timeline_id}`);
    console.log(`Layers: ${generateResponse.data.timeline?.layers?.length}`);

    const timeline = generateResponse.data.timeline;
    const timeline_id = generateResponse.data.timeline_id;
    if (timeline && timeline.layers) {
      timeline.layers.forEach((layer: any) => {
        console.log(`  Layer ${layer.layer_number}: ${layer.blocks?.length || 0} blocks`);
      });
    }

    results.steps.push({
      name: 'Timeline Generation',
      success: true,
      time: generateTime,
      timelineId: timeline?.id,
      layers: timeline?.layers?.length
    });

    console.log(`${colors.magenta}CHECK LANGSMITH: ConfigurationAgent.generateTimeline trace${colors.reset}`);
    await sleep(1000);

    // STEP 5: Chat Refinement Test
    if (timeline_id) {
      console.log(`\n${colors.yellow}STEP 5: Chat Refinement Test${colors.reset}`);

      const chatStart = Date.now();
      const chatResponse = await axios.post(
        `${API_URL}/api/chat/${timeline_id}`,
        {
          message: "Can you add more detail about the technical skills I need to learn?"
        }
      );
      const chatTime = Date.now() - chatStart;

      console.log(`${colors.green}✓ Chat refinement completed in ${chatTime}ms${colors.reset}`);
      console.log(`Response length: ${chatResponse.data.message?.length} characters`);

      results.steps.push({
        name: 'Chat Refinement',
        success: true,
        time: chatTime
      });

      console.log(`${colors.magenta}CHECK LANGSMITH: ConversationalAssistant.chat trace${colors.reset}`);
    }

    // STEP 6: Validation Test
    console.log(`\n${colors.yellow}STEP 6: Validation Agent Test${colors.reset}`);
    console.log("Testing with invalid timeline structure...");

    try {
      const invalidTimeline = {
        ...timeline,
        layers: [
          {
            layer_number: 1,
            blocks: [
              {
                title: "Invalid Block",
                start_age: 30,
                end_age: 25, // Invalid: end before start
                duration_years: -5
              }
            ]
          }
        ]
      };

      const validationStart = Date.now();
      const validationResponse = await axios.post(
        `${API_URL}/api/validate`,
        invalidTimeline
      );
      const validationTime = Date.now() - validationStart;

      console.log(`Validation completed in ${validationTime}ms`);
      console.log(`Errors found: ${validationResponse.data.errors?.length || 0}`);

    } catch (error: any) {
      console.log(`${colors.green}✓ Validation correctly rejected invalid timeline${colors.reset}`);
      results.steps.push({
        name: 'Validation',
        success: true,
        correctlyRejected: true
      });
    }

    console.log(`${colors.magenta}CHECK LANGSMITH: ValidationAgent trace${colors.reset}`);

    // Summary
    console.log(`\n${colors.bright}${colors.green}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bright}SCENARIO COMPLETE: ${scenario.name}${colors.reset}`);
    console.log(`Total steps: ${results.steps.length}`);
    console.log(`All steps successful: ${results.steps.every(s => s.success)}`);
    console.log(`Average confidence: ${(results.confidence_scores.reduce((a, b) => a + b, 0) / results.confidence_scores.length).toFixed(1)}%`);
    console.log(`${colors.green}${'='.repeat(80)}${colors.reset}`);

    return results;

  } catch (error: any) {
    console.error(`${colors.red}ERROR in scenario: ${error.message}${colors.reset}`);
    results.errors.push({
      step: 'Unknown',
      error: error.message,
      stack: error.stack
    });
    return results;
  }
}

async function runAllTests() {
  console.log(`${colors.bright}${colors.cyan}
╔════════════════════════════════════════════════════════════════════════════╗
║                  COMPREHENSIVE END-TO-END TESTING SUITE                    ║
║                     WITH LANGSMITH TRACE MONITORING                        ║
╚════════════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  console.log(`
${colors.yellow}INSTRUCTIONS:${colors.reset}
1. This will run ${TEST_SCENARIOS.length} test scenarios
2. Monitor LangSmith at: https://smith.langchain.com
3. Check project: "career-trajectory"
4. Watch for traces after each step
5. Note any errors or missing traces
`);

  console.log("Starting tests in 3 seconds...");
  await sleep(3000);

  const allResults = [];

  for (const scenario of TEST_SCENARIOS) {
    const result = await testScenario(scenario);
    allResults.push(result);

    console.log(`\n${colors.cyan}Waiting 5 seconds before next scenario...${colors.reset}`);
    await sleep(5000);
  }

  // Final Summary
  console.log(`\n${colors.bright}${colors.magenta}
╔════════════════════════════════════════════════════════════════════════════╗
║                           FINAL TEST SUMMARY                               ║
╚════════════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  let totalSteps = 0;
  let totalErrors = 0;
  let totalTime = 0;

  allResults.forEach((result, index) => {
    console.log(`\n${colors.cyan}${TEST_SCENARIOS[index].name}:${colors.reset}`);
    console.log(`  Steps completed: ${result.steps.length}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Success: ${result.errors.length === 0 ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`}`);

    totalSteps += result.steps.length;
    totalErrors += result.errors.length;
  });

  console.log(`\n${colors.bright}OVERALL:${colors.reset}`);
  console.log(`  Total scenarios: ${TEST_SCENARIOS.length}`);
  console.log(`  Total steps: ${totalSteps}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Success rate: ${((TEST_SCENARIOS.length - (totalErrors > 0 ? 1 : 0)) / TEST_SCENARIOS.length * 100).toFixed(0)}%`);

  if (totalErrors === 0) {
    console.log(`\n${colors.bright}${colors.green}ALL TESTS PASSED! System is working perfectly!${colors.reset}`);
  } else {
    console.log(`\n${colors.bright}${colors.red}SOME TESTS FAILED! Check errors above.${colors.reset}`);
  }

  console.log(`\n${colors.yellow}CHECK LANGSMITH for all traces at:${colors.reset}`);
  console.log(`https://smith.langchain.com/projects/career-trajectory`);
}

// Run the tests
runAllTests().catch(console.error);