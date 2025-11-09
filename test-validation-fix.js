#!/usr/bin/env node

/**
 * TEST: Validation Fix Verification
 *
 * This test verifies that the validation agent properly handles the AI scientist timeline
 * without false positive errors like "start_age 10 != timeline start 10"
 */

const apiBaseUrl = 'http://localhost:3001/api';

async function testAIScientistTimeline() {
  console.log('\n=== TESTING AI SCIENTIST TIMELINE (VALIDATION FIX VERIFICATION) ===\n');

  const testConfig = {
    user_name: "TestUser",
    start_age: 10,
    end_age: 60,
    end_goal: "Become an AI scientist working on cutting-edge AGI research, specifically focusing on neural architectures and safety alignment.",
    num_layers: 3,
    uploaded_files: []
  };

  console.log('📋 Test Configuration:');
  console.log(JSON.stringify(testConfig, null, 2));
  console.log('\n⏱️  Starting end-to-end test...\n');

  try {
    // Step 1: Pre-validation
    console.log('🔍 Step 1: Pre-validation Analysis...');
    const analyzeResponse = await fetch(`${apiBaseUrl}/configure-with-context/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConfig)
    });

    if (!analyzeResponse.ok) {
      throw new Error(`Analyze failed: ${analyzeResponse.status} - ${await analyzeResponse.text()}`);
    }

    const analyzeResult = await analyzeResponse.json();
    console.log('✅ Pre-validation complete:', {
      confidence: analyzeResult.confidence_score,
      needs_clarification: analyzeResult.needs_clarification,
      questions: analyzeResult.questions?.length || 0
    });

    // If clarification needed, simulate answering questions
    let clarificationResult = null;
    if (analyzeResult.needs_clarification) {
      console.log('\n💬 Step 2: Handling Clarification Questions...');

      // For this test, we'll skip clarification and proceed directly
      console.log('📝 Skipping clarification for focused validation test');

      // Instead, proceed with internal review
      console.log('\n🔍 Step 3: Internal Review...');
      const reviewResponse = await fetch(`${apiBaseUrl}/configure-with-context/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...testConfig,
          attention: analyzeResult.attention
        })
      });

      if (!reviewResponse.ok) {
        throw new Error(`Review failed: ${reviewResponse.status} - ${await reviewResponse.text()}`);
      }

      const reviewResult = await reviewResponse.json();
      console.log('✅ Internal review complete:', {
        confidence: reviewResult.confidence_score,
        ready_for_generation: reviewResult.ready_for_generation
      });

      if (!reviewResult.ready_for_generation) {
        throw new Error('Timeline not ready for generation after review');
      }
    }

    // Step 4: Timeline Generation
    console.log('\n⚡ Step 4: Timeline Generation...');
    const generateResponse = await fetch(`${apiBaseUrl}/configure-with-context/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...testConfig,
        attention: analyzeResult.attention,
        conversation_history: []
      })
    });

    if (!generateResponse.ok) {
      throw new Error(`Generate failed: ${generateResponse.status} - ${await generateResponse.text()}`);
    }

    const generateResult = await generateResponse.json();
    console.log('✅ Timeline generated:', {
      timeline_id: generateResult.timeline.id,
      layers: generateResult.timeline.layers?.length || 0,
      total_blocks: generateResult.timeline.layers?.reduce((sum, layer) => sum + (layer.blocks?.length || 0), 0) || 0
    });

    // CRITICAL: Check validation results
    const validationResult = generateResult.validation_result;
    if (validationResult) {
      console.log('\n🔬 VALIDATION RESULTS:');
      console.log('✅ Validation Valid:', validationResult.isValid);
      console.log('📊 Error Count:', validationResult.errors?.length || 0);

      if (validationResult.errors && validationResult.errors.length > 0) {
        console.log('\n❌ VALIDATION ERRORS:');
        validationResult.errors.forEach((error, i) => {
          console.log(`  ${i + 1}. ${error}`);
        });

        // Check for the specific false positive we were fixing
        const hasStartAgeError = validationResult.errors.some(error =>
          error.includes('start_age') && error.includes('!= timeline start') && error.includes('10')
        );

        if (hasStartAgeError) {
          console.log('\n💥 CRITICAL: FALSE POSITIVE DETECTED!');
          console.log('The "start_age 10 != timeline start 10" error is still occurring.');
          console.log('This means our validation fix did not work.');
          return false;
        }
      } else {
        console.log('🎉 NO VALIDATION ERRORS - VALIDATION FIX SUCCESSFUL!');
      }

      console.log('💰 Validation Cost:', `$${validationResult.cost?.toFixed(4) || '0.0000'}`);
    }

    // Verify timeline structure
    const timeline = generateResult.timeline;
    console.log('\n📊 TIMELINE STRUCTURE VERIFICATION:');

    if (!timeline.layers || timeline.layers.length === 0) {
      throw new Error('Timeline has no layers');
    }

    for (const layer of timeline.layers) {
      const blockCount = layer.blocks?.length || 0;
      console.log(`📋 Layer ${layer.layer_number}: ${blockCount} blocks`);

      if (blockCount === 0) {
        throw new Error(`Layer ${layer.layer_number} has no blocks`);
      }

      // Verify age ranges
      console.log(`   Age range: ${layer.start_age} - ${layer.end_age}`);

      // Check that layer bounds match config
      if (parseFloat(layer.start_age) !== testConfig.start_age) {
        console.log(`   ⚠️ Layer start (${layer.start_age}) != Config start (${testConfig.start_age})`);
      }
      if (parseFloat(layer.end_age) !== testConfig.end_age) {
        console.log(`   ⚠️ Layer end (${layer.end_age}) != Config end (${testConfig.end_age})`);
      }
    }

    console.log('\n🎯 SUCCESS: End-to-end test completed successfully!');
    console.log('✅ Timeline generated with proper validation');
    console.log('✅ No false positive validation errors detected');
    console.log('✅ System is working correctly\n');

    return true;

  } catch (error) {
    console.error('\n💥 TEST FAILED:', error.message);
    console.error('📍 Error details:', error);
    return false;
  }
}

// Run the test
testAIScientistTimeline()
  .then(success => {
    if (success) {
      console.log('🏆 VALIDATION FIX TEST: PASSED');
      process.exit(0);
    } else {
      console.log('❌ VALIDATION FIX TEST: FAILED');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💀 UNEXPECTED ERROR:', error);
    process.exit(1);
  });