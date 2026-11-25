export type ModelInfo = {
  id: string;
  name: string;
  fileName: string;
  url: string;
  /** Exact file size in bytes, used to verify the download finished completely. */
  sizeBytes: number;
};

export const LLAMA_3_2_1B: ModelInfo = {
  id: 'llama-3.2-1b-q4',
  name: 'Llama 3.2 1B Instruct (Q4_K_M)',
  fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  sizeBytes: 807_694_464,
};

// Whisper "small" quantized to 8-bit: much better Arabic than "base", at about half
// the size of the full-precision "small".
export const WHISPER_SMALL_Q8: ModelInfo = {
  id: 'whisper-small-q8',
  name: 'Whisper Small (Q8_0)',
  fileName: 'ggml-small-q8_0.bin',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q8_0.bin',
  sizeBytes: 264_464_607,
};

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
