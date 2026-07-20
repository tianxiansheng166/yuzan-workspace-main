export interface TrainingModule {
  id: string;
  title: string;
  summary: string;
  content: string[];
}

export interface AssessmentQuestion {
  id: string;
  moduleId: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface TrainingProgress {
  completedModuleIds: string[];
  assessmentAnswers: Record<string, number>;
  certificateRequested: boolean;
}

export interface TrainingFeedback {
  message: string;
  tone: "success" | "warning" | "information";
}
