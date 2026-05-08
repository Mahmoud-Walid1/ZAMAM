export type Priority = 'High' | 'Medium' | 'Low';
export type Status = 'Pending' | 'In Progress' | 'Completed' | 'Archived';
export type Role = 'Admin' | 'DeputyManager' | 'Manager' | 'Reviewer' | 'Uploader' | 'Creator';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  role: Role;
  photoURL?: string;
}

export interface PipelineStage {
  stage: number;
  assigneeId: string | null;
  role: Role;
  status: Status;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  driveFolderId?: string;
  requiresAdminApproval: boolean;
  createdAt: Date;
  createdBy: string;
  pipeline: PipelineStage[];
  currentStage: number;
}
