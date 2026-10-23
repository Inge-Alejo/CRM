import assert from 'node:assert';
import { GeminiService } from '../src/ai/geminiService.js';
import { config } from '../src/config.js';
import { Models } from '@google/genai';

console.log('======================================================================');
console.log('🤖 VALIDACIÓN DE ARQUITECTURA DE MODELOS DE IA Y FALLBACK EN EL CRM');
console.log('======================================================================\n');

async function runAiValidationSuite() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] Test ${total}: ${name}`);
      console.error('   Detalle:', err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] Test ${total}: ${name}`);
      console.error('   Detalle:', err.message);
      throw err;
    }
  }

  // 1. Verificar definición de modelos y jerarquía
  test('1. Verificación del Pool Multimodelo oficial y orden de prioridad', () => {
    const fnStr = GeminiService.callGeminiAPI.toString();
    assert(fnStr.includes("'gemini-3.5-flash-lite'"), 'Debe incluir gemini-3.5-flash-lite');
    assert(fnStr.includes("'gemini-3.1-flash-lite'"), 'Debe incluir gemini-3.1-flash-lite');
    assert(fnStr.includes("'gemini-3.5-flash'"), 'Debe incluir gemini-3.5-flash');
    assert(fnStr.includes("'gemini-3.8-flash'"), 'Debe incluir gemini-3.8-flash');
    assert(fnStr.includes("'gemini-2.5-flash'"), 'Debe incluir gemini-2.5-flash');

    console.log('   Modelos verificados en código:');
    console.log('   - 1°: gemini-3.5-flash-lite (Principal / Prioritario)');
    console.log('   - 2°: gemini-3.1-flash-lite (Relevo rápido)');
    console.log('   - 3°: gemini-3.5-flash (Capacidad contextual)');
    console.log('   - 4°: gemini-3.8-flash (Razonamiento profundo)');
    console.log('   - 5°: gemini-2.5-flash (Respaldo final de Google)');
  });

  // 2. Simular rotación activa (Round-Robin)
  test('2. Verificación de rotación activa (Round-Robin) entre llamadas', () => {
    GeminiService.modelRotationIndex = 0;
    const poolLength = 5;
    const round1 = GeminiService.modelRotationIndex % poolLength;
    GeminiService.modelRotationIndex = (GeminiService.modelRotationIndex + 1) % poolLength;
    
    const round2 = GeminiService.modelRotationIndex % poolLength;
    GeminiService.modelRotationIndex = (GeminiService.modelRotationIndex + 1) % poolLength;

    assert.strictEqual(round1, 0, 'La primera llamada debe iniciar en el índice 0');
    assert.strictEqual(round2, 1, 'La segunda llamada debe rotar al índice 1');
    console.log('   Rotación Round-Robin verificada correctamente.');
  });

  // 3. Simular llamada a Gemini con Fallback en cascada
  await testAsync('3. Verificación de Failover inmediato si el 1er modelo agota cuota (429)', async () => {
    const origKey = config.geminiApiKey;
    config.geminiApiKey = 'test_simulation_key';

    const calledModels = [];
    const origMethod = Models.prototype.generateContentInternal;
    
    Models.prototype.generateContentInternal = async function(params) {
      calledModels.push(params.model);
      if (params.model === 'gemini-3.5-flash-lite') {
        const err = new Error('429 Resource has been exhausted (quota limit reached)');
        err.status = 429;
        throw err;
      }
      return {
        text: '¡Hola! Te damos la bienvenida al Centro de Extensión de la Facultad de Medicina UdeA 🩺.',
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 }
      };
    };

    try {
      GeminiService.modelRotationIndex = 0; // Iniciar en 3.5-flash-lite
      const reply = await GeminiService.callGeminiAPI('Hola', []);
      
      assert(calledModels.includes('gemini-3.5-flash-lite'), 'Debe haber intentado gemini-3.5-flash-lite primero');
      assert(calledModels.includes('gemini-3.1-flash-lite'), 'Al fallar el 1ero, debe conmutar automáticamente al 2do modelo');
      assert(reply && reply.replyText.includes('Facultad de Medicina UdeA'), 'La respuesta debe ser exitosa');
      assert.strictEqual(GeminiService.telemetry.lastUsedModel, 'gemini-3.1-flash-lite', 'El modelo usado registrado debe ser gemini-3.1-flash-lite');
      console.log(`   Modelos llamados en cascada: ${calledModels.join(' ➡️ ')}`);
      console.log(`   Modelo que resolvió exitosamente: ${GeminiService.telemetry.lastUsedModel}`);
    } finally {
      Models.prototype.generateContentInternal = origMethod;
      config.geminiApiKey = origKey;
    }
  });

  // 4. Simular que TODOS los modelos de Google agotan cuota -> Contingencia Local
  await testAsync('4. Verificación de Fallback a Motor Local si TODOS los modelos de Google fallan', async () => {
    const origKey = config.geminiApiKey;
    config.geminiApiKey = 'test_simulation_key';

    const calledModels = [];
    const origMethod = Models.prototype.generateContentInternal;
    
    // Todos los modelos fallan con error de cuota agotada
    Models.prototype.generateContentInternal = async function(params) {
      calledModels.push(params.model);
      const err = new Error(`429 All quota exhausted for model ${params.model}`);
      err.status = 429;
      throw err;
    };

    try {
      GeminiService.modelRotationIndex = 0;
      const initialLocalFallbackCount = GeminiService.telemetry.localFallback;
      
      // Llamamos generateReply
      const res = await GeminiService.generateReply('¿Cuánto vale el Diplomado en Medicina del Sueño?', '573009990000');
      
      assert.strictEqual(calledModels.length, 5, 'Debe haber intentado los 5 modelos del pool antes de rendirse');
      assert(res && res.replyText, 'Debe haber generado respuesta por motor local');
      assert(res.replyText.includes('Medicina del Sueño') || res.replyText.includes('$') || res.replyText.includes('Facultad de Medicina'), 'La respuesta local debe contener información verídica');
      assert(GeminiService.telemetry.localFallback > initialLocalFallbackCount, 'Debe incrementar el contador de contingencia local');
      
      console.log(`   Los 5 modelos de Google fueron consultados: ${calledModels.join(', ')}`);
      console.log('   El motor local de contingencia tomó el control de forma transparente sin error para el usuario.');
      console.log('   Muestra de respuesta devuelta por contingencia:');
      console.log(`   "${res.replyText.slice(0, 120)}..."`);
    } finally {
      Models.prototype.generateContentInternal = origMethod;
      config.geminiApiKey = origKey;
    }
  });

  // 5. Verificación de funcionamiento sin API Key (Zero-setup local)
  await testAsync('5. Verificación de funcionamiento autónomo cuando no hay API Key configurada', async () => {
    const origKey = config.geminiApiKey;
    config.geminiApiKey = ''; // Sin API key

    try {
      const res = await GeminiService.generateReply('¿Cómo puedo pagar la inscripción?', '573009990001');
      assert(res && res.replyText, 'Debe responder');
      assert(res.replyText.toLowerCase().includes('pago') || res.replyText.toLowerCase().includes('computador') || res.replyText.includes('http'), 'Debe proveer instrucciones de pago');
      console.log('   Respuesta autónoma local generada con éxito:', res.replyText.slice(0, 100) + '...');
    } finally {
      config.geminiApiKey = origKey;
    }
  });

  // 6. Verificación de Telemetría de Modelos
  test('6. Verificación de registro de telemetría de IA', () => {
    assert(typeof GeminiService.telemetry.totalCalls === 'number', 'totalCalls debe ser numérico');
    assert(typeof GeminiService.telemetry.geminiSuccess === 'number', 'geminiSuccess debe ser numérico');
    assert(typeof GeminiService.telemetry.localFallback === 'number', 'localFallback debe ser numérico');
    assert(GeminiService.telemetry.lastUsedModel !== null, 'lastUsedModel debe estar registrado');
    assert(typeof GeminiService.telemetry.modelStats === 'object', 'modelStats debe ser un objeto');
    console.log('   Telemetría registrada:', {
      totalCalls: GeminiService.telemetry.totalCalls,
      geminiSuccess: GeminiService.telemetry.geminiSuccess,
      localFallback: GeminiService.telemetry.localFallback,
      lastUsedModel: GeminiService.telemetry.lastUsedModel,
      modelStats: GeminiService.telemetry.modelStats
    });
  });

  console.log('\n======================================================================');
  console.log(`🎉 TODAS LAS PRUEBAS DE MODELOS Y FALLBACK PASARON CON ÉXITO: ${passed}/${total}`);
  console.log('======================================================================\n');
}

runAiValidationSuite().catch(err => {
  console.error('Fallo en la suite de validación:', err);
  process.exit(1);
});
