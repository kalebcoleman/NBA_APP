export interface RequestAuthContext {
  actorKey: string;
  userId: string | null;
  isAuthenticated: boolean;
  plan: 'FREE' | 'PREMIUM';
}
