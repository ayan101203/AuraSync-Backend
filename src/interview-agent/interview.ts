import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { GoogleGenAI } from '@google/genai';
import { prompt as interviewPrompt } from './prompt';
import { synthesizeSpeech } from '../text-to-speech/tts';

const elevenlabs = new ElevenLabsClient({
	apiKey: process.env.ELEVENLABS_API_KEY,
});

type GeminiResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
};

type GeminiRequestBody = {
	contents: Array<{
		parts: Array<{
			text: string;
		}>;
	}>;
};

const HARDCODED_INTERVIEWER_RESPONSE =
	'Thanks for sharing. Can you walk me through one project where you solved a tough technical problem and what your exact contribution was?';
const DEFAULT_INTERVIEW_TYPE = 'behavioural';
const INTERVIEWER_INTRO =
	"Hi, thanks for joining today. Let's start with a brief introduction about yourself.";

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function normalizeChunk(text: string): string {
	return text.trim().replace(/\s+/g, ' ');
}

function extractTranscriptText(payload: unknown): string {
	if (!payload || typeof payload !== 'object') return '';

	const candidate = payload as {
		text?: string;
		transcript?: string;
		transcripts?: Array<{ text?: string }>;
	};

	if (typeof candidate.text === 'string') return candidate.text;
	if (typeof candidate.transcript === 'string') return candidate.transcript;
	if (Array.isArray(candidate.transcripts)) {
		const merged = candidate.transcripts
			.map((item) => (typeof item?.text === 'string' ? item.text : ''))
			.filter(Boolean)
			.join(' ');
		return merged;
	}

	return '';
}

function getExtensionFromMime(mimeType?: string): string {
	const normalized = mimeType?.toLowerCase() ?? '';
	if (normalized.includes('webm')) return 'webm';
	if (normalized.includes('wav')) return 'wav';
	if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
	if (normalized.includes('ogg')) return 'ogg';
	return 'webm';
}

export async function transcribeAudioWithMime(
	base64Audio: string,
	mimeType = 'audio/webm'
): Promise<string> {
	console.log('[STT] Starting transcription', {
		mimeType,
		base64Length: base64Audio.length,
		hasElevenLabsKey: Boolean(process.env.ELEVENLABS_API_KEY),
	});

	if (!process.env.ELEVENLABS_API_KEY) {
		throw new Error('Missing ELEVENLABS_API_KEY in backend environment.');
	}

	try {
		const audioBuffer = Buffer.from(base64Audio, 'base64');
		if (!audioBuffer.length) {
			throw new Error('Received empty audio chunk.');
		}

		const extension = getExtensionFromMime(mimeType);
		console.log('[STT] Prepared audio buffer', {
			bytes: audioBuffer.length,
			extension,
		});

		const audioFile = new File([audioBuffer], `chunk.${extension}`, {
			type: mimeType || 'audio/webm',
		});

		const sttResponse = await elevenlabs.speechToText.convert({
			modelId: 'scribe_v2',
			file: audioFile,
			fileFormat: 'other',
		});

		const transcript = normalizeChunk(extractTranscriptText(sttResponse));
		console.log('[STT] Transcription completed', {
			transcriptLength: transcript.length,
			transcriptPreview: transcript.slice(0, 160),
		});

		return transcript;
	} catch (error) {
		console.error('[STT] Transcription failed', {
			mimeType,
			error: toErrorMessage(error),
		});
		throw error;
	}
}
function extractGeminiText(data: GeminiResponse): string {
	return (
		data.candidates?.[0]?.content?.parts
			?.map((part) => part.text ?? '')
			.join('')
			.trim() ?? ''
	);
}

async function requestGemini(requestBody: GeminiRequestBody): Promise<GeminiResponse> {
	const apiKey = process.env.GEMINI_API_KEY?.trim();

	if (!apiKey) {
		return {
			candidates: [{ content: { parts: [{ text: HARDCODED_INTERVIEWER_RESPONSE }] } }],
		};
	}
	
	const ai = new GoogleGenAI({ apiKey });
	const contents = requestBody.contents.map((c) => ({
		role: 'user' as const,
		parts: c.parts.map((p) => ({ text: p.text })),
	}));

	console.log('[Gemini] Dispatching request', {
		model: 'gemini-2.0-flash-lite',
		contentBlocks: contents.length,
		partCount: contents.reduce((acc, item) => acc + item.parts.length, 0),
	});

	let response: { text?: string };
	try {
		response = await ai.models.generateContent({
			model: 'gemini-2.0-flash-lite',
			contents,
		});
		console.log('[Gemini] Response received', {
			responseTextLength: (response.text ?? '').length,
		});
	} catch (error) {
		console.error('[Gemini] Request failed', {
			error: toErrorMessage(error),
		});
		throw error;
	}

	return {
		candidates: [
			{
				content: {
					parts: [{ text: response.text ?? '' }],
				},
			},
		],
	};
}

async function generateInterviewerResponse(
	transcriptText: string,
	jobDescription?: string,
	lastInterviewerAnswer?: string,
	interviewType?: string
): Promise<string> {
	const previousInterviewerAnswer =
		typeof lastInterviewerAnswer === 'string' && lastInterviewerAnswer.trim()
			? lastInterviewerAnswer.trim()
			: INTERVIEWER_INTRO;

	const normalizedInterviewType =
		typeof interviewType === 'string' && interviewType.trim()
			? interviewType.trim().toLowerCase()
			: DEFAULT_INTERVIEW_TYPE;

	const jdSection =
		typeof jobDescription === 'string' && jobDescription.trim()
			? `Job description:\n${jobDescription.trim()}\n\n`
			: '';

	const requestBody: GeminiRequestBody = {
		contents: [
			{
				parts: [
					{
						text: `${interviewPrompt}\n\nInterview type: ${normalizedInterviewType}\n\n${jdSection}Previous interviewer message:\n${previousInterviewerAnswer}\n\nCandidate response:\n${transcriptText || 'No transcript captured.'}\n\nReturn exactly one concise next interviewer question only.`,
					},
				],
			},
		],
	};

	const outgoingPrompt = requestBody.contents[0]?.parts[0]?.text ?? '';
	console.log('[Gemini] Sending prompt payload', {
		interviewType: normalizedInterviewType,
		jobDescriptionIncluded: Boolean(jdSection),
		previousInterviewerMessageLength: previousInterviewerAnswer.length,
		candidateResponseLength: (transcriptText || '').length,
		promptLength: outgoingPrompt.length,
		prompt: outgoingPrompt,
	});

	try {
		const data = await requestGemini(requestBody);
		const generated = extractGeminiText(data);
		console.log('[Gemini] Generated interviewer response', {
			generatedLength: generated.length,
			generatedPreview: generated.slice(0, 160),
		});
		return generated || HARDCODED_INTERVIEWER_RESPONSE;
	} catch (error) {
		console.error('[Gemini] Falling back to hardcoded interviewer response', {
			error: toErrorMessage(error),
		});
		return HARDCODED_INTERVIEWER_RESPONSE;
	}
}

// Text-only path: skip STT entirely (used when browser Web Speech API handles transcription)
export async function processTextRequest(
	transcript: string,
	jobDescription?: string,
	lastInterviewerAnswer?: string,
	interviewType?: string
): Promise<{ text: string; aiText: string; aiAudioBase64: string }> {
	const aiText = await generateInterviewerResponse(
		transcript,
		jobDescription,
		lastInterviewerAnswer,
		interviewType
	);
	return { text: transcript, aiText, aiAudioBase64: '' };
}

export async function processInterviewRequest(
	base64Audio: string,
	jobDescription?: string,
	mimeType?: string,
	lastInterviewerAnswer?: string,
	interviewType?: string
): Promise<{ text: string; aiText: string; aiAudioBase64: string }> {
	console.log('[Interview] Processing request', {
		audioBase64Length: base64Audio.length,
		mimeType: mimeType ?? 'audio/webm',
		hasJobDescription: Boolean(jobDescription?.trim()),
		hasLastInterviewerAnswer: Boolean(lastInterviewerAnswer?.trim()),
		interviewType: interviewType ?? DEFAULT_INTERVIEW_TYPE,
	});

	try {
		const text = await transcribeAudioWithMime(base64Audio, mimeType);
		const aiText = await generateInterviewerResponse(
			text,
			jobDescription,
			lastInterviewerAnswer,
			interviewType
		);

		console.log('[TTS] About to synthesize AI response', {
			aiTextLength: aiText.length,
			aiTextPreview: aiText.slice(0, 160),
		});

		const aiAudioBuffer = await synthesizeSpeech(aiText);
		console.log('[Interview] Request processing completed', {
			transcriptLength: text.length,
			aiTextLength: aiText.length,
			aiAudioBytes: aiAudioBuffer.length,
		});

		return {
			text,
			aiText,
			aiAudioBase64: aiAudioBuffer.toString('base64'),
		};
	} catch (error) {
		console.error('[Interview] Request processing failed', {
			error: toErrorMessage(error),
		});
		throw error;
	}
}