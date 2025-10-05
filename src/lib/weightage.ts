export interface TopicDistribution {
  topicId: string;
  topicName: string;
  weightage: number;
  questionsToGenerate: number;
}

export function calculateQuestionDistribution(
  topics: Array<{ id: string; name: string; weightage: number }>,
  totalQuestions: number
): TopicDistribution[] {
  const totalWeightage = topics.reduce((sum, topic) => sum + topic.weightage, 0);

  let distribution: TopicDistribution[] = [];
  let assignedQuestions = 0;

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    let questionsForTopic: number;

    if (topic.weightage === 0) {
      questionsForTopic = 1;
    } else if (totalWeightage === 0) {
      questionsForTopic = Math.ceil(totalQuestions / topics.length);
    } else {
      const calculatedQuestions = (topic.weightage / totalWeightage) * totalQuestions;
      questionsForTopic = Math.round(calculatedQuestions);

      if (questionsForTopic === 0 && topic.weightage > 0) {
        questionsForTopic = 1;
      }
    }

    distribution.push({
      topicId: topic.id,
      topicName: topic.name,
      weightage: topic.weightage,
      questionsToGenerate: questionsForTopic
    });

    assignedQuestions += questionsForTopic;
  }

  const difference = totalQuestions - assignedQuestions;
  if (difference !== 0 && distribution.length > 0) {
    const sortedByWeightage = [...distribution].sort((a, b) => b.weightage - a.weightage);
    sortedByWeightage[0].questionsToGenerate += difference;
  }

  return distribution;
}

export function getTotalQuestionsFromDistribution(distribution: TopicDistribution[]): number {
  return distribution.reduce((sum, topic) => sum + topic.questionsToGenerate, 0);
}
