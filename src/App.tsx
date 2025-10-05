import { useState, useEffect } from 'react';
import { Loader2, Save, CheckCircle2, Play, Pause, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import { generateQuestion, generatePYQSolution, GeneratedQuestion, QuestionContext } from './lib/gemini';
import { calculateQuestionDistribution, TopicDistribution } from './lib/weightage';

interface QuestionWithMetadata extends GeneratedQuestion {
  topic_id: string;
  part_id?: string;
  slot_id?: string;
  correct_marks: number;
  incorrect_marks: number;
  skipped_marks: number;
  time_minutes: number;
}

function App() {
  const [mode, setMode] = useState<'manual' | 'auto' | 'pyq'>('manual');

  const [exams, setExams] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);

  const [selectedExam, setSelectedExam] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedQuestionType, setSelectedQuestionType] = useState('');
  const [selectedPart, setSelectedPart] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const [correctMarks, setCorrectMarks] = useState<string>('4');
  const [incorrectMarks, setIncorrectMarks] = useState<string>('-1');
  const [skippedMarks, setSkippedMarks] = useState<string>('0');
  const [timeMinutes, setTimeMinutes] = useState<string>('2');

  const [totalQuestionsToGenerate, setTotalQuestionsToGenerate] = useState<string>('100');
  const [distribution, setDistribution] = useState<TopicDistribution[]>([]);

  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionWithMetadata[]>([]);
  const [currentPreview, setCurrentPreview] = useState<number>(-1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');

  const [newQuestionsCount, setNewQuestionsCount] = useState(0);
  const [pyqSolutionsCount, setPyqSolutionsCount] = useState(0);

  const [autoProgress, setAutoProgress] = useState({
    currentSubjectIndex: 0,
    currentUnitIndex: 0,
    currentChapterIndex: 0,
    currentTopicIndex: 0,
    questionsGenerated: 0,
    totalQuestions: 0
  });

  useEffect(() => {
    console.log('App mounted, loading exams...');
    loadExams().catch(err => {
      console.error('Failed to load exams:', err);
      setError('Failed to load exams: ' + err.message);
    });
  }, []);

  useEffect(() => {
    if (selectedExam) loadCourses(selectedExam);
  }, [selectedExam]);

  useEffect(() => {
    if (selectedCourse) {
      loadSubjects(selectedCourse);
      loadParts(selectedCourse);
      loadSlots(selectedCourse);
      if (mode === 'auto') {
        loadAllTopicsForCourse();
      }
    }
  }, [selectedCourse, mode]);

  useEffect(() => {
    if (selectedSubject) loadUnits(selectedSubject);
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedUnit) loadChapters(selectedUnit);
  }, [selectedUnit]);

  useEffect(() => {
    if (selectedChapter) loadTopics(selectedChapter);
  }, [selectedChapter]);

  const loadExams = async () => {
    try {
      console.log('Fetching exams from Supabase...');
      const { data, error } = await supabase.from('exams').select('*');
      if (error) {
        console.error('Supabase error:', error);
        setError(error.message);
      } else {
        console.log('Exams loaded:', data);
        setExams(data || []);
      }
    } catch (err: any) {
      console.error('Exception loading exams:', err);
      setError('Exception: ' + err.message);
    }
  };

  const loadCourses = async (examId: string) => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('exam_id', examId);
    if (error) setError(error.message);
    else setCourses(data || []);
  };

  const loadSubjects = async (courseId: string) => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('course_id', courseId);
    if (error) setError(error.message);
    else setSubjects(data || []);
  };

  const loadUnits = async (subjectId: string) => {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('subject_id', subjectId);
    if (error) setError(error.message);
    else setUnits(data || []);
  };

  const loadChapters = async (unitId: string) => {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('unit_id', unitId);
    if (error) setError(error.message);
    else setChapters(data || []);
  };

  const loadTopics = async (chapterId: string) => {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('chapter_id', chapterId);
    if (error) setError(error.message);
    else setTopics(data || []);
  };

  const loadParts = async (courseId: string) => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('course_id', courseId);
    if (error) setError(error.message);
    else setParts(data || []);
  };

  const loadSlots = async (courseId: string) => {
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('course_id', courseId);
    if (error) setError(error.message);
    else setSlots(data || []);
  };

  const loadAllTopicsForCourse = async () => {
    if (!selectedCourse) return;

    const { data: allSubjects, error: subjectsError } = await supabase
      .from('subjects')
      .select('id, name')
      .eq('course_id', selectedCourse);

    if (subjectsError || !allSubjects) return;

    const allTopics: Array<{ id: string; name: string; weightage: number }> = [];

    for (const subject of allSubjects) {
      const { data: subjectUnits } = await supabase
        .from('units')
        .select('id')
        .eq('subject_id', subject.id);

      if (subjectUnits) {
        for (const unit of subjectUnits) {
          const { data: unitChapters } = await supabase
            .from('chapters')
            .select('id')
            .eq('unit_id', unit.id);

          if (unitChapters) {
            for (const chapter of unitChapters) {
              const { data: chapterTopics } = await supabase
                .from('topics')
                .select('id, name, weightage')
                .eq('chapter_id', chapter.id);

              if (chapterTopics) {
                allTopics.push(...chapterTopics.map(t => ({
                  id: t.id,
                  name: t.name,
                  weightage: t.weightage || 0
                })));
              }
            }
          }
        }
      }
    }

    return allTopics;
  };

  const calculateDistribution = async () => {
    const allTopics = await loadAllTopicsForCourse();
    if (!allTopics) {
      setError('Could not load topics for distribution calculation');
      return;
    }

    const totalQuestions = parseInt(totalQuestionsToGenerate);
    if (isNaN(totalQuestions) || totalQuestions <= 0) {
      setError('Please enter a valid number of questions');
      return;
    }

    const dist = calculateQuestionDistribution(allTopics, totalQuestions);
    setDistribution(dist);
  };

  const handleGenerateManualQuestion = async () => {
    if (!selectedTopic || !selectedQuestionType) {
      setError('Please select a topic and question type');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const context = await getQuestionContext();
      if (!context) {
        setError('Could not load context information');
        return;
      }

      const { data: existingQuestions } = await supabase
        .from('questions_topic_wise')
        .select('question_statement')
        .eq('topic_id', selectedTopic);

      const { data: alreadyGenerated } = await supabase
        .from('new_questions')
        .select('question_statement')
        .eq('topic_id', selectedTopic);

      const existing = existingQuestions?.map(q => q.question_statement) || [];
      const generated = alreadyGenerated?.map(q => q.question_statement) || [];

      const question = await generateQuestion(
        selectedQuestionType,
        selectedTopic,
        existing,
        generated,
        context
      );

      const questionWithMetadata: QuestionWithMetadata = {
        ...question,
        topic_id: selectedTopic,
        part_id: selectedPart || undefined,
        slot_id: selectedSlot || undefined,
        correct_marks: parseFloat(correctMarks),
        incorrect_marks: parseFloat(incorrectMarks),
        skipped_marks: parseFloat(skippedMarks),
        time_minutes: parseFloat(timeMinutes)
      };

      setGeneratedQuestions([questionWithMetadata]);
      setCurrentPreview(0);
    } catch (err: any) {
      setError(err.message || 'Failed to generate question');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartAutoGeneration = async () => {
    if (!selectedCourse || distribution.length === 0) {
      setError('Please select a course and calculate distribution first');
      return;
    }

    setIsGenerating(true);
    setIsPaused(false);
    setError('');
    setGeneratedQuestions([]);
    setNewQuestionsCount(0);

    const totalQuestions = distribution.reduce((sum, d) => sum + d.questionsToGenerate, 0);
    setAutoProgress({
      currentSubjectIndex: 0,
      currentUnitIndex: 0,
      currentChapterIndex: 0,
      currentTopicIndex: 0,
      questionsGenerated: 0,
      totalQuestions
    });

    await generateQuestionsAutomatically();
  };

  const generateQuestionsAutomatically = async () => {
    for (const topicDist of distribution) {
      if (isPaused) break;

      const context = await getQuestionContextForTopic(topicDist.topicId);
      if (!context) continue;

      const { data: existingQuestions } = await supabase
        .from('questions_topic_wise')
        .select('question_statement')
        .eq('topic_id', topicDist.topicId);

      const existing = existingQuestions?.map(q => q.question_statement) || [];

      for (let i = 0; i < topicDist.questionsToGenerate; i++) {
        if (isPaused) break;

        try {
          const { data: alreadyGenerated } = await supabase
            .from('new_questions')
            .select('question_statement')
            .eq('topic_id', topicDist.topicId);

          const generated = alreadyGenerated?.map(q => q.question_statement) || [];

          const question = await generateQuestion(
            selectedQuestionType || 'MCQ',
            topicDist.topicId,
            existing,
            generated,
            context
          );

          const questionWithMetadata: QuestionWithMetadata = {
            ...question,
            topic_id: topicDist.topicId,
            part_id: selectedPart || undefined,
            slot_id: selectedSlot || undefined,
            correct_marks: parseFloat(correctMarks),
            incorrect_marks: parseFloat(incorrectMarks),
            skipped_marks: parseFloat(skippedMarks),
            time_minutes: parseFloat(timeMinutes)
          };

          await saveQuestionToSupabase(questionWithMetadata);

          setGeneratedQuestions(prev => [...prev, questionWithMetadata]);
          setNewQuestionsCount(prev => prev + 1);
          setAutoProgress(prev => ({
            ...prev,
            questionsGenerated: prev.questionsGenerated + 1
          }));

        } catch (err: any) {
          console.error('Error generating question:', err);
        }
      }
    }

    setIsGenerating(false);
  };

  const handleGeneratePYQSolutions = async () => {
    if (!selectedCourse) {
      setError('Please select a course first');
      return;
    }

    setIsGenerating(true);
    setError('');
    setPyqSolutionsCount(0);

    try {
      const { data: pyqs, error: pyqError } = await supabase
        .from('questions_topic_wise')
        .select('id, question_statement, question_type, options, topic_id')
        .is('answer', null)
        .is('solution', null);

      if (pyqError) throw pyqError;

      if (!pyqs || pyqs.length === 0) {
        setError('No PYQs found without answers/solutions');
        setIsGenerating(false);
        return;
      }

      for (const pyq of pyqs) {
        if (isPaused) break;

        try {
          const context = await getQuestionContextForTopic(pyq.topic_id);
          if (!context) continue;

          const options = pyq.options ? JSON.parse(pyq.options) : null;

          const { answer, solution } = await generatePYQSolution(
            pyq.question_statement,
            pyq.question_type,
            options,
            context
          );

          await supabase
            .from('questions_topic_wise')
            .update({ answer, solution })
            .eq('id', pyq.id);

          setPyqSolutionsCount(prev => prev + 1);

        } catch (err: any) {
          console.error('Error generating PYQ solution:', err);
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to generate PYQ solutions');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveQuestionToSupabase = async (question: QuestionWithMetadata) => {
    await supabase
      .from('new_questions')
      .insert({
        topic_id: question.topic_id,
        question_statement: question.question_statement,
        options: question.options ? JSON.stringify(question.options) : null,
        answer: question.answer,
        solution: question.solution,
        question_type: question.question_type,
        part_id: question.part_id || null,
        slot_id: question.slot_id || null,
        correct_marks: question.correct_marks,
        incorrect_marks: question.incorrect_marks,
        skipped_marks: question.skipped_marks,
        time_minutes: question.time_minutes
      });
  };

  const handleSaveManualQuestion = async () => {
    if (generatedQuestions.length === 0) return;

    try {
      for (const question of generatedQuestions) {
        await saveQuestionToSupabase(question);
      }
      setNewQuestionsCount(prev => prev + generatedQuestions.length);
      alert('Questions saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to save questions');
    }
  };

  const getQuestionContext = async (): Promise<QuestionContext | null> => {
    const exam = exams.find(e => e.id === selectedExam);
    const course = courses.find(c => c.id === selectedCourse);
    const subject = subjects.find(s => s.id === selectedSubject);
    const topic = topics.find(t => t.id === selectedTopic);

    if (!exam || !course || !subject || !topic) return null;

    return {
      examName: exam.name,
      courseName: course.name,
      subjectName: subject.name,
      topicName: topic.name
    };
  };

  const getQuestionContextForTopic = async (topicId: string): Promise<QuestionContext | null> => {
    const { data: topic } = await supabase.from('topics').select('name, chapter_id').eq('id', topicId).maybeSingle();
    if (!topic) return null;

    const { data: chapter } = await supabase.from('chapters').select('unit_id').eq('id', topic.chapter_id).maybeSingle();
    if (!chapter) return null;

    const { data: unit } = await supabase.from('units').select('subject_id').eq('id', chapter.unit_id).maybeSingle();
    if (!unit) return null;

    const { data: subject } = await supabase.from('subjects').select('name').eq('id', unit.subject_id).maybeSingle();
    if (!subject) return null;

    const exam = exams.find(e => e.id === selectedExam);
    const course = courses.find(c => c.id === selectedCourse);

    if (!exam || !course) return null;

    return {
      examName: exam.name,
      courseName: course.name,
      subjectName: subject.name,
      topicName: topic.name
    };
  };

  console.log('Rendering App component...');
  console.log('Exams:', exams);
  console.log('Error:', error);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-slate-800 mb-8">AI Question Generator</h1>
        {!exams.length && !error && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-6">
            Loading data from database...
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setMode('manual')}
              className={`px-6 py-2 rounded-lg font-medium ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              Manual Mode
            </button>
            <button
              onClick={() => setMode('auto')}
              className={`px-6 py-2 rounded-lg font-medium ${mode === 'auto' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              Auto Mode
            </button>
            <button
              onClick={() => setMode('pyq')}
              className={`px-6 py-2 rounded-lg font-medium ${mode === 'pyq' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              Generate PYQ Solutions
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Exam</label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>{exam.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                disabled={!selectedExam}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">Select Course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>

            {mode === 'manual' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    disabled={!selectedCourse}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Unit</label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    disabled={!selectedSubject}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    <option value="">Select Unit</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Chapter</label>
                  <select
                    value={selectedChapter}
                    onChange={(e) => setSelectedChapter(e.target.value)}
                    disabled={!selectedUnit}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    <option value="">Select Chapter</option>
                    {chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Topic</label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    disabled={!selectedChapter}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                  >
                    <option value="">Select Topic</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {mode !== 'pyq' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Question Type</label>
                <select
                  value={selectedQuestionType}
                  onChange={(e) => setSelectedQuestionType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Type</option>
                  <option value="MCQ">MCQ (Single Correct)</option>
                  <option value="MSQ">MSQ (Multiple Correct)</option>
                  <option value="NAT">NAT (Numerical)</option>
                  <option value="SUB">Subjective</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Part (Optional)</label>
              <select
                value={selectedPart}
                onChange={(e) => setSelectedPart(e.target.value)}
                disabled={!selectedCourse}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">Select Part</option>
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>{part.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Slot (Optional)</label>
              <select
                value={selectedSlot}
                onChange={(e) => setSelectedSlot(e.target.value)}
                disabled={!selectedCourse}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
              >
                <option value="">Select Slot</option>
                {slots.map((slot) => (
                  <option key={slot.id} value={slot.id}>{slot.name}</option>
                ))}
              </select>
            </div>
          </div>

          {mode !== 'pyq' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Correct Marks</label>
                <input
                  type="number"
                  step="0.1"
                  value={correctMarks}
                  onChange={(e) => setCorrectMarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Incorrect Marks</label>
                <input
                  type="number"
                  step="0.1"
                  value={incorrectMarks}
                  onChange={(e) => setIncorrectMarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Skipped Marks</label>
                <input
                  type="number"
                  step="0.1"
                  value={skippedMarks}
                  onChange={(e) => setSkippedMarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Time (minutes)</label>
                <input
                  type="number"
                  step="0.1"
                  value={timeMinutes}
                  onChange={(e) => setTimeMinutes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {mode === 'auto' && (
            <div className="mb-6">
              <div className="flex gap-4 items-end mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Total Questions to Generate</label>
                  <input
                    type="number"
                    value={totalQuestionsToGenerate}
                    onChange={(e) => setTotalQuestionsToGenerate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={calculateDistribution}
                  disabled={!selectedCourse}
                  className="px-6 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 disabled:bg-slate-300"
                >
                  Calculate Distribution
                </button>
              </div>

              {distribution.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold text-slate-800 mb-3">Topic Distribution Preview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {distribution.map((dist, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border border-slate-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700">{dist.topicName}</p>
                            <p className="text-xs text-slate-500">Weightage: {dist.weightage.toFixed(2)}%</p>
                          </div>
                          <span className="text-lg font-bold text-blue-600">{dist.questionsToGenerate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 mt-3">
                    Total: {distribution.reduce((sum, d) => sum + d.questionsToGenerate, 0)} questions
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-4">
            {mode === 'manual' && (
              <>
                <button
                  onClick={handleGenerateManualQuestion}
                  disabled={isGenerating || !selectedTopic || !selectedQuestionType}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Question'
                  )}
                </button>
                {generatedQuestions.length > 0 && (
                  <button
                    onClick={handleSaveManualQuestion}
                    className="px-6 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 flex items-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save to Supabase
                  </button>
                )}
              </>
            )}

            {mode === 'auto' && (
              <>
                <button
                  onClick={handleStartAutoGeneration}
                  disabled={isGenerating || distribution.length === 0}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating... {autoProgress.questionsGenerated}/{autoProgress.totalQuestions}
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Auto Generation
                    </>
                  )}
                </button>
                {isGenerating && (
                  <button
                    onClick={() => setIsPaused(true)}
                    className="px-6 bg-orange-600 text-white py-3 rounded-lg font-medium hover:bg-orange-700 flex items-center gap-2"
                  >
                    <Pause className="w-5 h-5" />
                    Pause
                  </button>
                )}
              </>
            )}

            {mode === 'pyq' && (
              <button
                onClick={handleGeneratePYQSolutions}
                disabled={isGenerating || !selectedCourse}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Solutions...
                  </>
                ) : (
                  'Generate PYQ Solutions'
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-700">New Questions Generated</h3>
                <p className="text-3xl font-bold text-blue-600">{newQuestionsCount}</p>
              </div>
              <CheckCircle2 className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-green-700">PYQ Solutions Generated</h3>
                <p className="text-3xl font-bold text-green-600">{pyqSolutionsCount}</p>
              </div>
              <CheckCircle2 className="w-12 h-12 text-green-400" />
            </div>
          </div>
        </div>

        {generatedQuestions.length > 0 && mode === 'manual' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-semibold text-slate-800 mb-4">Question Preview</h2>
            {currentPreview >= 0 && generatedQuestions[currentPreview] && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {generatedQuestions[currentPreview].question_type}
                  </span>
                  <div className="text-sm text-slate-600">
                    Time: {generatedQuestions[currentPreview].time_minutes} min |
                    Marks: +{generatedQuestions[currentPreview].correct_marks} /
                    {generatedQuestions[currentPreview].incorrect_marks} /
                    {generatedQuestions[currentPreview].skipped_marks}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-slate-700 mb-2">Question:</h3>
                  <p className="text-slate-600">{generatedQuestions[currentPreview].question_statement}</p>
                </div>

                {generatedQuestions[currentPreview].options && (
                  <div>
                    <h3 className="font-medium text-slate-700 mb-2">Options:</h3>
                    <div className="space-y-2">
                      {generatedQuestions[currentPreview].options.map((option, index) => (
                        <div key={index} className="flex gap-2 p-2 bg-slate-50 rounded">
                          <span className="font-medium text-slate-600">{String.fromCharCode(65 + index)})</span>
                          <span className="text-slate-600">{option}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-medium text-slate-700 mb-2">Answer:</h3>
                  <p className="text-slate-600 bg-green-50 p-2 rounded">{generatedQuestions[currentPreview].answer}</p>
                </div>

                <div>
                  <h3 className="font-medium text-slate-700 mb-2">Solution:</h3>
                  <p className="text-slate-600 whitespace-pre-wrap">{generatedQuestions[currentPreview].solution}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
