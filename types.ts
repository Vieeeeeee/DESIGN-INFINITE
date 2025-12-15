export enum RoomType {
  LIVING_ROOM = 'Living Room',
  BEDROOM = 'Bedroom',
  KITCHEN = 'Kitchen',
  DINING_ROOM = 'Dining Room',
  BATHROOM = 'Bathroom',
  HALLWAY = 'Hallway',
  LOBBY = 'Lobby',
  OFFICE = 'Home Office'
}

export interface AnalysisResult {
  vibeDescription: string;
}

export interface GenerationState {
  status: 'idle' | 'analyzing' | 'ready_to_generate' | 'generating' | 'completed' | 'error';
  error?: string;
}