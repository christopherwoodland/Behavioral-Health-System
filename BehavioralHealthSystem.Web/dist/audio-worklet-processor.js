// AudioWorklet processor for Speech Avatar Service
// Replaces deprecated ScriptProcessorNode

class AudioInputProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1024;
    this.audioLogCounter = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input.length > 0) {
      const inputChannel = input[0]; // Get first channel (mono audio)
      
      if (inputChannel.length > 0) {
        // Calculate audio input levels for monitoring
        let sum = 0;
        let peak = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          const abs = Math.abs(inputChannel[i]);
          sum += abs;
          peak = Math.max(peak, abs);
        }
        const average = sum / inputChannel.length;
        
        // Log audio input test data every 5 process calls (roughly every 100ms)
        this.audioLogCounter++;
        if (this.audioLogCounter % 5 === 0) {
          this.port.postMessage({
            type: 'audioLevel',
            samples: inputChannel.length,
            average: average,
            peak: peak,
            active: peak > 0.01
          });
        }
        
        // Convert Float32 to PCM16 (Int16Array)
        const pcm16Data = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          // Convert from [-1, 1] float to [-32768, 32767] int16
          const sample = Math.max(-1, Math.min(1, inputChannel[i]));
          pcm16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Ensure even byte length for PCM16 format
        const byteLength = pcm16Data.byteLength;
        let audioBuffer;
        
        if (byteLength % 2 !== 0) {
          // Pad with one silent sample if odd byte length
          const paddedData = new Int16Array(pcm16Data.length + 1);
          paddedData.set(pcm16Data);
          paddedData[pcm16Data.length] = 0; // Add silent sample
          audioBuffer = paddedData.buffer;
        } else {
          audioBuffer = pcm16Data.buffer;
        }
        
        // Send processed audio data to main thread
        this.port.postMessage({
          type: 'audioData',
          audioBuffer: audioBuffer
        });
      }
    }
    
    // Keep the processor alive
    return true;
  }
}

registerProcessor('audio-input-processor', AudioInputProcessor);