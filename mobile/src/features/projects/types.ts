export type Project = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};
