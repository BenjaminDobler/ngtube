import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { DownloadComponent } from './components/download/download.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {YoutubeService} from './services/youtube/youtube.service';
import { NgxFilesizeModule } from 'ngx-filesize';

@NgModule({
  declarations: [
    AppComponent,
    DownloadComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    NgxFilesizeModule
  ],
  providers: [YoutubeService],
  bootstrap: [AppComponent]
})
export class AppModule { }
