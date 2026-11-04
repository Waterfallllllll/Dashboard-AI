export function playTimerChime(volume: number): void {
  if (volume <= 0 || typeof window === "undefined") {
    return;
  }

  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = Math.min(1, volume) * 0.15;
  oscillator.frequency.value = 880;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  oscillator.onended = () => {
    void context.close();
  };
}
