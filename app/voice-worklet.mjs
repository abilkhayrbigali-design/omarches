// Send short mono PCM blocks to the recognizer, keeping the output silent.
class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(2048);
    this.used = 0;
    this.running = true;
    this.port.onmessage = ({data}) => {
      if (data !== 'finish') return;
      this.running = false;
      if (this.used) this.port.postMessage(this.buffer.slice(0, this.used));
      this.port.postMessage('finished');
    };
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (this.running && channel) {
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.used++] = channel[i];
        if (this.used === this.buffer.length) {
          this.port.postMessage(this.buffer, [this.buffer.buffer]);
          this.buffer = new Float32Array(2048);
          this.used = 0;
        }
      }
    }
    return this.running;
  }
}
registerProcessor('ottisk-voice', VoiceCapture);
