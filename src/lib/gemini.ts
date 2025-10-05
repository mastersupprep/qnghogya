const GEMINI_API_KEYS = (import.meta.env.VITE_GEMINI_API_KEYS || '').split(',').filter(key => key.trim());

if (GEMINI_API_KEYS.length === 0) {
  console.error('No Gemini API keys found!');
}
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

let currentKeyIndex = 0;

function getNextApiKey(): string {
  const key = GEMINI_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % GEMINI_API_KEYS.length;
  return key;
}

export interface GeneratedQuestion {
  question_statement: string;
  options?: string[];
  answer: string;
  solution: string;
  question_type: 'MCQ' | 'MSQ' | 'NAT' | 'SUB';
}

export interface QuestionContext {
  examName: string;
  courseName: string;
  subjectName: string;
  topicName: string;
}

async function callGeminiAPI(prompt: string, retryCount = 0): Promise<string> {
  if (retryCount >= GEMINI_API_KEYS.length) {
    throw new Error('All API keys failed. Please check your Gemini API configuration.');
  }

  const apiKey = getNextApiKey();

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Key ${retryCount + 1} failed:`, errorText);
      return callGeminiAPI(prompt, retryCount + 1);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(`API Key ${retryCount + 1} error:`, error);
    return callGeminiAPI(prompt, retryCount + 1);
  }
}

export async function generateQuestion(
  questionType: string,
  topicId: string,
  existingQuestions: string[],
  alreadyGeneratedQuestions: string[],
  context: QuestionContext
): Promise<GeneratedQuestion> {
  const prompt = buildQuestionPrompt(questionType, existingQuestions, alreadyGeneratedQuestions, context);
  const generatedText = await callGeminiAPI(prompt);
  const question = parseGeneratedQuestion(generatedText, questionType);

  const isValid = await verifyAnswer(question, context);
  if (!isValid) {
    console.log('Answer verification failed, regenerating...');
    return generateQuestion(questionType, topicId, existingQuestions, alreadyGeneratedQuestions, context);
  }

  return question;
}

export async function generatePYQSolution(
  questionStatement: string,
  questionType: string,
  options: string[] | null,
  context: QuestionContext
): Promise<{ answer: string; solution: string }> {
  const prompt = buildPYQSolutionPrompt(questionStatement, questionType, options, context);
  const generatedText = await callGeminiAPI(prompt);
  const result = parsePYQSolution(generatedText, questionType);

  const isValid = await verifyPYQAnswer(questionStatement, result.answer, questionType, options);
  if (!isValid) {
    console.log('PYQ answer verification failed, regenerating...');
    return generatePYQSolution(questionStatement, questionType, options, context);
  }

  return result;
}

function buildQuestionPrompt(
  questionType: string,
  existingQuestions: string[],
  alreadyGeneratedQuestions: string[],
  context: QuestionContext
): string {
  const existingContext = existingQuestions.length > 0
    ? `Here are previous year questions on this topic for inspiration (DO NOT copy directly, use them to understand the concept and difficulty level):\n${existingQuestions.slice(0, 5).join('\n\n')}`
    : '';

  const generatedContext = alreadyGeneratedQuestions.length > 0
    ? `These questions have already been generated for this topic, create something FRESH and UNIQUE:\n${alreadyGeneratedQuestions.slice(-3).join('\n\n')}`
    : '';

  let typeInstructions = '';
  let validationRules = '';

  switch (questionType) {
    case 'MCQ':
      typeInstructions = 'Generate a Multiple Choice Question with 4 options where ONLY ONE option is correct.';
      validationRules = 'CRITICAL: Ensure that EXACTLY ONE option is correct. Double-check your answer.';
      break;
    case 'MSQ':
      typeInstructions = 'Generate a Multiple Select Question with 4 options where ONE OR MORE options can be correct (but at least one must be correct).';
      validationRules = 'CRITICAL: Ensure that AT LEAST ONE option is correct. Multiple correct options are allowed and encouraged when appropriate.';
      break;
    case 'NAT':
      typeInstructions = 'Generate a Numerical Answer Type question where the answer is a specific number (integer or decimal).';
      validationRules = 'CRITICAL: Provide an exact numerical answer. No ranges or approximations.';
      break;
    case 'SUB':
      typeInstructions = 'Generate a Subjective question that requires a detailed descriptive answer.';
      validationRules = 'CRITICAL: Provide a comprehensive answer with proper explanation.';
      break;
  }

  return `You are an expert question creator for ${context.examName} - ${context.courseName} exam.

EXAM CONTEXT:
- Exam: ${context.examName}
- Course: ${context.courseName}
- Subject: ${context.subjectName}
- Topic: ${context.topicName}

IMPORTANT: Create a question that matches the difficulty level and style typical for ${context.examName} ${context.courseName} exam.

${typeInstructions}

${validationRules}

${existingContext}

${generatedContext}

FORMATTING INSTRUCTIONS:
Format your response EXACTLY as follows (do not include any other text):

QUESTION: [write the clear, unambiguous question statement here]
${questionType === 'MCQ' || questionType === 'MSQ' ? `OPTIONS:
A) [option A - make it clear and complete]
B) [option B - make it clear and complete]
C) [option C - make it clear and complete]
D) [option D - make it clear and complete]` : ''}
ANSWER: [${questionType === 'MCQ' ? 'single letter like "A"' : questionType === 'MSQ' ? 'letters separated by commas like "A,C" or single letter like "B"' : questionType === 'NAT' ? 'exact number like "42" or "3.14"' : 'brief but complete answer'}]
SOLUTION: [write detailed step-by-step solution explaining how to arrive at the answer]

QUALITY CHECKLIST:
- Question is clear and unambiguous
- ${questionType === 'MCQ' ? 'Exactly one option is correct' : questionType === 'MSQ' ? 'At least one option is correct' : 'Answer is precise'}
- Solution is detailed and easy to follow
- Difficulty matches ${context.examName} standard`;
}

function buildPYQSolutionPrompt(
  questionStatement: string,
  questionType: string,
  options: string[] | null,
  context: QuestionContext
): string {
  const optionsText = options ? `\n\nOPTIONS:\n${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt}`).join('\n')}` : '';

  let answerFormat = '';
  switch (questionType) {
    case 'MCQ':
      answerFormat = 'Provide the correct option letter (A, B, C, or D)';
      break;
    case 'MSQ':
      answerFormat = 'Provide the correct option letters separated by commas (e.g., "A,C" or just "B" if only one is correct)';
      break;
    case 'NAT':
      answerFormat = 'Provide the exact numerical answer';
      break;
    case 'SUB':
      answerFormat = 'Provide a comprehensive answer';
      break;
  }

  return `You are solving a ${context.examName} - ${context.courseName} exam question.

QUESTION:
${questionStatement}${optionsText}

Your task:
1. ${answerFormat}
2. Provide a detailed step-by-step solution

Format your response EXACTLY as follows:
ANSWER: [your answer here]
SOLUTION: [detailed step-by-step solution]

${questionType === 'MCQ' ? 'CRITICAL: Choose EXACTLY ONE correct option.' : ''}
${questionType === 'MSQ' ? 'CRITICAL: Choose AT LEAST ONE correct option (can be multiple).' : ''}`;
}

function parseGeneratedQuestion(text: string, questionType: string): GeneratedQuestion {
  const questionMatch = text.match(/QUESTION:\s*([\s\S]*?)(?=OPTIONS:|ANSWER:)/);
  const optionsMatch = text.match(/OPTIONS:\s*([\s\S]*?)(?=ANSWER:)/);
  const answerMatch = text.match(/ANSWER:\s*(.*?)(?=\n|SOLUTION:)/);
  const solutionMatch = text.match(/SOLUTION:\s*([\s\S]*?)$/);

  const question_statement = questionMatch ? questionMatch[1].trim() : '';
  const answer = answerMatch ? answerMatch[1].trim() : '';
  const solution = solutionMatch ? solutionMatch[1].trim() : '';

  let options: string[] | undefined;
  if (questionType === 'MCQ' || questionType === 'MSQ') {
    if (optionsMatch) {
      const optionsText = optionsMatch[1].trim();
      options = optionsText
        .split('\n')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0)
        .map(opt => opt.replace(/^[A-D]\)\s*/, ''));
    }
  }

  return {
    question_statement,
    options,
    answer,
    solution,
    question_type: questionType as 'MCQ' | 'MSQ' | 'NAT' | 'SUB'
  };
}

function parsePYQSolution(text: string, questionType: string): { answer: string; solution: string } {
  const answerMatch = text.match(/ANSWER:\s*(.*?)(?=\n|SOLUTION:)/);
  const solutionMatch = text.match(/SOLUTION:\s*([\s\S]*?)$/);

  return {
    answer: answerMatch ? answerMatch[1].trim() : '',
    solution: solutionMatch ? solutionMatch[1].trim() : ''
  };
}

async function verifyAnswer(question: GeneratedQuestion, context: QuestionContext): Promise<boolean> {
  if (question.question_type === 'MCQ') {
    const validOptions = ['A', 'B', 'C', 'D'];
    const answer = question.answer.toUpperCase().trim();
    if (!validOptions.includes(answer)) {
      return false;
    }
    if (answer.length !== 1) {
      return false;
    }
  } else if (question.question_type === 'MSQ') {
    const answers = question.answer.toUpperCase().split(',').map(a => a.trim());
    const validOptions = ['A', 'B', 'C', 'D'];
    if (answers.length === 0) {
      return false;
    }
    for (const ans of answers) {
      if (!validOptions.includes(ans)) {
        return false;
      }
    }
  } else if (question.question_type === 'NAT') {
    const num = parseFloat(question.answer);
    if (isNaN(num)) {
      return false;
    }
  }

  if (!question.question_statement || question.question_statement.length < 10) {
    return false;
  }
  if (!question.solution || question.solution.length < 20) {
    return false;
  }

  return true;
}

async function verifyPYQAnswer(
  questionStatement: string,
  answer: string,
  questionType: string,
  options: string[] | null
): Promise<boolean> {
  if (questionType === 'MCQ') {
    const validOptions = ['A', 'B', 'C', 'D'];
    const ans = answer.toUpperCase().trim();
    return validOptions.includes(ans) && ans.length === 1;
  } else if (questionType === 'MSQ') {
    const answers = answer.toUpperCase().split(',').map(a => a.trim());
    const validOptions = ['A', 'B', 'C', 'D'];
    if (answers.length === 0) return false;
    for (const ans of answers) {
      if (!validOptions.includes(ans)) return false;
    }
    return true;
  } else if (questionType === 'NAT') {
    const num = parseFloat(answer);
    return !isNaN(num);
  }

  return answer.length > 0;
}
