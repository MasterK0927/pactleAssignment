export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: Date;
}