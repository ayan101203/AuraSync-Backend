import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  console.log('[TTS] Starting speech synthesis', {
    inputLength: text.length,
    hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
  });

  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('Missing ELEVENLABS_API_KEY in backend environment.');
  }

  const normalized = text.trim();
  if (!normalized) {
    throw new Error('Cannot synthesize empty text.');
  }

  try {
    const audioStream = await elevenlabs.textToSpeech.convert(
      'JBFqnCBsd6RMkjVDRZzb',
      {
        text: normalized,
        modelId: 'eleven_v3',
        outputFormat: 'mp3_44100_128',
      }
    );

    const chunks: Buffer[] = [];

    // ElevenLabs SDK returns an async iterable, not a Web ReadableStream
    for await (const chunk of audioStream as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }

    const audioBuffer = Buffer.concat(chunks);
    console.log('[TTS] Speech synthesis completed', {
      outputBytes: audioBuffer.length,
      chunkCount: chunks.length,
    });

    return audioBuffer;
  } catch (error) {
    console.error('[TTS] Speech synthesis failed', {
      normalizedInputLength: normalized.length,
      error: toErrorMessage(error),
    });
    throw error;
  }
}