import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Community, ClubEvent, MyRegistration, CommunityPost } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getCommunities(search?: string, category?: string, isPrivate?: string) {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (category) params = params.set('category', category);
    if (isPrivate === 'true' || isPrivate === 'false') params = params.set('isPrivate', isPrivate);
    return this.http.get<Community[]>('/api/communities', { params });
  }

  getCommunity(id: number) {
    return this.http.get<Community>(`/api/communities/${id}`);
  }

  createCommunity(data: { name: string; category: string; description: string; isPrivate: boolean }) {
    return this.http.post('/api/communities', data);
  }

  joinCommunity(id: number, applicationNote?: string) {
    return this.http.post<{ status: string; message: string }>(`/api/communities/${id}/join`, { applicationNote });
  }

  leaveCommunity(id: number) {
    return this.http.post<{ message: string }>(`/api/communities/${id}/leave`, {});
  }

  reviewMembership(communityId: number, membershipId: number, approve: boolean) {
    return this.http.post(`/api/communities/${communityId}/memberships/${membershipId}/review`, { approve });
  }

  revokeMembership(communityId: number, membershipId: number) {
    return this.http.post<{ message: string }>(`/api/communities/${communityId}/memberships/${membershipId}/revoke`, {});
  }

  toggleBlockCommunity(id: number, block: boolean) {
    return this.http.post(`/api/communities/${id}/block`, block);
  }

  getEvents(communityId?: number) {
    let params = new HttpParams();
    if (communityId) params = params.set('communityId', communityId);
    return this.http.get<ClubEvent[]>('/api/events', { params });
  }

  getMyRegistrations() {
    return this.http.get<MyRegistration[]>('/api/events/my');
  }

  createEvent(data: {
    communityId: number;
    title: string;
    description: string;
    location: string;
    startsAt: string;
    maxCapacity: number;
    isPrivateForMembersOnly: boolean;
  }) {
    return this.http.post('/api/events', data);
  }

  registerForEvent(eventId: number) {
    return this.http.post<{ status: string; message: string }>(`/api/events/${eventId}/register`, {});
  }

  cancelRegistration(eventId: number) {
    return this.http.post<{ message: string }>(`/api/events/${eventId}/cancel`, {});
  }

  getCommunityPosts(communityId: number) {
    return this.http.get<CommunityPost[]>(`/api/posts/community/${communityId}`);
  }

  createPost(data: { communityId: number; title: string; content: string; isMembersOnly: boolean }) {
    return this.http.post('/api/posts', data);
  }

  moderatePost(postId: number, hide: boolean, reason?: string) {
    return this.http.post(`/api/posts/${postId}/moderate`, { hide, reason });
  }
}
