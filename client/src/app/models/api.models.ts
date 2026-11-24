export interface AuthResponse {
  token: string;
  userId: number;
  fullName: string;
  email: string;
  role: 'Participant' | 'Organizer' | 'Moderator';
}

export interface Community {
  id: number;
  name: string;
  category: string;
  description: string;
  isPrivate: boolean;
  isBlocked: boolean;
  organizerId: number;
  organizerName: string;
  membersCount: number;
  myMembershipStatus?: 'Pending' | 'Approved' | 'Rejected' | 'Revoked' | null;
  isOrganizer: boolean;
  canViewPrivateContent?: boolean;
  pendingRequests?: MembershipItem[];
  approvedMembers?: MembershipItem[];
}

export interface MembershipItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  applicationNote?: string;
  requestedAt?: string;
  updatedAt?: string;
}

export interface ClubEvent {
  id: number;
  communityId: number;
  communityName: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  maxCapacity: number;
  confirmedCount: number;
  waitlistCount: number;
  availableSeats: number;
  isPrivateForMembersOnly: boolean;
  myRegistrationStatus?: 'Confirmed' | 'Waitlisted' | 'Cancelled' | null;
}

export interface MyRegistration {
  id: number;
  eventId: number;
  eventTitle: string;
  communityName: string;
  location: string;
  startsAt: string;
  status: 'Confirmed' | 'Waitlisted';
  registeredAt: string;
}

export interface CommunityPost {
  id: number;
  title: string;
  content: string;
  isMembersOnly: boolean;
  isHiddenByModerator: boolean;
  moderationReason?: string;
  authorName: string;
  createdAt: string;
}
