/** Agent vs group session*/
export type SessionType = 'agent' | 'group';

export interface ConsoleSession {
  type: SessionType;
  /** Group member display names (excludes self). */
  members?: string[];
}

export interface AuthorInfo {
  userId: string;
  fullName: string;
}
