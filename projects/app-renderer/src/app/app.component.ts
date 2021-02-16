import {Component} from '@angular/core';
import {YoutubeService} from './services/youtube/youtube.service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'NGTube';


  constructor(public yt: YoutubeService) {


  }


}
