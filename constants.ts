export const NEGATIVE_SPEECH_SUBCATEGORIES: string[] = [
  'Devaluation of Others',
  'Entitlement',
  'Victim Narrative/Self-Pity',
  'Shame-Laden',
  'Envy/Resentment',
  'Passive-Aggression',
  'Hostility',
  'Hate Speech',
  'Impaired Empathy / Dismissiveness',
  'Incoherence',
  'Excessive Self-Reference',
];

export const NEGATIVE_BEHAVIOR_SUBCATEGORIES: string[] = [
  'Bullying',
  'Harassment',
  'Drinking alcohol',
  'Violence',
  'Sexism',
];

export const POTENTIAL_EMOTIONS_SUBCATEGORIES: string[] = [
  'Angry',
  'Fearful/Anxious',
  'Sad',
  'Irritated/Impatient',
  'Cold/Detached',
];

export const EVENT_PENALTIES: { [key: string]: number } = {
  // Negative Speech Penalties (lower impact)
  'Devaluation of Others': 1.5,
  'Entitlement': 1,
  'Victim Narrative/Self-Pity': 1,
  'Shame-Laden': 1.5,
  'Envy/Resentment': 1,
  'Passive-Aggression': 1,
  'Hostility': 2,
  'Impaired Empathy / Dismissiveness': 2,
  'Incoherence': 0.5,
  'Excessive Self-Reference': 0.5,

  // Negative Behavior Penalties (higher impact)
  'Bullying': 3,
  'Sexism': 3,
  'Drinking alcohol': 2,
  'Harassment': 4,
  
  // Highest Impact
  'Hate Speech': 5,
  'Violence': 5,
  
  // Potential Emotion Penalties
  'Angry': 1.5,
  'Fearful/Anxious': 1,
  'Sad': 1,
  'Irritated/Impatient': 1,
  'Cold/Detached': 1.5,
};