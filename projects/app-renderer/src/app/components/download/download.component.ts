import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {YoutubeDownload} from '../../services/youtube/youtube.download';

@Component({
  selector: 'download',
  templateUrl: './download.component.html',
  styleUrls: ['./download.component.scss']
})
export class DownloadComponent implements OnInit {


  @Input()
  download: YoutubeDownload;

  @Output()
  delete: EventEmitter<any> = new EventEmitter<any>();


  private expanded = false;

  constructor() { }

  ngOnInit() {
  }

  downloadDefault() {
    this.download.download();
  }



}
