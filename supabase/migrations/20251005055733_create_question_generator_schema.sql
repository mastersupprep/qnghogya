/*
  # Question Generator Database Schema

  1. New Tables
    - `exams` - Stores exam information
      - `id` (uuid, primary key)
      - `name` (text, exam name)
      - `created_at` (timestamptz)
    
    - `courses` - Stores courses under exams
      - `id` (uuid, primary key)
      - `exam_id` (uuid, foreign key to exams)
      - `name` (text, course name)
      - `created_at` (timestamptz)
    
    - `subjects` - Stores subjects under courses
      - `id` (uuid, primary key)
      - `course_id` (uuid, foreign key to courses)
      - `name` (text, subject name)
      - `created_at` (timestamptz)
    
    - `units` - Stores units under subjects
      - `id` (uuid, primary key)
      - `subject_id` (uuid, foreign key to subjects)
      - `name` (text, unit name)
      - `created_at` (timestamptz)
    
    - `chapters` - Stores chapters under units
      - `id` (uuid, primary key)
      - `unit_id` (uuid, foreign key to units)
      - `name` (text, chapter name)
      - `created_at` (timestamptz)
    
    - `topics` - Stores topics under chapters with weightage
      - `id` (uuid, primary key)
      - `chapter_id` (uuid, foreign key to chapters)
      - `name` (text, topic name)
      - `weightage` (numeric, percentage weightage for question distribution)
      - `created_at` (timestamptz)
    
    - `parts` - Optional parts for exams
      - `id` (uuid, primary key)
      - `course_id` (uuid, foreign key to courses)
      - `name` (text, part name)
      - `created_at` (timestamptz)
    
    - `slots` - Optional time slots for exams
      - `id` (uuid, primary key)
      - `course_id` (uuid, foreign key to courses)
      - `name` (text, slot name)
      - `created_at` (timestamptz)
    
    - `questions_topic_wise` - Previous year questions
      - `id` (uuid, primary key)
      - `topic_id` (uuid, foreign key to topics)
      - `question_statement` (text)
      - `question_type` (text)
      - `options` (jsonb)
      - `answer` (text, nullable)
      - `solution` (text, nullable)
      - `created_at` (timestamptz)
    
    - `new_questions` - AI generated questions
      - `id` (uuid, primary key)
      - `topic_id` (uuid, foreign key to topics)
      - `question_statement` (text)
      - `question_type` (text)
      - `options` (jsonb)
      - `answer` (text)
      - `solution` (text)
      - `part_id` (uuid, foreign key to parts, nullable)
      - `slot_id` (uuid, foreign key to slots, nullable)
      - `correct_marks` (numeric)
      - `incorrect_marks` (numeric)
      - `skipped_marks` (numeric)
      - `time_minutes` (numeric)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for public read access (for demo purposes)
*/

-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create units table
CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name text NOT NULL,
  weightage numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create parts table
CREATE TABLE IF NOT EXISTS parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create slots table
CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create questions_topic_wise table (PYQs)
CREATE TABLE IF NOT EXISTS questions_topic_wise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_statement text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  answer text,
  solution text,
  created_at timestamptz DEFAULT now()
);

-- Create new_questions table (Generated questions)
CREATE TABLE IF NOT EXISTS new_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  question_statement text NOT NULL,
  question_type text NOT NULL,
  options jsonb,
  answer text NOT NULL,
  solution text NOT NULL,
  part_id uuid REFERENCES parts(id) ON DELETE SET NULL,
  slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  correct_marks numeric NOT NULL DEFAULT 4,
  incorrect_marks numeric NOT NULL DEFAULT -1,
  skipped_marks numeric NOT NULL DEFAULT 0,
  time_minutes numeric NOT NULL DEFAULT 2,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions_topic_wise ENABLE ROW LEVEL SECURITY;
ALTER TABLE new_questions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (for demo purposes)
CREATE POLICY "Allow public read access on exams"
  ON exams FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on exams"
  ON exams FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on courses"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on courses"
  ON courses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on subjects"
  ON subjects FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on subjects"
  ON subjects FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on units"
  ON units FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on units"
  ON units FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on chapters"
  ON chapters FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on chapters"
  ON chapters FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on topics"
  ON topics FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on topics"
  ON topics FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on parts"
  ON parts FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on parts"
  ON parts FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on slots"
  ON slots FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on slots"
  ON slots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public read access on questions_topic_wise"
  ON questions_topic_wise FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on questions_topic_wise"
  ON questions_topic_wise FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update on questions_topic_wise"
  ON questions_topic_wise FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access on new_questions"
  ON new_questions FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert on new_questions"
  ON new_questions FOR INSERT
  WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_courses_exam_id ON courses(exam_id);
CREATE INDEX IF NOT EXISTS idx_subjects_course_id ON subjects(course_id);
CREATE INDEX IF NOT EXISTS idx_units_subject_id ON units(subject_id);
CREATE INDEX IF NOT EXISTS idx_chapters_unit_id ON chapters(unit_id);
CREATE INDEX IF NOT EXISTS idx_topics_chapter_id ON topics(chapter_id);
CREATE INDEX IF NOT EXISTS idx_parts_course_id ON parts(course_id);
CREATE INDEX IF NOT EXISTS idx_slots_course_id ON slots(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_wise_topic_id ON questions_topic_wise(topic_id);
CREATE INDEX IF NOT EXISTS idx_new_questions_topic_id ON new_questions(topic_id);