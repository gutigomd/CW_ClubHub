import { Routes } from '@angular/router';
import { CommunitiesPageComponent } from './pages/communities.page';
import { CommunityDetailPageComponent } from './pages/community-detail.page';
import { EventsPageComponent } from './pages/events.page';
import { MyEventsPageComponent } from './pages/my-events.page';
import { LoginPageComponent } from './pages/login.page';

export const routes: Routes = [
  { path: '', component: CommunitiesPageComponent },
  { path: 'communities/:id', component: CommunityDetailPageComponent },
  { path: 'events', component: EventsPageComponent },
  { path: 'my-events', component: MyEventsPageComponent },
  { path: 'login', component: LoginPageComponent },
  { path: '**', redirectTo: '' }
];
